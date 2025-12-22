export type AgentDecisionType = 'propose-command' | 'inform' | 'ask';

export type CommandProposal = {
  id: string;
  command: string;
  rationale: string;
  requiresApproval: boolean;
};

export type AgentDecision = {
  type: AgentDecisionType;
  message: string;
  proposal?: CommandProposal;
};

export type AgentContext = {
  connectionId?: string;
  workingDirectory?: string;
};
