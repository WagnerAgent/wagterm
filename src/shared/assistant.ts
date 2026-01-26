export type AiCommandRisk = 'low' | 'medium' | 'high';

export type AiModel =
  | 'gpt-5.2'
  | 'gpt-5-mini'
  | 'claude-sonnet-4.5'
  | 'claude-opus-4.5'
  | 'claude-haiku-4.5';

export type AiSessionContext = {
  id: string;
  name?: string;
  host: string;
  username: string;
  port: number;
};

export type AiCommandProposal = {
  id?: string;
  command: string;
  rationale?: string;
  risk?: AiCommandRisk;
  requiresApproval: boolean;
  interactive?: boolean;
};

export type AiCommandResponse = {
  commands: AiCommandProposal[];
  message?: string;
  intent?: 'chat' | 'plan' | 'command';
  plan?: string[];
  action?:
    | 'inspect_services'
    | 'inspect_ports'
    | 'inspect_disk'
    | 'inspect_memory'
    | 'inspect_cpu'
    | 'inspect_updates'
    | 'inspect_logs'
    | 'inspect_processes'
    | 'fix_issue'
    | 'deploy'
    | 'configure'
    | 'security'
    | 'network'
    | 'unknown';
  done?: boolean;
};

export type AiGenerateRequest = {
  sessionId: string;
  prompt: string;
  model: AiModel;
  session?: AiSessionContext;
  outputLimit?: number;
};

export type AiGenerateResponse = {
  response: AiCommandResponse;
  rawText?: string;
};

export type AiStreamStartRequest = AiGenerateRequest & {
  requestId: string;
};

export type AiStreamChunkEvent = {
  requestId: string;
  sessionId: string;
  text: string;
};

export type AiStreamCompleteEvent = {
  requestId: string;
  sessionId: string;
  response: AiCommandResponse;
  rawText?: string;
};

export type AiStreamErrorEvent = {
  requestId: string;
  sessionId: string;
  error: string;
};

export const AI_COMMAND_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string' },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          command: { type: 'string' },
          rationale: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          requiresApproval: { type: 'boolean' },
          interactive: { type: 'boolean' }
        },
        required: ['command']
      }
    },
    intent: { type: 'string', enum: ['chat', 'plan', 'command'] },
    plan: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    action: {
      type: 'string',
      enum: [
        'inspect_services',
        'inspect_ports',
        'inspect_disk',
        'inspect_memory',
        'inspect_cpu',
        'inspect_updates',
        'inspect_logs',
        'inspect_processes',
        'fix_issue',
        'deploy',
        'configure',
        'security',
        'network',
        'unknown'
      ]
    },
    done: { type: 'boolean' }
  },
  required: ['commands']
} as const;

export const AI_COMMAND_RESPONSE_EXAMPLE: AiCommandResponse = {
  message: 'I can check disk usage first.',
  intent: 'command',
  plan: ['Check current disk usage', 'Identify large directories', 'Recommend cleanup steps'],
  action: 'inspect_disk',
  done: false,
  commands: [
    {
      id: 'disk-usage',
      command: 'df -h',
      rationale: 'Shows filesystem usage in human-readable format.',
      risk: 'low',
      requiresApproval: true,
      interactive: false
    }
  ]
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeRisk = (value: unknown): AiCommandRisk | undefined => {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return undefined;
};

export const parseAiCommandResponse = (input: unknown): AiCommandResponse => {
  if (!isObject(input) || !Array.isArray(input.commands)) {
    return { commands: [] };
  }

  const message = typeof input.message === 'string' ? input.message : undefined;
  const intent =
    input.intent === 'chat' || input.intent === 'plan' || input.intent === 'command'
      ? input.intent
      : undefined;
  const plan =
    Array.isArray(input.plan) && input.plan.length > 0
      ? input.plan
          .filter((item) => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .slice(0, 6)
      : undefined;
  const action =
    input.action === 'inspect_services' ||
    input.action === 'inspect_ports' ||
    input.action === 'inspect_disk' ||
    input.action === 'inspect_memory' ||
    input.action === 'inspect_cpu' ||
    input.action === 'inspect_updates' ||
    input.action === 'inspect_logs' ||
    input.action === 'inspect_processes' ||
    input.action === 'fix_issue' ||
    input.action === 'deploy' ||
    input.action === 'configure' ||
    input.action === 'security' ||
    input.action === 'network' ||
    input.action === 'unknown'
      ? input.action
      : undefined;
  const done = typeof input.done === 'boolean' ? input.done : undefined;
  const commands: AiCommandProposal[] = [];

  for (const item of input.commands) {
    if (!isObject(item)) {
      continue;
    }
    const command = typeof item.command === 'string' ? item.command.trim() : '';
    if (!command) {
      continue;
    }
    commands.push({
      id: typeof item.id === 'string' ? item.id : undefined,
      command,
      rationale: typeof item.rationale === 'string' ? item.rationale : undefined,
      risk: normalizeRisk(item.risk),
      requiresApproval: typeof item.requiresApproval === 'boolean' ? item.requiresApproval : true,
      interactive: typeof item.interactive === 'boolean' ? item.interactive : undefined
    });
  }

  return { commands, message, intent, plan, action, done };
};
