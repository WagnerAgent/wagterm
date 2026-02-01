import type {
  AiCommandResponse,
  AiGenerateRequest,
  AiGenerateResponse,
  AiModel,
  AiSessionContext,
  AiStreamCompleteEvent,
  AiStreamErrorEvent,
  AiStreamStartRequest
} from '../../shared/assistant';
import { AI_COMMAND_RESPONSE_EXAMPLE, AI_COMMAND_RESPONSE_SCHEMA, parseAiCommandResponse } from '../../shared/assistant';
import type { AgentAction, AgentEvent } from '../../shared/agent-ipc';
import { AgentRunner } from '../../agent/runner';
import type { SshPtyService } from '../ssh/sshPtyService';
import type { WebContents } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import { randomUUID } from 'crypto';
import { getAiKey } from '../security/credentials';

type Provider = 'openai' | 'anthropic';
type StreamFilterState = {
  pending: string;
  jsonStarted: boolean;
};
type StreamChunkHandler = (text: string) => void;

const JSON_MARKER = 'JSON:';
const JSON_TAIL_LEN = JSON_MARKER.length - 1;

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const resolveProvider = (model: AiModel): Provider =>
  model.startsWith('gpt-') ? 'openai' : 'anthropic';

const buildSystemPrompt = (output: string, truncated: boolean, session: AiSessionContext) => {
  const outputNote = truncated ? ' (truncated)' : '';
  return [
    'You are Wagterm AI, an SSH assistant.',
    'Return only valid JSON that matches the schema, including an intent field.',
    'Never execute commands; only propose commands for approval.',
    'If the request needs multiple steps (3+), include a plan array of 3-6 short steps.',
    'If a command requires user interaction (e.g., editors, long-running interactive tools), set interactive=true on the command proposal.',
    'If the user asks to inspect or check something, set intent=command and choose an action, then propose a safe command immediately.',
    'Ask a clarifying question only if the task is ambiguous AND the next safe command truly depends on the answer.',
    'When given a goal, keep proposing the next command until the goal is satisfied. When done, set done=true and leave commands empty.',
    'For greetings or unclear requests, respond with a short message and an empty commands array.',
    'Propose at most one command per response.',
    `Session: ${session.username}@${session.host}:${session.port}${session.name ? ` (${session.name})` : ''}`,
    `Recent terminal output${outputNote}:`,
    output || '(no output yet)',
    'Schema:',
    JSON.stringify(AI_COMMAND_RESPONSE_SCHEMA),
    'Example:',
    JSON.stringify(AI_COMMAND_RESPONSE_EXAMPLE)
  ].join('\n');
};

const buildStreamingSystemPrompt = (
  output: string,
  truncated: boolean,
  session: AiSessionContext
) => {
  const outputNote = truncated ? ' (truncated)' : '';
  return [
    'You are Wagterm AI, an SSH assistant.',
    'Respond conversationally in plain text first, then include a JSON payload on a new line.',
    'Prefix the JSON with "JSON:" and make sure the JSON matches the schema.',
    'Do not start the response with JSON or a "{".',
    'Include an intent field in the JSON: chat, plan, or command.',
    'Include an action field in the JSON from the schema when possible.',
    'Never execute commands; only propose commands for approval.',
    'If the request needs multiple steps (3+), include a plan array of 3-6 short steps.',
    'If a command requires user interaction (e.g., editors, long-running interactive tools), set interactive=true on the command proposal.',
    'If the user asks to inspect or check something, set intent=command and choose an action, then propose a safe command immediately.',
    'Ask a clarifying question only if the task is ambiguous AND the next safe command truly depends on the answer.',
    'When given a goal, keep proposing the next command until the goal is satisfied. When done, set done=true and leave commands empty.',
    'For greetings or unclear requests, respond with a short message and an empty commands array.',
    'Propose at most one command per response.',
    `Session: ${session.username}@${session.host}:${session.port}${session.name ? ` (${session.name})` : ''}`,
    `Recent terminal output${outputNote}:`,
    output || '(no output yet)',
    'Schema:',
    JSON.stringify(AI_COMMAND_RESPONSE_SCHEMA),
    'Example:',
    'Hello! How can I help?',
    `JSON:${JSON.stringify(AI_COMMAND_RESPONSE_EXAMPLE)}`
  ].join('\n');
};

const buildUserPrompt = (prompt: string) => {
  return `User request:\n${prompt}`;
};

const buildAgentPrompt = (goal: string, step: number, note?: string) => {
  const lines = [
    `Goal: ${goal}`,
    `Step: ${step}`,
    'You are in agent mode. If the goal is not complete, propose the next single command.',
    'If the goal is complete, set done=true and return no commands.',
    note ? `Context: ${note}` : null
  ].filter((line): line is string => Boolean(line));
  return lines.join('\n');
};

const parseJsonFromText = (text: string): AiCommandResponse => {
  try {
    const parsed = JSON.parse(text);
    return parseAiCommandResponse(parsed);
  } catch {
    return { commands: [], message: text.trim() || 'Unable to parse AI response.' };
  }
};


const actionCommandMap: Record<NonNullable<AiCommandResponse['action']>, AiCommandProposal> = {
  inspect_services: {
    command: 'systemctl list-units --type=service --state=running --no-pager',
    rationale: 'Lists running systemd services to see what is active.',
    risk: 'low',
    requiresApproval: true
  },
  inspect_ports: {
    command: 'ss -tulpn',
    rationale: 'Shows listening sockets and their owning processes.',
    risk: 'low',
    requiresApproval: true
  },
  inspect_disk: {
    command: 'df -h',
    rationale: 'Shows filesystem usage in human-readable units.',
    risk: 'low',
    requiresApproval: true
  },
  inspect_memory: {
    command: 'free -h',
    rationale: 'Shows memory and swap usage.',
    risk: 'low',
    requiresApproval: true
  },
  inspect_cpu: {
    command: 'uptime',
    rationale: 'Shows load averages and uptime at a glance.',
    risk: 'low',
    requiresApproval: true
  },
  inspect_updates: {
    command: 'apt list --upgradable 2>/dev/null',
    rationale: 'Lists pending updates without installing anything.',
    risk: 'low',
    requiresApproval: true
  },
  inspect_logs: {
    command: 'journalctl -n 200 --no-pager',
    rationale: 'Shows recent system logs for context.',
    risk: 'low',
    requiresApproval: true
  },
  inspect_processes: {
    command: 'ps aux --sort=-%cpu | head -n 15',
    rationale: 'Shows top CPU-consuming processes.',
    risk: 'low',
    requiresApproval: true
  },
  fix_issue: {
    command: 'systemctl --failed --no-pager',
    rationale: 'Shows failed services as a first diagnostic step.',
    risk: 'low',
    requiresApproval: true
  },
  deploy: {
    command: 'pwd',
    rationale: 'Confirms current directory before taking deployment steps.',
    risk: 'low',
    requiresApproval: true
  },
  configure: {
    command: 'whoami && hostname',
    rationale: 'Confirms current user/host before configuration changes.',
    risk: 'low',
    requiresApproval: true
  },
  security: {
    command: 'ss -tulpn',
    rationale: 'Reviews listening services as a first security check.',
    risk: 'low',
    requiresApproval: true
  },
  network: {
    command: 'ip addr show',
    rationale: 'Shows network interfaces and addresses.',
    risk: 'low',
    requiresApproval: true
  },
  unknown: {
    command: 'whoami && hostname',
    rationale: 'Establishes basic context before proceeding.',
    risk: 'low',
    requiresApproval: true
  }
};

const enforceIntentPolicy = (response: AiCommandResponse): AiCommandResponse => {
  if (response.done) {
    return { ...response, commands: [] };
  }
  if (response.intent === 'command') {
    if (response.commands.length > 0) {
      return response;
    }
    if (response.action && actionCommandMap[response.action]) {
      return { ...response, commands: [actionCommandMap[response.action]] };
    }
    return response;
  }
  return {
    ...response,
    commands: []
  };
};

const extractStreamingPayload = (text: string) => {
  const marker = text.indexOf('JSON:');
  if (marker === -1) {
    return { messageText: text.trim(), jsonText: null };
  }
  const messageText = text.slice(0, marker).trim();
  const jsonText = text.slice(marker + 'JSON:'.length).trim();
  return { messageText, jsonText };
};

const filterStreamingText = (delta: string, state: StreamFilterState): string | null => {
  if (state.jsonStarted) {
    return null;
  }
  state.pending += delta;
  const markerIndex = state.pending.indexOf(JSON_MARKER);
  if (markerIndex !== -1) {
    const beforeMarker = state.pending.slice(0, markerIndex);
    state.pending = '';
    state.jsonStarted = true;
    return beforeMarker || null;
  }

  const sendLength = Math.max(0, state.pending.length - JSON_TAIL_LEN);
  if (sendLength === 0) {
    return null;
  }
  const sendText = state.pending.slice(0, sendLength);
  state.pending = state.pending.slice(sendLength);
  return sendText;
};

export class AssistantService {
  private lastAgentSender?: WebContents;
  private readonly runner: AgentRunner;

  constructor(private readonly sshPtyService: SshPtyService) {
    this.runner = new AgentRunner({
      buildPrompt: buildAgentPrompt,
      streamAssistant: (sessionId, prompt, model, outputLimit, onChunk) =>
        this.streamAssistantRaw(sessionId, prompt, model, outputLimit, onChunk),
      parseAssistant: (rawText) => this.parseAssistant(rawText),
      executeCommand: (sessionId, command, toolCallId) =>
        this.sshPtyService.executeCommandAndWait(sessionId, command, toolCallId),
      executeInteractiveCommand: (sessionId, command) =>
        this.sshPtyService.sendInput({ sessionId, data: `${command}\n` }),
      emitEvent: (event) => this.sendAgentEvent(event)
    });
  }

  handleAgentAction(action: AgentAction, sender: WebContents): void {
    this.lastAgentSender = sender;
    console.info('[AgentAction]', action.kind, action.sessionId);

    this.runner.handleAction(action);
  }

  sendAgentEvent(event: AgentEvent, sender?: WebContents): void {
    const target = sender ?? this.lastAgentSender;
    if (!target) {
      return;
    }
    target.send(IpcChannels.assistantAgentEvent, event);
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const outputResponse = this.sshPtyService.getRecentOutput({
      sessionId: request.sessionId,
      limit: request.outputLimit
    });

    const sessionContext = this.resolveSessionContext(request);
    const system = buildSystemPrompt(outputResponse.output, outputResponse.truncated, sessionContext);
    const user = buildUserPrompt(request.prompt);
    const provider = resolveProvider(request.model);

    const rawText =
      provider === 'openai'
        ? await this.requestOpenAi(request.model, system, user)
        : await this.requestAnthropic(request.model, system, user);

    const response = parseJsonFromText(rawText);
    return { response: enforceIntentPolicy(response), rawText };
  }

  async stream(request: AiStreamStartRequest, sender: WebContents): Promise<void> {
    const outputResponse = this.sshPtyService.getRecentOutput({
      sessionId: request.sessionId,
      limit: request.outputLimit
    });

    const sessionContext = this.resolveSessionContext(request);
    const system = buildStreamingSystemPrompt(outputResponse.output, outputResponse.truncated, sessionContext);
    const user = buildUserPrompt(request.prompt);
    const provider = resolveProvider(request.model);

    try {
      const rawText =
        provider === 'openai'
          ? await this.streamOpenAi(request, system, user, sender)
          : await this.streamAnthropic(request, system, user, sender);

      const { messageText, jsonText } = extractStreamingPayload(rawText);
      const response = jsonText ? parseJsonFromText(jsonText) : parseJsonFromText(rawText);
      if (messageText && !response.message) {
        response.message = messageText;
      }
      const normalizedResponse = enforceIntentPolicy(response);
      const payload: AiStreamCompleteEvent = {
        requestId: request.requestId,
        sessionId: request.sessionId,
        response: normalizedResponse,
        rawText
      };
      sender.send(IpcChannels.assistantStreamComplete, payload);
    } catch (error) {
      const payload: AiStreamErrorEvent = {
        requestId: request.requestId,
        sessionId: request.sessionId,
        error: error instanceof Error ? error.message : 'AI stream failed.'
      };
      sender.send(IpcChannels.assistantStreamError, payload);
    }
  }

  private async requestOpenAi(model: AiModel, system: string, user: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY || (await getAiKey('openai'));
    if (!apiKey) {
      throw new Error('Missing OpenAI API key. Set it in Settings.');
    }

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: system }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: user }]
          }
        ],
        text: {
          format: { type: 'json_object' }
        },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    const content = data?.output?.[0]?.content?.[0]?.text;
    if (typeof content === 'string') {
      return content;
    }
    throw new Error('OpenAI response missing text output.');
  }

  private async requestAnthropic(model: AiModel, system: string, user: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY || (await getAiKey('anthropic'));
    if (!apiKey) {
      throw new Error('Missing Anthropic API key. Set it in Settings.');
    }

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.2,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text;
    if (typeof content === 'string') {
      return content;
    }
    throw new Error('Anthropic response missing text output.');
  }

  private async streamOpenAi(
    request: AiStreamStartRequest,
    system: string,
    user: string,
    sender?: WebContents,
    onChunk?: StreamChunkHandler
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY || (await getAiKey('openai'));
    if (!apiKey) {
      throw new Error('Missing OpenAI API key. Set it in Settings.');
    }

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        stream: true,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: system }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: user }]
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let rawText = '';
    let buffer = '';
    const streamState: StreamFilterState = { pending: '', jsonStarted: false };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') {
          if (!streamState.jsonStarted && streamState.pending) {
            onChunk?.(streamState.pending);
            if (!onChunk && sender) {
              sender.send(IpcChannels.assistantStreamChunk, {
                requestId: request.requestId,
                sessionId: request.sessionId,
                text: streamState.pending
              });
            }
            streamState.pending = '';
          }
          return rawText;
        }
        try {
          const parsed = JSON.parse(payload);
          const delta =
            typeof parsed?.delta === 'string' && parsed?.type?.includes('output_text.delta')
              ? parsed.delta
              : undefined;
          if (delta) {
            rawText += delta;
            const filtered = filterStreamingText(delta, streamState);
            if (filtered) {
              onChunk?.(filtered);
              if (!onChunk && sender) {
                sender.send(IpcChannels.assistantStreamChunk, {
                  requestId: request.requestId,
                  sessionId: request.sessionId,
                  text: filtered
                });
              }
            }
          }
        } catch {
          // Ignore parse errors for non-JSON events.
        }
      }
    }

    return rawText;
  }

  private async streamAnthropic(
    request: AiStreamStartRequest,
    system: string,
    user: string,
    sender?: WebContents,
    onChunk?: StreamChunkHandler
  ): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY || (await getAiKey('anthropic'));
    if (!apiKey) {
      throw new Error('Missing Anthropic API key. Set it in Settings.');
    }

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        system,
        stream: true,
        messages: [{ role: 'user', content: user }],
        temperature: 0.2,
        max_tokens: 800
      })
    });

    if (!response.ok || !response.body) {
      const detail = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${detail}`);
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let rawText = '';
    let buffer = '';
    const streamState: StreamFilterState = { pending: '', jsonStarted: false };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') {
          if (!streamState.jsonStarted && streamState.pending) {
            onChunk?.(streamState.pending);
            if (!onChunk && sender) {
              sender.send(IpcChannels.assistantStreamChunk, {
                requestId: request.requestId,
                sessionId: request.sessionId,
                text: streamState.pending
              });
            }
            streamState.pending = '';
          }
          return rawText;
        }
        try {
          const parsed = JSON.parse(payload);
          if (parsed?.type === 'content_block_delta' && typeof parsed?.delta?.text === 'string') {
            rawText += parsed.delta.text;
            const filtered = filterStreamingText(parsed.delta.text, streamState);
            if (filtered) {
              onChunk?.(filtered);
              if (!onChunk && sender) {
                sender.send(IpcChannels.assistantStreamChunk, {
                  requestId: request.requestId,
                  sessionId: request.sessionId,
                  text: filtered
                });
              }
            }
          }
        } catch {
          // Ignore parse errors for non-JSON events.
        }
      }
    }

    return rawText;
  }

  private resolveSessionContext(request: AiGenerateRequest) {
    if (request.session) {
      return request.session;
    }
    const session = this.sshPtyService.getSessionContext(request.sessionId);
    if (!session) {
      throw new Error('SSH session context not found.');
    }
    return session;
  }

  private async streamAssistantRaw(
    sessionId: string,
    prompt: string,
    model: AiModel,
    outputLimit: number,
    onChunk: StreamChunkHandler
  ): Promise<string> {
    const outputResponse = this.sshPtyService.getRecentOutput({
      sessionId,
      limit: outputLimit
    });
    const sessionContext = this.resolveSessionContext({ sessionId, prompt, model });
    const system = buildStreamingSystemPrompt(outputResponse.output, outputResponse.truncated, sessionContext);
    const user = buildUserPrompt(prompt);
    const provider = resolveProvider(model);

    return provider === 'openai'
      ? await this.streamOpenAi(
          { requestId: randomUUID(), sessionId, prompt, model, outputLimit },
          system,
          user,
          undefined,
          onChunk
        )
      : await this.streamAnthropic(
          { requestId: randomUUID(), sessionId, prompt, model, outputLimit },
          system,
          user,
          undefined,
          onChunk
        );
  }

  private parseAssistant(rawText: string) {
    const { messageText, jsonText } = extractStreamingPayload(rawText);
    const parsedResponse = jsonText ? parseJsonFromText(jsonText) : parseJsonFromText(rawText);
    if (messageText && !parsedResponse.message) {
      parsedResponse.message = messageText;
    }
    return { response: enforceIntentPolicy(parsedResponse), messageText };
  }
}
