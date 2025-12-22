import type { AgentContext, AgentDecision } from './types';

export class AgentOrchestrator {
  async decide(input: string, context: AgentContext): Promise<AgentDecision> {
    return {
      type: 'inform',
      message: `Agent stub received: ${input}`,
      proposal: {
        id: 'placeholder',
        command: 'echo "TODO"',
        rationale: 'Placeholder for command planning.',
        requiresApproval: true
      }
    };
  }
}
