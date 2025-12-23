import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Key, Settings, Server } from 'lucide-react';
import AssistantPane from './components/app/AssistantPane';
import ConnectionsPaneContainer from './components/app/ConnectionsPaneContainer';
import KeysPaneContainer from './components/app/KeysPaneContainer';
import SessionTabs from './components/app/SessionTabs';
import SettingsPane from './components/app/SettingsPane';
import Sidebar from './components/app/Sidebar';
import TerminalPane from './components/app/TerminalPane';
import type { SectionKey, TerminalSession } from './components/app/types';
import { KeysProvider } from './context/KeysContext';
import { useAssistantChat } from './hooks/useAssistantChat';
import { useSshSessions } from './hooks/useSshSessions';

const sections: Array<{ id: SectionKey; label: string; icon: React.ReactNode }> = [
  { id: 'connections', label: 'Connections', icon: <Server className="h-4 w-4" /> },
  { id: 'keys', label: 'Keys', icon: <Key className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
];

const App = () => {
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
    selectedModel,
    setSelectedModel,
    handleSendConversation,
    handleApproveCommand,
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
    attachTerminal
  } = useSshSessions({
    onSessionStart: registerSession,
    onSessionClose: unregisterSession
  });

  useEffect(() => {
    window.wagterm.getAppInfo().then(setAppInfo);
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

  return (
    <KeysProvider>
      <div className="flex h-screen bg-background">
        {activeTab === 'connections' && (
          <Sidebar section={section} sections={sections} setSection={setSection} appInfo={appInfo} />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <SessionTabs
            terminalSessions={terminalSessions}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            closeSession={(id) => {
              void closeSession(id);
            }}
          />

          <div className="flex-1 flex overflow-hidden">
            {activeTab === 'connections' && (
              <main className="flex-1 flex flex-col overflow-hidden">
                <header className="border-b border-border px-8 py-6">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workspace</p>
                  <h2 className="text-2xl font-semibold mt-1">{sectionTitle}</h2>
                </header>

                <div className="flex-1 overflow-auto p-8">
                  {section === 'connections' && (
                    <ConnectionsPaneContainer
                      terminalSessions={terminalSessions}
                      connectToProfile={connectToProfile}
                    />
                  )}

                  {section === 'keys' && <KeysPaneContainer />}

                  {section === 'settings' && <SettingsPane />}
                </div>
              </main>
            )}

            {terminalSessions.map((session) => (
              <div
                key={session.id}
                className={activeTab === session.id ? 'flex-1 flex overflow-hidden' : 'hidden'}
              >
                <TerminalPane session={session} attachTerminal={attachTerminal} />
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
                    selectedModel={selectedModel}
                    setSelectedModel={setSelectedModel}
                    handleSendConversation={handleSendConversation}
                    handleApproveCommand={handleApproveCommand}
                    handleRejectCommand={handleRejectCommand}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </KeysProvider>
  );
};

export default App;
