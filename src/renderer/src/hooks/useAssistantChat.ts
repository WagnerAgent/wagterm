import { useEffect, useRef, useState } from 'react';
import type { CommandProposal, TerminalSession } from '../components/app/types';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'proposal';
  content?: string;
  proposal?: CommandProposal;
};

type UseAiChatOptions = {
  getSessionById: (sessionId: string) => TerminalSession | undefined;
  getActiveTab: () => string;
};

type AiStreamEntry = {
  sessionId: string;
  messageId: string;
  buffer: string;
  tick: number;
  lastVisibleText: string;
};

export const useAssistantChat = ({ getSessionById, getActiveTab }: UseAiChatOptions) => {
  const [conversationMessages, setConversationMessages] = useState<Map<string, Message[]>>(new Map());
  const [conversationInput, setConversationInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<
    'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5'
  >('gpt-5.2');

  const assistantStreamRequests = useRef<Map<string, AiStreamEntry>>(new Map());
  const activeStreamBySession = useRef<Map<string, string>>(new Map());
  const conversationMessagesRef = useRef<Map<string, Message[]>>(new Map());
  const agentGoalBySession = useRef<Map<string, string>>(new Map());
  const agentStepBySession = useRef<Map<string, number>>(new Map());

  const registerSession = (sessionId: string) => {
    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      newMap.set(sessionId, []);
      return newMap;
    });
  };

  const unregisterSession = (sessionId: string) => {
    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
  };

  useEffect(() => {
    conversationMessagesRef.current = conversationMessages;
  }, [conversationMessages]);

  const updateProposalStatus = (sessionId: string, proposalId: string, status: CommandProposal['status']) => {
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
              status
            }
          };
        })
      );
      return newMap;
    });
  };

  const startAssistantStream = async (
    sessionId: string,
    session: TerminalSession,
    prompt: string
  ) => {
    const assistantMessageId = crypto.randomUUID();
    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      const messages = newMap.get(sessionId) || [];
      newMap.set(sessionId, [
        ...messages,
        { id: assistantMessageId, role: 'assistant', kind: 'text', content: '...' }
      ]);
      return newMap;
    });

    const requestId = crypto.randomUUID();
    assistantStreamRequests.current.set(requestId, {
      sessionId,
      messageId: assistantMessageId,
      buffer: '',
      tick: 0,
      lastVisibleText: ''
    });
    activeStreamBySession.current.set(sessionId, requestId);

    try {
      await window.wagterm.assistant.stream({
        requestId,
        sessionId,
        prompt,
        model: selectedModel,
        session: {
          id: session.id,
          name: session.profile.name,
          host: session.profile.host,
          username: session.profile.username,
          port: session.profile.port
        },
        outputLimit: 4000
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed.';
      assistantStreamRequests.current.delete(requestId);
      activeStreamBySession.current.delete(sessionId);
      setConversationMessages((prev) => {
        const newMap = new Map(prev);
        const messages = newMap.get(sessionId) || [];
        newMap.set(
          sessionId,
          messages.map((msg) => (msg.id === assistantMessageId ? { ...msg, content: message } : msg))
        );
        return newMap;
      });
    }
  };

  const buildAgentPrompt = (goal: string, step: number, note?: string) => {
    const lines = [
      `Goal: ${goal}`,
      `Step: ${step}`,
      'You are in agent mode. If the goal is not complete, propose the next single command.',
      'If the goal is complete, set done=true and return no commands.',
      note ? `Context: ${note}` : null
    ].filter((line): line is string => Boolean(line));
    return lines.join('\n');
  };

  const handleApproveCommand = (sessionId: string, proposalId: string) => {
    const proposal = (conversationMessages.get(sessionId) ?? []).find(
      (message) => message.kind === 'proposal' && message.proposal?.id === proposalId
    )?.proposal;
    if (!proposal) {
      return;
    }

    updateProposalStatus(sessionId, proposalId, 'approved');
    void window.wagterm.sshSession.sendInput({
      sessionId,
      data: `${proposal.command}\n`
    });

    setConversationMessages((prev) => {
      const newMap = new Map(prev);
      const messages = newMap.get(sessionId) || [];
      newMap.set(sessionId, [
        ...messages,
        { id: crypto.randomUUID(), role: 'assistant', kind: 'text', content: `Executed: ${proposal.command}` }
      ]);
      return newMap;
    });

    const session = getSessionById(sessionId);
    if (!session) {
      return;
    }

    const goal = agentGoalBySession.current.get(sessionId);
    const currentStep = agentStepBySession.current.get(sessionId) ?? 0;
    agentStepBySession.current.set(sessionId, currentStep + 1);
    const followupPrompt = goal
      ? buildAgentPrompt(goal, currentStep + 1, `Command executed: ${proposal.command}`)
      : [
          `Command executed: ${proposal.command}`,
          'Review the latest output and suggest the next step if needed.',
          'If no further action is required, respond with intent chat and no commands.'
        ].join('\n');

    window.setTimeout(() => {
      const hasPending = (conversationMessagesRef.current.get(sessionId) ?? []).some(
        (message) => message.kind === 'proposal' && message.proposal?.status === 'pending'
      );
      if (hasPending) {
        return;
      }
      if (activeStreamBySession.current.get(sessionId)) {
        return;
      }
      void startAssistantStream(sessionId, session, followupPrompt);
    }, 800);
  };

  const handleRejectCommand = (sessionId: string, proposalId: string) => {
    updateProposalStatus(sessionId, proposalId, 'rejected');
  };

  const handleSendConversation = async () => {
    const activeTab = getActiveTab();
    if (!conversationInput.trim() || !activeTab || activeTab === 'connections') return;

    const sessionId = activeTab;
    const session = getSessionById(sessionId);
    if (!session) {
      return;
    }

    const userMessage = conversationInput.trim();
    const userMessageId = crypto.randomUUID();
    agentGoalBySession.current.set(sessionId, userMessage);
    agentStepBySession.current.set(sessionId, 0);

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

    if (activeStreamBySession.current.get(sessionId)) {
      return;
    }

    await startAssistantStream(sessionId, session, buildAgentPrompt(userMessage, 0, 'Initial user request.'));
  };

  useEffect(() => {
    const removeChunkListener = window.wagterm.assistant.onChunk((payload) => {
      const entry = assistantStreamRequests.current.get(payload.requestId);
      if (!entry) {
        return;
      }
      entry.buffer += payload.text;
      entry.tick += 1;
      const markerIndex = entry.buffer.indexOf('JSON:');
      let visibleText = (markerIndex === -1 ? entry.buffer : entry.buffer.slice(0, markerIndex)).trim();
      if (markerIndex === -1) {
        visibleText = visibleText.replace(/\bJSON$/i, '').trim();
      }
      const trimmed = visibleText.trimStart();

      if (trimmed.startsWith('{')) {
        const match = /\"message\"\\s*:\\s*\"((?:\\\\.|[^\"])*)/m.exec(entry.buffer);
        if (match && match[1]) {
          visibleText = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\\"/g, '\"')
            .replace(/\\\\/g, '\\');
        } else {
          visibleText = '';
        }
      }
      const dots = '.'.repeat((entry.tick % 3) + 1);
      const typingMessage = visibleText.length > 0 ? visibleText : `Thinking${dots}`;
      entry.lastVisibleText = visibleText;

      setConversationMessages((prev) => {
        const newMap = new Map(prev);
        const messages = newMap.get(entry.sessionId) ?? [];
        newMap.set(
          entry.sessionId,
          messages.map((message) =>
            message.id === entry.messageId ? { ...message, content: typingMessage } : message
          )
        );
        return newMap;
      });
    });

    const removeCompleteListener = window.wagterm.assistant.onComplete((payload) => {
      const entry = assistantStreamRequests.current.get(payload.requestId);
      if (!entry) {
        return;
      }
      assistantStreamRequests.current.delete(payload.requestId);
      activeStreamBySession.current.delete(payload.sessionId);

      const commands = payload.response.commands ?? [];
      const assistantMessage =
        entry.lastVisibleText.trim() ||
        payload.response.message ||
        (commands.length > 0 ? 'AI proposed a command.' : 'AI response received.');
      const nextProposal = commands[0];
      if (payload.response.done) {
        agentGoalBySession.current.delete(payload.sessionId);
        agentStepBySession.current.delete(payload.sessionId);
      }

      setConversationMessages((prev) => {
        const newMap = new Map(prev);
        const messages = newMap.get(payload.sessionId) ?? [];
        const updatedMessages = messages.map((message) =>
          message.id === entry.messageId ? { ...message, content: assistantMessage } : message
        );

        if (nextProposal) {
          updatedMessages.push({
            id: crypto.randomUUID(),
            role: 'assistant',
            kind: 'proposal',
            proposal: {
              id: nextProposal.id ?? crypto.randomUUID(),
              command: nextProposal.command,
              rationale: nextProposal.rationale,
              risk: nextProposal.risk,
              requiresApproval: nextProposal.requiresApproval,
              status: 'pending'
            }
          });
        }

        newMap.set(payload.sessionId, updatedMessages);
        return newMap;
      });
    });

    const removeErrorListener = window.wagterm.assistant.onError((payload) => {
      const entry = assistantStreamRequests.current.get(payload.requestId);
      if (!entry) {
        return;
      }
      assistantStreamRequests.current.delete(payload.requestId);
      activeStreamBySession.current.delete(payload.sessionId);

      setConversationMessages((prev) => {
        const newMap = new Map(prev);
        const messages = newMap.get(payload.sessionId) ?? [];
        newMap.set(
          payload.sessionId,
          messages.map((message) =>
            message.id === entry.messageId ? { ...message, content: payload.error } : message
          )
        );
        return newMap;
      });
    });

    return () => {
      removeChunkListener();
      removeCompleteListener();
      removeErrorListener();
    };
  }, []);

  return {
    conversationMessages,
    conversationInput,
    setConversationInput,
    selectedModel,
    setSelectedModel,
    handleSendConversation,
    handleApproveCommand,
    handleRejectCommand,
    registerSession,
    unregisterSession
  };
};

export type { Message };
