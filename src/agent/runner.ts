import { randomUUID } from 'crypto';
import type { AgentAction, AgentEvent, AgentPlanStep } from '../shared/agent-ipc';
import type { AiCommandProposal, AiCommandResponse, AiModel } from '../shared/assistant';

type AgentSessionState = {
  sessionId: string;
  state: AgentEvent['state'];
  goal?: string;
  step: number;
  model: AiModel;
  maxSteps: number;
};

type StreamResult = {
  response: AiCommandResponse;
  messageText?: string;
  rawText: string;
  streamedText: string;
};

type AgentRunnerDeps = {
  buildPrompt: (goal: string, step: number, note?: string) => string;
  streamAssistant: (
    sessionId: string,
    prompt: string,
    model: AiModel,
    outputLimit: number,
    onChunk: (text: string) => void
  ) => Promise<string>;
  parseAssistant: (rawText: string) => { response: AiCommandResponse; messageText?: string };
  executeCommand: (
    sessionId: string,
    command: string,
    toolCallId: string
  ) => Promise<{ output: string; exitCode: number }>;
  emitEvent: (event: AgentEvent) => void;
};

export class AgentRunner {
  private readonly proposalsBySession = new Map<string, Map<string, AiCommandProposal>>();
  private readonly sessions = new Map<string, AgentSessionState>();
  private readonly planBySession = new Map<string, AgentPlanStep[]>();

  constructor(private readonly deps: AgentRunnerDeps) {}

  handleAction(action: AgentAction): void {
    if (action.kind === 'user_message') {
      void this.handleUserMessage(action);
      return;
    }
    if (action.kind === 'approve_tool') {
      void this.handleApproveTool(action);
      return;
    }
    if (action.kind === 'reject_tool') {
      this.handleRejectTool(action);
      return;
    }
    if (action.kind === 'cancel') {
      this.updateState(action.sessionId, 'finish', 'Cancelled by user.');
    }
  }

  private updateState(sessionId: string, state: AgentSessionState['state'], detail?: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = state;
    }
    this.deps.emitEvent({
      version: 1,
      kind: 'state_changed',
      sessionId,
      timestamp: Date.now(),
      state,
      detail
    });
  }

  private async handleUserMessage(action: Extract<AgentAction, { kind: 'user_message' }>) {
    const model = action.model ?? 'gpt-5.2';
    const session: AgentSessionState = {
      sessionId: action.sessionId,
      state: 'intent',
      goal: action.content,
      step: 0,
      model,
      maxSteps: action.maxSteps ?? 8
    };

    this.sessions.set(action.sessionId, session);
    this.planBySession.set(action.sessionId, []);
    this.emitPlanUpdate(action.sessionId);
    this.updateState(action.sessionId, 'intent', 'User intent received.');

    await this.runStep(session, 'Initial user request.');
  }

  private async runStep(session: AgentSessionState, note?: string) {
    if (session.step >= session.maxSteps) {
      this.updateState(session.sessionId, 'finish', 'Max step limit reached.');
      return;
    }

    this.updateState(session.sessionId, 'plan', `Planning step ${session.step + 1}.`);

    const messageId = randomUUID();
    let streamedText = '';
    const onChunk = (text: string) => {
      streamedText += text;
      this.deps.emitEvent({
        version: 1,
        kind: 'message',
        sessionId: session.sessionId,
        timestamp: Date.now(),
        messageId,
        role: 'assistant',
        content: streamedText,
        partial: true
      });
    };

    const prompt = this.deps.buildPrompt(session.goal ?? '', session.step, note);
    let rawText = '';
    try {
      rawText = await this.deps.streamAssistant(
        session.sessionId,
        prompt,
        session.model,
        4000,
        onChunk
      );
    } catch (error) {
      this.updateState(session.sessionId, 'error', 'Assistant stream failed.');
      this.deps.emitEvent({
        version: 1,
        kind: 'message',
        sessionId: session.sessionId,
        timestamp: Date.now(),
        messageId,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'AI request failed.'
      });
      return;
    }

    const { response, messageText } = this.deps.parseAssistant(rawText);
    const result: StreamResult = {
      response: this.trackProposals(session.sessionId, response),
      messageText,
      rawText,
      streamedText
    };

    const finalMessage =
      result.streamedText || result.response.message || result.messageText || 'AI response received.';

    this.deps.emitEvent({
      version: 1,
      kind: 'message',
      sessionId: session.sessionId,
      timestamp: Date.now(),
      messageId,
      role: 'assistant',
      content: finalMessage,
      partial: false
    });

    if (result.response.done || result.response.commands.length === 0) {
      this.updateState(session.sessionId, 'finish', 'Agent marked task complete.');
      return;
    }

    const proposal = result.response.commands[0];
    const toolCallId = proposal.id ?? randomUUID();
    this.addPlanStep(session.sessionId, toolCallId, `Run: ${proposal.command}`);
    this.updateState(session.sessionId, 'act', 'Awaiting command approval.');
    this.deps.emitEvent({
      version: 1,
      kind: 'tool_requested',
      sessionId: session.sessionId,
      timestamp: Date.now(),
      toolCall: {
        id: toolCallId,
        name: 'execute_command',
        input: { command: proposal.command },
        requiresApproval: proposal.requiresApproval,
        risk: proposal.risk
      }
    });
    this.deps.emitEvent({
      version: 1,
      kind: 'waiting_for_approval',
      sessionId: session.sessionId,
      timestamp: Date.now(),
      toolCallId
    });
  }

  private trackProposals(sessionId: string, response: AiCommandResponse): AiCommandResponse {
    if (!response.commands.length) {
      this.proposalsBySession.delete(sessionId);
      return response;
    }

    const commands = response.commands.map((command) => ({
      ...command,
      id: command.id ?? randomUUID()
    }));

    this.proposalsBySession.set(sessionId, new Map(commands.map((command) => [command.id!, command])));

    return { ...response, commands };
  }

  private async handleApproveTool(action: Extract<AgentAction, { kind: 'approve_tool' }>) {
    const proposals = this.proposalsBySession.get(action.sessionId);
    const proposal = proposals?.get(action.toolCallId);

    if (!proposal) {
      this.deps.emitEvent({
        version: 1,
        kind: 'tool_result',
        sessionId: action.sessionId,
        timestamp: Date.now(),
        result: {
          toolCallId: action.toolCallId,
          status: 'error',
          error: 'Command proposal not found.'
        }
      });
      return;
    }

    try {
      this.setPlanStepStatus(action.sessionId, action.toolCallId, 'in_progress');
      this.updateState(action.sessionId, 'observe', 'Command running.');
      const result = await this.deps.executeCommand(action.sessionId, proposal.command, action.toolCallId);
      const formattedOutput = this.formatCommandOutput(result.output);
      this.deps.emitEvent({
        version: 1,
        kind: 'tool_result',
        sessionId: action.sessionId,
        timestamp: Date.now(),
        result: {
          toolCallId: action.toolCallId,
          status: 'success',
          output: this.formatToolResult(proposal.command, result.exitCode, formattedOutput)
        }
      });
      this.setPlanStepStatus(action.sessionId, action.toolCallId, 'done');
      const session = this.sessions.get(action.sessionId);
      if (session) {
        session.step += 1;
        this.updateState(action.sessionId, 'reflect', 'Evaluating command output.');
        const note = formattedOutput
          ? `Command completed: ${proposal.command}\nExit code: ${result.exitCode}\nOutput:\n${formattedOutput}`
          : `Command completed: ${proposal.command}\nExit code: ${result.exitCode}`;
        void this.runStep(session, note);
      }
    } catch (error) {
      this.setPlanStepStatus(action.sessionId, action.toolCallId, 'blocked');
      this.updateState(action.sessionId, 'error', 'Command execution failed.');
      this.deps.emitEvent({
        version: 1,
        kind: 'tool_result',
        sessionId: action.sessionId,
        timestamp: Date.now(),
        result: {
          toolCallId: action.toolCallId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Command execution failed.'
        }
      });
    }
  }

  private handleRejectTool(action: Extract<AgentAction, { kind: 'reject_tool' }>) {
    this.updateState(action.sessionId, 'finish', 'Command rejected.');
    this.setPlanStepStatus(action.sessionId, action.toolCallId, 'blocked');
    this.deps.emitEvent({
      version: 1,
      kind: 'tool_result',
      sessionId: action.sessionId,
      timestamp: Date.now(),
      result: {
        toolCallId: action.toolCallId,
        status: 'cancelled',
        error: action.reason
      }
    });
  }

  private addPlanStep(sessionId: string, stepId: string, description: string) {
    const steps = this.planBySession.get(sessionId) ?? [];
    steps.push({ id: stepId, description, status: 'pending' });
    this.planBySession.set(sessionId, steps);
    this.emitPlanUpdate(sessionId);
  }

  private setPlanStepStatus(sessionId: string, stepId: string, status: AgentPlanStep['status']) {
    const steps = this.planBySession.get(sessionId);
    if (!steps) {
      return;
    }
    const updated = steps.map((step) => (step.id === stepId ? { ...step, status } : step));
    this.planBySession.set(sessionId, updated);
    this.emitPlanUpdate(sessionId);
  }

  private emitPlanUpdate(sessionId: string) {
    const steps = this.planBySession.get(sessionId) ?? [];
    this.deps.emitEvent({
      version: 1,
      kind: 'plan_updated',
      sessionId,
      timestamp: Date.now(),
      planId: `plan-${sessionId}`,
      steps
    });
  }

  private formatCommandOutput(output: string, maxChars = 4000): string {
    const trimmed = output.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.length <= maxChars) {
      return trimmed;
    }
    return `${trimmed.slice(0, maxChars)}\n... (truncated)`;
  }

  private formatToolResult(command: string, exitCode: number, output: string): string {
    const lines = [`Completed: ${command}`, `Exit code: ${exitCode}`];
    if (output) {
      lines.push('Output:', output);
    }
    return lines.join('\n');
  }
}
