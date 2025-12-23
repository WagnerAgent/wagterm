import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Key, Settings, Server } from 'lucide-react';
import AiPane from './components/app/AiPane';
import ConnectionsPane from './components/app/ConnectionsPane';
import KeysPane from './components/app/KeysPane';
import SessionTabs from './components/app/SessionTabs';
import SettingsPane from './components/app/SettingsPane';
import Sidebar from './components/app/Sidebar';
import TerminalPane from './components/app/TerminalPane';
import type { SectionKey, TerminalSession } from './components/app/types';
import { useAssistantChat } from './hooks/useAssistantChat';
import { useConnections } from './hooks/useConnections';
import { useKeys } from './hooks/useKeys';
import { useSshSessions } from './hooks/useSshSessions';

const sections: Array<{ id: SectionKey; label: string; icon: React.ReactNode }> = [
  { id: 'connections', label: 'Connections', icon: <Server className="h-4 w-4" /> },
  { id: 'keys', label: 'Keys', icon: <Key className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
];

const App = () => {
  const [section, setSection] = useState<SectionKey>('connections');
  const [appInfo, setAppInfo] = useState<{ name: string; version: string } | null>(null);

  const {
    keys,
    keySheetOpen,
    setKeySheetOpen,
    keyForm,
    setKeyForm,
    keyError,
    editingKeyId,
    setEditingKeyId,
    detectedKeyType,
    loadKeys,
    resetKeyForm,
    handleKeySave
  } = useKeys();

  const {
    connections,
    connectionSheetOpen,
    setConnectionSheetOpen,
    connectionForm,
    setConnectionForm,
    connectionError,
    editingConnectionId,
    setEditingConnectionId,
    loadConnections,
    resetConnectionForm,
    handleConnectionSave
  } = useConnections({ keys });

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
    void loadConnections();
    void loadKeys();
  }, [loadConnections, loadKeys]);

  useEffect(() => {
    sessionsRef.current = terminalSessions;
  }, [terminalSessions]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const sectionTitle = useMemo(() => {
    const current = sections.find((item) => item.id === section);
    return current?.label ?? 'Connections';
  }, [section]);

  return (
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
                  <ConnectionsPane
                    connections={connections}
                    keys={keys}
                    terminalSessions={terminalSessions}
                    connectionSheetOpen={connectionSheetOpen}
                    setConnectionSheetOpen={setConnectionSheetOpen}
                    connectionForm={connectionForm}
                    setConnectionForm={setConnectionForm}
                    connectionError={connectionError}
                    editingConnectionId={editingConnectionId}
                    setEditingConnectionId={setEditingConnectionId}
                    resetConnectionForm={resetConnectionForm}
                    handleConnectionSave={handleConnectionSave}
                    loadConnections={loadConnections}
                    connectToProfile={connectToProfile}
                  />
                )}

                {section === 'keys' && (
                  <KeysPane
                    keys={keys}
                    keySheetOpen={keySheetOpen}
                    setKeySheetOpen={setKeySheetOpen}
                    keyForm={keyForm}
                    setKeyForm={setKeyForm}
                    keyError={keyError}
                    editingKeyId={editingKeyId}
                    setEditingKeyId={setEditingKeyId}
                    resetKeyForm={resetKeyForm}
                    handleKeySave={handleKeySave}
                    loadKeys={loadKeys}
                    detectedKeyType={detectedKeyType}
                  />
                )}

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
              <AiPane
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
