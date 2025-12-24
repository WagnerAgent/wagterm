import type { AiModel } from './assistant';

export const AGENT_IPC_VERSION = 1 as const;

export type AgentState =
  | 'idle'
  | 'intent'
  | 'plan'
  | 'act'
  | 'observe'
  | 'reflect'
  | 'finish'
  | 'error';

export type AgentMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export type AgentPlanStep = {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
};

export type AgentToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  requiresApproval: boolean;
  risk?: 'low' | 'medium' | 'high';
};

export type AgentToolResult = {
  toolCallId: string;
  status: 'success' | 'error' | 'cancelled';
  output?: string;
  error?: string;
};

type AgentEventBase = {
  version: typeof AGENT_IPC_VERSION;
  sessionId: string;
  timestamp: number;
};

export type AgentEvent =
  | (AgentEventBase & {
      kind: 'message';
      messageId: string;
      role: AgentMessageRole;
      content: string;
      partial?: boolean;
    })
  | (AgentEventBase & {
      kind: 'plan_updated';
      planId: string;
      steps: AgentPlanStep[];
    })
  | (AgentEventBase & {
      kind: 'tool_requested';
      toolCall: AgentToolCall;
    })
  | (AgentEventBase & {
      kind: 'tool_result';
      result: AgentToolResult;
    })
  | (AgentEventBase & {
      kind: 'waiting_for_approval';
      toolCallId: string;
    })
  | (AgentEventBase & {
      kind: 'state_changed';
      state: AgentState;
      detail?: string;
    });

type AgentActionBase = {
  version: typeof AGENT_IPC_VERSION;
  sessionId: string;
};

export type AgentAction =
  | (AgentActionBase & {
      kind: 'user_message';
      messageId: string;
      content: string;
      model?: AiModel;
      maxSteps?: number;
    })
  | (AgentActionBase & {
      kind: 'approve_tool';
      toolCallId: string;
    })
  | (AgentActionBase & {
      kind: 'reject_tool';
      toolCallId: string;
      reason?: string;
    })
  | (AgentActionBase & {
      kind: 'cancel';
      reason?: string;
    })
  | (AgentActionBase & {
      kind: 'provide_context';
      context: Record<string, unknown>;
    });

export const AGENT_EVENT_EXAMPLE: AgentEvent = {
  version: AGENT_IPC_VERSION,
  kind: 'tool_requested',
  sessionId: 'session-123',
  timestamp: 1730000000000,
  toolCall: {
    id: 'tool-abc',
    name: 'execute_command',
    input: { command: 'df -h' },
    requiresApproval: true,
    risk: 'low'
  }
};

export const AGENT_ACTION_EXAMPLE: AgentAction = {
  version: AGENT_IPC_VERSION,
  kind: 'approve_tool',
  sessionId: 'session-123',
  toolCallId: 'tool-abc'
};
