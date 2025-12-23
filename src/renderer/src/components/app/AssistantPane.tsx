import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Terminal as TerminalIcon } from 'lucide-react';
import { Button } from '../ui/button';
import type { CommandProposal, TerminalSession } from './types';
import type { AgentPlanStep } from '../../../shared/agent-ipc';

type AssistantPaneProps = {
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

const AssistantPane = ({
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
}: AssistantPaneProps) => {
  const messages = conversationMessages.get(session.id) ?? [];
  const planSteps = planStepsBySession.get(session.id) ?? [];
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveLevel, setAutoApproveLevel] = useState<'low' | 'high'>('low');
  const [autoApproveMenuOpen, setAutoApproveMenuOpen] = useState(false);
  const autoApproveMenuRef = useRef<HTMLDivElement | null>(null);
  const autoApprovedRef = useRef<Set<string>>(new Set());

  const shouldAutoApprove = (risk?: CommandProposal['risk']) => {
    if (!risk) {
      return false;
    }
    if (autoApproveLevel === 'high') {
      return true;
    }
    return risk === 'low';
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const scrollToEnd = () => {
      container.scrollTop = container.scrollHeight;
      scrollEndRef.current?.scrollIntoView({ block: 'end' });
    };
    requestAnimationFrame(() => {
      scrollToEnd();
      requestAnimationFrame(scrollToEnd);
    });
  }, [messages.length, planSteps.length]);

  useEffect(() => {
    if (!autoApproveMenuOpen) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (!autoApproveMenuRef.current) {
        return;
      }
      if (!autoApproveMenuRef.current.contains(event.target as Node)) {
        setAutoApproveMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAutoApproveMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [autoApproveMenuOpen]);

  useEffect(() => {
    if (!autoApproveEnabled) {
      autoApprovedRef.current.clear();
      return;
    }

    const pendingProposals = messages
      .filter((msg) => msg.kind === 'proposal' && msg.proposal && msg.proposal.status === 'pending')
      .map((msg) => msg.proposal!);

    const pendingIds = new Set(pendingProposals.map((proposal) => proposal.id));

    for (const proposal of pendingProposals) {
      if (!shouldAutoApprove(proposal.risk)) {
        continue;
      }
      if (autoApprovedRef.current.has(proposal.id)) {
        continue;
      }
      autoApprovedRef.current.add(proposal.id);
      handleApproveCommand(session.id, proposal.id);
    }

    for (const proposalId of autoApprovedRef.current) {
      if (!pendingIds.has(proposalId)) {
        autoApprovedRef.current.delete(proposalId);
      }
    }
  }, [autoApproveEnabled, autoApproveLevel, handleApproveCommand, messages, session.id]);

  return (
    <aside className="w-96 bg-card flex flex-col">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <>
            {messages.map((msg, idx) => (
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

                    {msg.proposal.statusMessage && (
                      <div className="text-[11px] text-muted-foreground">{msg.proposal.statusMessage}</div>
                    )}
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
            ))}
            <div ref={scrollEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-border">
        {planSteps.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-3 mb-3 space-y-2">
            <button
              type="button"
              onClick={() => setPlanExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground"
            >
              Plan
              <ChevronDown
                className={`h-3 w-3 transition-transform ${planExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            {planExpanded && (
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
            )}
          </div>
        )}
        <div className="bg-muted/50 rounded-xl p-4 border border-border">
          <textarea
            placeholder="Ask anything"
            className="w-full border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none px-0 py-0 text-sm text-foreground resize-none min-h-[32px] max-h-32 overflow-y-auto mb-3"
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative" ref={autoApproveMenuRef}>
                <button
                  type="button"
                  className="appearance-none bg-transparent text-xs text-muted-foreground pr-4 py-1 cursor-pointer focus:outline-none hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => setAutoApproveMenuOpen((prev) => !prev)}
                  aria-expanded={autoApproveMenuOpen}
                >
                  Auto-approve {autoApproveEnabled ? (autoApproveLevel === 'high' ? 'High' : 'Low') : 'Off'}
                </button>
                <ChevronDown className="h-3 w-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                {autoApproveMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-56 rounded-lg border border-border bg-card shadow-lg p-2 text-xs text-foreground">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="text-muted-foreground uppercase text-[11px]">Auto-approve</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoApproveEnabled}
                        onClick={() => setAutoApproveEnabled((prev) => !prev)}
                        className={`relative h-5 w-9 rounded-full border border-border transition-colors ${
                          autoApproveEnabled ? 'bg-emerald-500/60' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
                            autoApproveEnabled ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    </div>
                    <div className="mt-2 space-y-1">
                      <button
                        type="button"
                        disabled={!autoApproveEnabled}
                        onClick={() => setAutoApproveLevel('low')}
                        className={`w-full flex items-center justify-between rounded-md px-2 py-1 ${
                          autoApproveLevel === 'low' ? 'bg-muted' : 'hover:bg-muted/60'
                        } ${autoApproveEnabled ? '' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        <span>Low risk only</span>
                        {autoApproveLevel === 'low' && autoApproveEnabled && (
                          <span className="text-[10px] uppercase text-muted-foreground">Selected</span>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={!autoApproveEnabled}
                        onClick={() => setAutoApproveLevel('high')}
                        className={`w-full flex items-center justify-between rounded-md px-2 py-1 ${
                          autoApproveLevel === 'high' ? 'bg-muted' : 'hover:bg-muted/60'
                        } ${autoApproveEnabled ? '' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        <span>High risk (all)</span>
                        {autoApproveLevel === 'high' && autoApproveEnabled && (
                          <span className="text-[10px] uppercase text-muted-foreground">Selected</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <select
                  className="appearance-none bg-transparent text-xs text-muted-foreground pr-4 py-1 cursor-pointer focus:outline-none hover:text-foreground transition-colors"
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
                <ChevronDown className="h-3 w-3 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>
            </div>

            <Button
              onClick={handleSendConversation}
              size="icon"
              className="h-8 w-8 rounded-lg flex-shrink-0"
              disabled={!conversationInput.trim()}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AssistantPane;
