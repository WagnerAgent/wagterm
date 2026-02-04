import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Server, KeyRound, FolderOpen, Bot, SlidersHorizontal, History, Settings } from 'lucide-react';
import AssistantPane from './components/app/AssistantPane';
import ConnectionsPaneContainer from './components/app/ConnectionsPaneContainer';
import ComingSoonPane from './components/app/ComingSoonPane';
import VaultsPaneContainer from './components/app/VaultsPaneContainer';
import SessionTabs from './components/app/SessionTabs';
import SettingsPane from './components/app/SettingsPane';
import Sidebar from './components/app/Sidebar';
import TerminalPane from './components/app/TerminalPane';
import type { SectionKey, TerminalSession } from './components/app/types';
import { useAssistantChat } from './hooks/useAssistantChat';
import { useSshSessions } from './hooks/useSshSessions';
import WagtermIcon from './assets/wagterm_icon.svg';

const comingSoonContent: Record<
  'files' | 'ai-agents' | 'agent-settings' | 'runbooks',
  { title: string; headline: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  files: {
    title: 'Files System',
    headline: 'Secure File Operations',
    description:
      'Agentic file management and automated MCP syncing across your infrastructure. Securely transfer, edit, and audit file operations with AI oversight.',
    icon: FolderOpen
  },
  'ai-agents': {
    title: 'AI Agents',
    headline: 'Orchestrated Automation',
    description:
      'Deploy specialized agents that collaborate on tasks, coordinate actions, and maintain context across long-running operations with built-in guardrails.',
    icon: Bot
  },
  'agent-settings': {
    title: 'Agent Settings',
    headline: 'Precision Controls',
    description:
      'Tune model behavior, safety thresholds, and execution preferences to match your team workflows and compliance requirements.',
    icon: SlidersHorizontal
  },
  runbooks: {
    title: 'Runbooks',
    headline: 'Repeatable Playbooks',
    description:
      'Codify operational procedures into reusable runbooks with step-by-step automation, approvals, and audit trails.',
    icon: History
  }
};

const sections: Array<{ id: SectionKey; label: string; icon: React.ReactNode }> = [
  { id: 'connections', label: 'Connections', icon: <Server className="h-5 w-5" /> },
  { id: 'vaults', label: 'Vaults', icon: <KeyRound className="h-5 w-5" /> },
  { id: 'files', label: 'Files', icon: <FolderOpen className="h-5 w-5" /> },
  { id: 'ai-agents', label: 'AI Agents', icon: <Bot className="h-5 w-5" /> },
  { id: 'agent-settings', label: 'Agent Settings', icon: <SlidersHorizontal className="h-5 w-5" /> },
  { id: 'runbooks', label: 'Runbooks', icon: <History className="h-5 w-5" /> },
  { id: 'preferences', label: 'Preferences', icon: <Settings className="h-5 w-5" /> },
];

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [section, setSection] = useState<SectionKey>('connections');
  const [appInfo, setAppInfo] = useState<{ name: string; version: string } | null>(null);
  const [assistantWidths, setAssistantWidths] = useState<Record<string, number>>({});
  const resizeRafRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    sessionId: string;
    startX: number;
    startWidth: number;
  } | null>(null);

  const sessionsRef = useRef<TerminalSession[]>([]);
  const activeTabRef = useRef<string>('connections');

  const {
    conversationMessages,
    planStepsBySession,
    conversationInput,
    setConversationInput,
    selectedModelBySession,
    setSelectedModelBySession,
    handleSendConversation,
    handleApproveCommand,
    handleConfirmCommand,
    handleRejectCommand,
    registerSession,
    unregisterSession
  } = useAssistantChat({
    getSessionById: (sessionId) => sessionsRef.current.find((session) => session.id === sessionId),
    getActiveTab: () => activeTabRef.current
  });

  const {
    terminalSessions,
    activeTab,
    setActiveTab,
    connectToProfile,
    closeSession,
    attachTerminal,
    findInTerminal,
    commandHistoryByConnection
  } = useSshSessions({
    onSessionStart: registerSession,
    onSessionClose: unregisterSession
  });

  useEffect(() => {
    window.wagterm.getAppInfo().then(setAppInfo);
  }, []);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setSplashFading(true);
    }, 1200);
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1700);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    sessionsRef.current = terminalSessions;
  }, [terminalSessions]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current) {
        return;
      }
      const { sessionId, startX, startWidth } = dragStateRef.current;
      const delta = startX - event.clientX;
      const minWidth = 360;
      const maxWidth = Math.min(720, window.innerWidth - 320);
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
      setAssistantWidths((prev) => ({ ...prev, [sessionId]: nextWidth }));

      if (resizeRafRef.current === null) {
        resizeRafRef.current = window.requestAnimationFrame(() => {
          resizeRafRef.current = null;
          window.dispatchEvent(new Event('resize'));
        });
      }
    };

    const handleMouseUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        window.dispatchEvent(new Event('resize'));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, []);

  const sectionTitle = useMemo(() => {
    const current = sections.find((item) => item.id === section);
    return current?.label ?? 'Connections';
  }, [section]);

  const isComingSoonSection = section in comingSoonContent;

  if (showSplash) {
    return (
      <div
        className={`fixed inset-0 bg-background flex items-center justify-center transition-opacity duration-500 ${
          splashFading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <img src={WagtermIcon} alt="Wagterm" className="w-24 h-24 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {activeTab === 'connections' && (
        <Sidebar section={section} sections={sections} setSection={setSection} appInfo={appInfo} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {(activeTab !== 'connections' || section === 'connections') && (
          <SessionTabs
            terminalSessions={terminalSessions}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            closeSession={(id) => {
              void closeSession(id);
            }}
          />
        )}

        <div className="flex-1 flex overflow-hidden">
          {activeTab === 'connections' && section === 'connections' && (
            <ConnectionsPaneContainer
              terminalSessions={terminalSessions}
              connectToProfile={connectToProfile}
            />
          )}

          {activeTab === 'connections' && section === 'vaults' && (
            <VaultsPaneContainer />
          )}

          {activeTab === 'connections' && section !== 'connections' && section !== 'vaults' && (
            <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-background">
              {section !== 'preferences' && (
                <header className="h-16 flex items-center px-8 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
                  <h1 className="text-lg font-medium text-white">{sectionTitle}</h1>
                </header>
              )}
              <div className={`flex-1 overflow-auto ${isComingSoonSection || section === 'preferences' ? '' : 'p-8'}`}>
                {section === 'preferences' && <SettingsPane />}

                {section !== 'preferences' && section in comingSoonContent && (
                  <ComingSoonPane
                    {...comingSoonContent[section as keyof typeof comingSoonContent]}
                    onBack={() => setSection('connections')}
                  />
                )}
              </div>
            </main>
          )}

          {terminalSessions.map((session) => (
            <div
              key={session.id}
              className={activeTab === session.id ? 'flex-1 flex overflow-hidden' : 'hidden'}
            >
              <TerminalPane
                session={session}
                attachTerminal={attachTerminal}
              />
              <div
                className="w-1 cursor-col-resize bg-border/50 hover:bg-border"
                onMouseDown={(event) => {
                  dragStateRef.current = {
                    sessionId: session.id,
                    startX: event.clientX,
                    startWidth: assistantWidths[session.id] ?? 384
                  };
                }}
              />
              <div className="shrink-0 h-full" style={{ width: assistantWidths[session.id] ?? 384 }}>
                <AssistantPane
                  session={session}
                  conversationMessages={conversationMessages}
                  planStepsBySession={planStepsBySession}
                  conversationInput={conversationInput}
                  setConversationInput={setConversationInput}
                  selectedModel={selectedModelBySession.get(session.id)}
                  setSelectedModel={(model) =>
                    setSelectedModelBySession((prev) => {
                      const next = new Map(prev);
                      next.set(session.id, model);
                      return next;
                    })
                  }
                  handleSendConversation={handleSendConversation}
                  handleApproveCommand={handleApproveCommand}
                  handleConfirmCommand={handleConfirmCommand}
                  handleRejectCommand={handleRejectCommand}
                  findInTerminal={findInTerminal}
                  commandHistory={commandHistoryByConnection.get(session.profile.id) ?? []}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
