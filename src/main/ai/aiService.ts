import type { AiCommandResponse, AiGenerateRequest, AiGenerateResponse, AiModel } from '../../shared/ai';
import { AI_COMMAND_RESPONSE_EXAMPLE, AI_COMMAND_RESPONSE_SCHEMA, parseAiCommandResponse } from '../../shared/ai';
import type { SshPtyService } from '../ssh/sshPtyService';

type Provider = 'openai' | 'anthropic';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const resolveProvider = (model: AiModel): Provider =>
  model.startsWith('gpt-') ? 'openai' : 'anthropic';

const buildSystemPrompt = (output: string, truncated: boolean, session: AiGenerateRequest['session']) => {
  const outputNote = truncated ? ' (truncated)' : '';
  return [
    'You are Wagterm AI, an SSH assistant.',
    'Return only valid JSON that matches the schema.',
    'Never execute commands; only propose commands for approval.',
    `Session: ${session.username}@${session.host}:${session.port}${session.name ? ` (${session.name})` : ''}`,
    `Recent terminal output${outputNote}:`,
    output || '(no output yet)',
    'Schema:',
    JSON.stringify(AI_COMMAND_RESPONSE_SCHEMA),
    'Example:',
    JSON.stringify(AI_COMMAND_RESPONSE_EXAMPLE)
  ].join('\n');
};

const buildUserPrompt = (prompt: string) => {
  return `User request:\n${prompt}`;
};

const parseJsonFromText = (text: string): AiCommandResponse => {
  try {
    const parsed = JSON.parse(text);
    return parseAiCommandResponse(parsed);
  } catch {
    return { commands: [], message: text.trim() || 'Unable to parse AI response.' };
  }
};

export class AiService {
  constructor(private readonly sshPtyService: SshPtyService) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const outputResponse = this.sshPtyService.getRecentOutput({
      sessionId: request.sessionId,
      limit: request.outputLimit
    });

    const system = buildSystemPrompt(outputResponse.output, outputResponse.truncated, request.session);
    const user = buildUserPrompt(request.prompt);
    const provider = resolveProvider(request.model);

    const rawText =
      provider === 'openai'
        ? await this.requestOpenAi(request.model, system, user)
        : await this.requestAnthropic(request.model, system, user);

    const response = parseJsonFromText(rawText);
    return { response, rawText };
  }

  private async requestOpenAi(model: AiModel, system: string, user: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY for AI requests.');
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
            content: [{ type: 'text', text: system }]
          },
          {
            role: 'user',
            content: [{ type: 'text', text: user }]
          }
        ],
        response_format: { type: 'json_object' },
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY for AI requests.');
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
}
