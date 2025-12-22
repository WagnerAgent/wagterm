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
};

export type AiCommandResponse = {
  commands: AiCommandProposal[];
  message?: string;
};

export type AiGenerateRequest = {
  sessionId: string;
  prompt: string;
  model: AiModel;
  session: AiSessionContext;
  outputLimit?: number;
};

export type AiGenerateResponse = {
  response: AiCommandResponse;
  rawText?: string;
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
          requiresApproval: { type: 'boolean' }
        },
        required: ['command']
      }
    }
  },
  required: ['commands']
} as const;

export const AI_COMMAND_RESPONSE_EXAMPLE: AiCommandResponse = {
  message: 'Here are the safe steps to check disk usage.',
  commands: [
    {
      id: 'disk-usage',
      command: 'df -h',
      rationale: 'Shows filesystem usage in human-readable format.',
      risk: 'low',
      requiresApproval: true
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
      requiresApproval: typeof item.requiresApproval === 'boolean' ? item.requiresApproval : true
    });
  }

  return { commands, message };
};
