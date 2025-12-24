import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Terminal as TerminalIcon } from 'lucide-react';
import { Button } from '../ui/button';
import type { CommandProposal, TerminalSession } from './types';
import type { AgentPlanStep } from '../../../shared/agent-ipc';
import { useSettingsContext } from '../../context/SettingsContext';

type MarkdownBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; content: string }
  | { type: 'quote'; content: string };

const parseMarkdownBlocks = (source: string): MarkdownBlock[] => {
  const lines = source.split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  const isBlockStart = (line: string) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('```') ||
      /^#{1,6}\s+/.test(line) ||
      /^>\s?/.test(line) ||
      /^[-*]\s+/.test(line) ||
      /^\d+\.\s+/.test(line)
    );
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      blocks.push({ type: 'code', language, content: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', content: quoteLines.join('\n') });
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (orderedMatch || unorderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index];
        const currentOrdered = currentLine.match(/^\d+\.\s+(.*)$/);
        const currentUnordered = currentLine.match(/^[-*]\s+(.*)$/);
        const match = ordered ? currentOrdered : currentUnordered;
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const nextLine = lines[index];
      if (!nextLine.trim()) {
        break;
      }
      if (isBlockStart(nextLine)) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: paragraphLines.join('\n') });
  }

  return blocks;
};

const renderInline = (text: string) => {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`code-${idx}`} className="rounded bg-background/70 px-1 py-0.5 text-xs font-mono text-foreground">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`text-${idx}`}>{part}</React.Fragment>;
  });
};

const renderMarkdown = (text: string) => {
  const blocks = parseMarkdownBlocks(text);
  return blocks.map((block, idx) => {
    if (block.type === 'heading') {
      const HeadingTag = block.level <= 2 ? 'h4' : block.level === 3 ? 'h5' : 'h6';
      return (
        <HeadingTag key={`heading-${idx}`} className="text-sm font-semibold text-foreground">
          {renderInline(block.content)}
        </HeadingTag>
      );
    }
    if (block.type === 'code') {
      return (
        <pre
          key={`codeblock-${idx}`}
          className="rounded-md border border-border bg-background/70 p-3 text-xs font-mono text-foreground overflow-x-auto"
        >
          <code>{block.content}</code>
        </pre>
      );
    }
    if (block.type === 'list') {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag
          key={`list-${idx}`}
          className={`text-sm text-foreground space-y-1 ${block.ordered ? 'list-decimal' : 'list-disc'} pl-4`}
        >
          {block.items.map((item, itemIdx) => (
            <li key={`item-${idx}-${itemIdx}`}>{renderInline(item)}</li>
          ))}
        </ListTag>
      );
    }
    if (block.type === 'quote') {
      return (
        <blockquote
          key={`quote-${idx}`}
          className="border-l-2 border-border pl-3 text-sm text-muted-foreground whitespace-pre-wrap"
        >
          {renderInline(block.content)}
        </blockquote>
      );
    }
    return (
      <p key={`para-${idx}`} className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {renderInline(block.content)}
      </p>
    );
  });
};

type AssistantPaneProps = {
  session: TerminalSession;
  conversationMessages: Map<
    string,
    Array<{ id?: string; role: 'user' | 'assistant'; kind: 'text' | 'proposal'; content?: string; proposal?: CommandProposal }>
  >;
  planStepsBySession: Map<string, AgentPlanStep[]>;
  conversationInput: string;
  setConversationInput: (value: string) => void;
  selectedModel?: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5';
  setSelectedModel: (value: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5') => void;
  handleSendConversation: (options?: { maxSteps?: number }) => void;
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
  const { settings } = useSettingsContext();
  const messages = conversationMessages.get(session.id) ?? [];
  const planSteps = planStepsBySession.get(session.id) ?? [];
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveLevel, setAutoApproveLevel] = useState<'low' | 'medium' | 'high'>('low');
  const [maxStepsMultiplier, setMaxStepsMultiplier] = useState(1);
  const [autoApproveMenuOpen, setAutoApproveMenuOpen] = useState(false);
  const autoApproveMenuRef = useRef<HTMLDivElement | null>(null);
  const autoApproveTouchedRef = useRef(false);
  const autoApprovedRef = useRef<Set<string>>(new Set());
  const selectedModelValue = selectedModel ?? settings.defaultModel;

  const shouldAutoApprove = (risk?: CommandProposal['risk']) => {
    if (!risk) {
      return false;
    }
    if (autoApproveLevel === 'high') {
      return true;
    }
    if (autoApproveLevel === 'medium') {
      return risk === 'low' || risk === 'medium';
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
    if (autoApproveTouchedRef.current) {
      return;
    }
    setAutoApproveEnabled(settings.autoApprovalEnabled);
    setAutoApproveLevel(settings.autoApprovalThreshold);
  }, [settings.autoApprovalEnabled, settings.autoApprovalThreshold]);

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
    <aside className="bg-card flex flex-col h-full">
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
                    {msg.role === 'assistant' && msg.content ? (
                      <div className="space-y-2">{renderMarkdown(msg.content)}</div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-border">
        {settings.showPlanPanel && planSteps.length > 0 && (
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
                handleSendConversation({ maxSteps: maxStepsMultiplier * 8 });
              }
            }}
            rows={1}
            onInput={(event) => {
              const target = event.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="relative" ref={autoApproveMenuRef}>
                <button
                  type="button"
                  className="appearance-none bg-transparent text-xs text-muted-foreground pr-4 py-1 cursor-pointer focus:outline-none hover:text-foreground transition-colors whitespace-nowrap"
                  onClick={() => setAutoApproveMenuOpen((prev) => !prev)}
                  aria-expanded={autoApproveMenuOpen}
                >
                  Auto-approve{' '}
                  {autoApproveEnabled
                    ? autoApproveLevel === 'high'
                      ? 'High'
                      : autoApproveLevel === 'medium'
                        ? 'Medium'
                        : 'Low'
                    : 'Off'}
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
                        onClick={() => {
                          autoApproveTouchedRef.current = true;
                          setAutoApproveEnabled((prev) => !prev);
                        }}
                        className={`relative h-5 w-9 rounded-full border border-border transition-colors ${
                          autoApproveEnabled ? 'bg-emerald-500/60' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`absolute left-0.5 top-[1px] h-4 w-4 rounded-full bg-background transition-transform ${
                            autoApproveEnabled ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    </div>
                    <div className="mt-2 space-y-1">
                      <button
                        type="button"
                        disabled={!autoApproveEnabled}
                        onClick={() => {
                          autoApproveTouchedRef.current = true;
                          setAutoApproveLevel('low');
                        }}
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
                        onClick={() => {
                          autoApproveTouchedRef.current = true;
                          setAutoApproveLevel('medium');
                        }}
                        className={`w-full flex items-center justify-between rounded-md px-2 py-1 ${
                          autoApproveLevel === 'medium' ? 'bg-muted' : 'hover:bg-muted/60'
                        } ${autoApproveEnabled ? '' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        <span>Medium risk or lower</span>
                        {autoApproveLevel === 'medium' && autoApproveEnabled && (
                          <span className="text-[10px] uppercase text-muted-foreground">Selected</span>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={!autoApproveEnabled}
                        onClick={() => {
                          autoApproveTouchedRef.current = true;
                          setAutoApproveLevel('high');
                        }}
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
                  className="appearance-none bg-transparent text-xs text-muted-foreground pr-5 py-1 cursor-pointer focus:outline-none hover:text-foreground transition-colors"
                  value={maxStepsMultiplier}
                  onChange={(event) => setMaxStepsMultiplier(Number(event.target.value))}
                >
                  <option value={1}>Steps 1x</option>
                  <option value={2}>Steps 2x</option>
                  <option value={3}>Steps 3x</option>
                </select>
                <ChevronDown className="h-3 w-3 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>

              <div className="relative max-w-[120px] min-w-0">
                <select
                  className="appearance-none bg-transparent text-xs text-muted-foreground pr-5 py-1 cursor-pointer focus:outline-none hover:text-foreground transition-colors w-full truncate"
                  value={selectedModelValue}
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
                    <option value="claude-opus-4.5">Opus 4.5</option>
                    <option value="claude-sonnet-4.5">Sonnet 4.5</option>
                    <option value="claude-haiku-4.5">Haiku 4.5</option>
                  </optgroup>
                </select>
                <ChevronDown className="h-3 w-3 absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>
            </div>

            <Button
              onClick={() => handleSendConversation({ maxSteps: maxStepsMultiplier * 8 })}
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
