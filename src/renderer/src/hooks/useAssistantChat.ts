import { useEffect, useRef, useState } from 'react';
import type { CommandProposal, TerminalSession } from '../components/app/types';
import type { AgentPlanStep } from '../../../shared/agent-ipc';
import { useSettingsContext } from '../context/SettingsContext';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'proposal';
  content?: string;
  proposal?: CommandProposal;
};

type UseAssistantChatOptions = {
  getSessionById: (sessionId: string) => TerminalSession | undefined;
  getActiveTab: () => string;
};

export const useAssistantChat = ({ getSessionById, getActiveTab }: UseAssistantChatOptions) => {
  const { settings } = useSettingsContext();
  const [conversationMessages, setConversationMessages] = useState<Map<string, Message[]>>(new Map());
  const [planStepsBySession, setPlanStepsBySession] = useState<Map<string, AgentPlanStep[]>>(new Map());
  const [conversationInput, setConversationInput] = useState('');
  const [selectedModelBySession, setSelectedModelBySession] = useState<
    Map<string, 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5'>
  >(new Map());

  const conversationMessagesRef = useRef<Map<string, Message[]>>(new Map());

  const registerSession = (sessionId: string) => {
    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      newMap.set(sessionId, []);
      return newMap;
    });
    setPlanStepsBySession((prev) => {
      const newMap = new Map(prev);
      newMap.set(sessionId, []);
      return newMap;
    });
    setSelectedModelBySession((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(sessionId)) {
        newMap.set(sessionId, settings.defaultModel);
      }
      return newMap;
    });
  };

  const unregisterSession = (sessionId: string) => {
    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
    setPlanStepsBySession((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
    setSelectedModelBySession((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
  };

  useEffect(() => {
    conversationMessagesRef.current = conversationMessages;
  }, [conversationMessages]);

  const updateProposalStatus = (
    sessionId: string,
    proposalId: string,
    status: CommandProposal['status'],
    statusMessage?: string
  ) => {
    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      const messages = newMap.get(sessionId) ?? [];
      newMap.set(
        sessionId,
        messages.map((message) => {
          if (message.kind !== 'proposal' || message.proposal?.id !== proposalId) {
            return message;
          }
          return {
            ...message,
            proposal: {
              ...message.proposal,
              status,
              statusMessage: statusMessage ?? message.proposal.statusMessage
            }
          };
        })
      );
      return newMap;
    });
  };

  const ensureConversation = (sessionId: string) => {
    if (!conversationMessagesRef.current.has(sessionId)) {
      setConversationMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(sessionId, []);
        return newMap;
      });
    }
  };

  const handleApproveCommand = (sessionId: string, proposalId: string) => {
    const proposal = (conversationMessages.get(sessionId) ?? []).find(
      (message) => message.kind === 'proposal' && message.proposal?.id === proposalId
    )?.proposal;
    if (!proposal) {
      return;
    }

    updateProposalStatus(sessionId, proposalId, 'approved');
    window.wagterm.assistant.agent.sendAction({
      version: 1,
      sessionId,
      kind: 'approve_tool',
      toolCallId: proposalId
    });
  };

  const handleRejectCommand = (sessionId: string, proposalId: string) => {
    updateProposalStatus(sessionId, proposalId, 'rejected');
    window.wagterm.assistant.agent.sendAction({
      version: 1,
      sessionId,
      kind: 'reject_tool',
      toolCallId: proposalId
    });
  };

  const handleSendConversation = async (options?: { maxSteps?: number }) => {
    const activeTab = getActiveTab();
    if (!conversationInput.trim() || !activeTab || activeTab === 'connections') return;

    const sessionId = activeTab;
    if (!getSessionById(sessionId)) {
      return;
    }

    const userMessage = conversationInput.trim();
    const userMessageId = crypto.randomUUID();

    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      const messages = newMap.get(sessionId) || [];
      newMap.set(sessionId, [
        ...messages,
        { id: userMessageId, role: 'user', kind: 'text', content: userMessage }
      ]);
      return newMap;
    });
    setConversationInput('');

    const hasPending = (conversationMessagesRef.current.get(sessionId) ?? []).some(
      (message) => message.kind === 'proposal' && message.proposal?.status === 'pending'
    );
    if (hasPending) {
      setConversationMessages((prev) => {
        const newMap = new Map(prev);
        const messages = newMap.get(sessionId) || [];
        newMap.set(sessionId, [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            kind: 'text',
            content: 'Please approve or reject the pending command before continuing.'
          }
        ]);
        return newMap;
      });
      return;
    }

    window.wagterm.assistant.agent.sendAction({
      version: 1,
      sessionId,
      kind: 'user_message',
      messageId: userMessageId,
      content: userMessage,
      model: selectedModelBySession.get(sessionId) ?? settings.defaultModel,
      maxSteps: options?.maxSteps
    });
  };

  useEffect(() => {
    const removeAgentEventListener = window.wagterm.assistant.agent.onEvent((event) => {
      if (event.kind === 'message') {
        if (event.role !== 'assistant') {
          return;
        }
        ensureConversation(event.sessionId);
        setConversationMessages((prev) => {
          const newMap = new Map(prev);
          const messages = newMap.get(event.sessionId) ?? [];
          const messageIndex = messages.findIndex((message) => message.id === event.messageId);
          const content = event.content ?? '';
          if (messageIndex >= 0) {
            const updated = [...messages];
            updated[messageIndex] = { ...updated[messageIndex], content };
            newMap.set(event.sessionId, updated);
          } else {
            newMap.set(event.sessionId, [
              ...messages,
              { id: event.messageId ?? crypto.randomUUID(), role: 'assistant', kind: 'text', content }
            ]);
          }
          return newMap;
        });
        return;
      }

      if (event.kind === 'tool_requested') {
        ensureConversation(event.sessionId);
        const proposal = event.toolCall;
        if (!proposal) {
          return;
        }
        setConversationMessages((prev) => {
          const newMap = new Map(prev);
          const messages = newMap.get(event.sessionId) ?? [];
          newMap.set(event.sessionId, [
            ...messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              kind: 'proposal',
              proposal: {
                id: proposal.id,
                command: String(proposal.input.command ?? ''),
                rationale: undefined,
                risk: proposal.risk,
                requiresApproval: proposal.requiresApproval,
                status: 'pending'
              }
            }
          ]);
          return newMap;
        });
        return;
      }

      if (event.kind === 'plan_updated') {
        setPlanStepsBySession((prev) => {
          const newMap = new Map(prev);
          newMap.set(event.sessionId, event.steps ?? []);
          return newMap;
        });
        return;
      }

      if (event.kind !== 'tool_result') {
        return;
      }

      const toolCallId = event.result.toolCallId;
      if (!toolCallId) {
        return;
      }

      const statusMessage =
        event.result.output ||
        event.result.error ||
        (event.result.status === 'cancelled' ? 'Command was rejected.' : 'Command completed.');

      if (event.result.status === 'success') {
        updateProposalStatus(event.sessionId, toolCallId, 'approved', statusMessage);
      } else {
        updateProposalStatus(event.sessionId, toolCallId, 'rejected', statusMessage);
      }
    });

    return () => {
      removeAgentEventListener();
    };
  }, []);

  return {
    conversationMessages,
    planStepsBySession,
    conversationInput,
    setConversationInput,
    selectedModelBySession,
    setSelectedModelBySession,
    handleSendConversation,
    handleApproveCommand,
    handleRejectCommand,
    registerSession,
    unregisterSession
  };
};

export type { Message };
