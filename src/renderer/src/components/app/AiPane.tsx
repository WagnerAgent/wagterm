import React from 'react';
import { ArrowRight, ChevronDown, Terminal as TerminalIcon } from 'lucide-react';
import { Button } from '../ui/button';
import type { CommandProposal, TerminalSession } from './types';
import type { AgentPlanStep } from '../../../shared/agent-ipc';

type AiPaneProps = {
  session: TerminalSession;
  conversationMessages: Map<
    string,
    Array<{ id?: string; role: 'user' | 'assistant'; kind: 'text' | 'proposal'; content?: string; proposal?: CommandProposal }>
  >;
  planStepsBySession: Map<string, AgentPlanStep[]>;
  conversationInput: string;
  setConversationInput: (value: string) => void;
  selectedModel: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5';
  setSelectedModel: (value: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5') => void;
  handleSendConversation: () => void;
  handleApproveCommand: (sessionId: string, proposalId: string) => void;
  handleRejectCommand: (sessionId: string, proposalId: string) => void;
};

const AiPane = ({
  session,
  conversationMessages,
  planStepsBySession,
  conversationInput,
  setConversationInput,
  selectedModel,
  setSelectedModel,
  handleSendConversation,
  handleApproveCommand,
  handleRejectCommand
}: AiPaneProps) => {
  const messages = conversationMessages.get(session.id) ?? [];
  const planSteps = planStepsBySession.get(session.id) ?? [];

  return (
    <aside className="w-96 bg-card flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {planSteps.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Plan</div>
            <ul className="space-y-1">
              {planSteps.map((step) => (
                <li key={step.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`mt-0.5 h-2 w-2 rounded-full ${
                      step.status === 'done'
                        ? 'bg-emerald-400'
                        : step.status === 'in_progress'
                          ? 'bg-yellow-400'
                          : step.status === 'blocked'
                            ? 'bg-red-400'
                            : 'bg-muted-foreground/60'
                    }`}
                  />
                  <span className="text-foreground">{step.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="bg-muted/50 rounded-full p-4 mb-4">
              <TerminalIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-sm font-semibold mb-2">Start a conversation</h4>
            <p className="text-xs text-muted-foreground">
              Ask me to help you with commands, explain what's happening, or generate scripts for your tasks.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id ?? idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.kind === 'proposal' && msg.proposal ? (
                <div className="rounded-lg border border-border bg-card p-3 space-y-2 max-w-[85%]">
                  <div className="flex items-start justify-between gap-2">
                    <code className="text-xs text-foreground font-mono break-all">{msg.proposal.command}</code>
                    {msg.proposal.risk && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          msg.proposal.risk === 'high'
                            ? 'bg-red-500/20 text-red-200'
                            : msg.proposal.risk === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-200'
                              : 'bg-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        {msg.proposal.risk}
                      </span>
                    )}
                  </div>

                  {msg.proposal.rationale && <p className="text-xs text-muted-foreground">{msg.proposal.rationale}</p>}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveCommand(session.id, msg.proposal!.id)}
                      disabled={msg.proposal.status !== 'pending'}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectCommand(session.id, msg.proposal!.id)}
                      disabled={msg.proposal.status !== 'pending'}
                    >
                      Reject
                    </Button>
                    {msg.proposal.status !== 'pending' && (
                      <span className="text-[11px] uppercase text-muted-foreground">{msg.proposal.status}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-lg px-4 py-2 max-w-[85%] ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="bg-muted/50 rounded-xl p-3 border border-border">
          <div className="flex flex-col gap-2">
            <textarea
              placeholder="Ask anything"
              className="w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none px-2 py-1 text-sm text-foreground resize-none min-h-[32px] max-h-32 overflow-y-auto"
              value={conversationInput}
              onChange={(event) => setConversationInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendConversation();
                }
              }}
              rows={1}
              onInput={(event) => {
                const target = event.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />

            <div className="flex items-center justify-end gap-2 px-2">
              <div className="relative">
                <select
                  className="appearance-none bg-transparent text-xs text-muted-foreground pr-4 py-1 cursor-pointer focus:outline-none"
                  value={selectedModel}
                  onChange={(event) =>
                    setSelectedModel(
                      event.target.value as 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5'
                    )
                  }
                >
                  <optgroup label="OpenAI">
                    <option value="gpt-5.2">GPT-5.2</option>
                    <option value="gpt-5-mini">GPT-5 Mini</option>
                  </optgroup>
                  <optgroup label="Anthropic">
                    <option value="claude-opus-4.5">Claude Opus 4.5</option>
                    <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                    <option value="claude-haiku-4.5">Claude Haiku 4.5</option>
                  </optgroup>
                </select>
                <ChevronDown className="h-2.5 w-2.5 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>

              <Button
                onClick={handleSendConversation}
                size="icon"
                className="h-7 w-7 rounded-lg flex-shrink-0"
                disabled={!conversationInput.trim()}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AiPane;
