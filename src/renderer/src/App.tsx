import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Key, Settings, Server } from 'lucide-react';
import AiPane from './components/app/AiPane';
import ConnectionsPane from './components/app/ConnectionsPane';
import KeysPane from './components/app/KeysPane';
import SessionTabs from './components/app/SessionTabs';
import SettingsPane from './components/app/SettingsPane';
import Sidebar from './components/app/Sidebar';
import TerminalPane from './components/app/TerminalPane';
import type { CommandProposal, ConnectionProfile, KeyRecord, SectionKey, TerminalSession } from './components/app/types';

const sections: Array<{ id: SectionKey; label: string; icon: React.ReactNode }> = [
  { id: 'connections', label: 'Connections', icon: <Server className="h-4 w-4" /> },
  { id: 'keys', label: 'Keys', icon: <Key className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
];

const emptyConnectionForm = {
  name: '',
  host: '',
  username: '',
  port: 22,
  credentialId: '',
  authMethod: 'pem' as const,
  password: '',
  hostKeyPolicy: 'strict' as const,
  knownHostsPath: ''
};

const emptyKeyForm = {
  name: '',
  kind: 'ssh' as const,
  publicKey: '',
  privateKey: '',
  fingerprint: '',
  path: '',
  passphrase: ''
};

const detectKeyType = (publicKey: string, privateKey: string) => {
  const publicTrimmed = publicKey.trim();
  const privateTrimmed = privateKey.trim();

  if (publicTrimmed.startsWith('ssh-ed25519')) {
    return 'ed25519';
  }

  if (publicTrimmed.startsWith('ssh-rsa')) {
    return 'rsa';
  }

  if (privateTrimmed.includes('BEGIN RSA PRIVATE KEY')) {
    return 'rsa';
  }

  if (privateTrimmed.includes('BEGIN OPENSSH PRIVATE KEY')) {
    return 'ed25519';
  }

  return null;
};

const App = () => {
  const [section, setSection] = useState<SectionKey>('connections');
  const [appInfo, setAppInfo] = useState<{ name: string; version: string } | null>(null);
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [connectionSheetOpen, setConnectionSheetOpen] = useState(false);
  const [keySheetOpen, setKeySheetOpen] = useState(false);
  const [connectionForm, setConnectionForm] = useState(emptyConnectionForm);
  const [keyForm, setKeyForm] = useState(emptyKeyForm);
  const [connectionError, setConnectionError] = useState('');
  const [keyError, setKeyError] = useState('');
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);

  // Terminal sessions state
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);

  // Chrome-style tabs state
  const [activeTab, setActiveTab] = useState<'connections' | string>('connections');

  // AI Conversation state - per session
  const [conversationMessages, setConversationMessages] = useState<Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>>(new Map());
  const [conversationInput, setConversationInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<
    'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5'
  >('gpt-5.2');
  const [commandProposals, setCommandProposals] = useState<Map<string, CommandProposal[]>>(new Map());

  const sessionReceivedData = useRef<Map<string, boolean>>(new Map());
  const connectTimeouts = useRef<Map<string, number>>(new Map());
  const sessionListeners = useRef<Map<string, { onData: () => void; onExit: () => void }>>(new Map());
  const terminalsById = useRef<Map<string, XTerm>>(new Map());
  const terminalContainersById = useRef<Map<string, HTMLDivElement>>(new Map());
  const fitAddonsById = useRef<Map<string, FitAddon>>(new Map());

  const loadConnections = useCallback(async () => {
    const response = await window.wagterm.storage.listConnections();
    setConnections(response.profiles);
  }, []);

  const loadKeys = useCallback(async () => {
    const response = await window.wagterm.storage.listKeys();
    setKeys(response.keys);
  }, []);

  useEffect(() => {
    window.wagterm.getAppInfo().then(setAppInfo);
    void loadConnections();
    void loadKeys();
  }, [loadConnections, loadKeys]);

  const sectionTitle = useMemo(() => {
    const current = sections.find((item) => item.id === section);
    return current?.label ?? 'Connections';
  }, [section]);

  const keyById = useMemo(() => new Map(keys.map((key) => [key.id, key])), [keys]);
  const detectedKeyType = useMemo(
    () => detectKeyType(keyForm.publicKey, keyForm.privateKey),
    [keyForm.publicKey, keyForm.privateKey]
  );

  const resetConnectionForm = () => {
    setConnectionForm(emptyConnectionForm);
    setConnectionError('');
    setEditingConnectionId(null);
  };

  const resetKeyForm = () => {
    setKeyForm(emptyKeyForm);
    setKeyError('');
    setEditingKeyId(null);
  };

  const closeSession = useCallback(async (sessionId: string) => {
    await window.wagterm.sshSession.close({ sessionId });

    // Clean up listeners
    const listeners = sessionListeners.current.get(sessionId);
    if (listeners) {
      listeners.onData();
      listeners.onExit();
      sessionListeners.current.delete(sessionId);
    }

    // Clean up timeout
    const timeout = connectTimeouts.current.get(sessionId);
    if (timeout) {
      window.clearTimeout(timeout);
      connectTimeouts.current.delete(sessionId);
    }

    sessionReceivedData.current.delete(sessionId);
    const terminal = terminalsById.current.get(sessionId);
    if (terminal) {
      terminal.dispose();
      terminalsById.current.delete(sessionId);
    }
    terminalContainersById.current.delete(sessionId);
    fitAddonsById.current.delete(sessionId);

    // Remove session from state
    setTerminalSessions(prev => prev.filter(s => s.id !== sessionId));

    // Remove conversation messages for this session
    setConversationMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
    setCommandProposals(prev => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });

    // If this was the active tab, switch back to connections
    if (activeTab === sessionId) {
      setActiveTab('connections');
    }
  }, [activeTab]);

  const ensureTerminal = useCallback((sessionId: string) => {
    const existing = terminalsById.current.get(sessionId);
    if (existing) {
      return existing;
    }

    const terminal = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#050505',
        foreground: '#d1d5db'
      }
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    fitAddonsById.current.set(sessionId, fitAddon);

    terminal.onData((data) => {
      void window.wagterm.sshSession.sendInput({ sessionId, data });
    });

    terminalsById.current.set(sessionId, terminal);
    return terminal;
  }, []);

  const attachTerminal = useCallback(
    (sessionId: string, element: HTMLDivElement | null) => {
      if (!element) {
        terminalContainersById.current.delete(sessionId);
        return;
      }

      terminalContainersById.current.set(sessionId, element);
      const terminal = ensureTerminal(sessionId);
      if (terminal.element !== element) {
        terminal.open(element);
        const fitAddon = fitAddonsById.current.get(sessionId);
        if (fitAddon) {
          setTimeout(() => fitAddon.fit(), 0);
        }
      }
    },
    [ensureTerminal]
  );

  const writeToTerminal = useCallback(
    (sessionId: string, text: string) => {
      const terminal = terminalsById.current.get(sessionId) ?? ensureTerminal(sessionId);
      terminal.write(text);
    },
    [ensureTerminal]
  );

  const updateSessionStatus = (sessionId: string, status: string, connected: boolean) => {
    setTerminalSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, status, connected }
          : session
      )
    );
  };

  const connectToProfile = async (profile: ConnectionProfile) => {
    let response: { sessionId: string };
    try {
      response = await window.wagterm.sshSession.start({
        profile,
        cols: 100,
        rows: 30
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start SSH session.';
      window.alert(message);
      return;
    }

    const newSession: TerminalSession = {
      id: response.sessionId,
      profile,
      status: `Connecting to ${profile.username}@${profile.host}...`,
      connected: false
    };

    setTerminalSessions(prev => [...prev, newSession]);
    ensureTerminal(response.sessionId);

    // Initialize conversation messages for this session
    setConversationMessages(prev => {
      const newMap = new Map(prev);
      newMap.set(response.sessionId, []);
      return newMap;
    });

    // Switch to the new session tab
    setActiveTab(response.sessionId);

    sessionReceivedData.current.set(response.sessionId, false);

    // Set connection timeout
    const timeout = window.setTimeout(() => {
      if (!sessionReceivedData.current.get(response.sessionId)) {
        updateSessionStatus(
          response.sessionId,
          `No response from ${profile.host}. Check network or host availability.`,
          false
        );
      }
    }, 12000);
    connectTimeouts.current.set(response.sessionId, timeout);

    // Set up data listener
    const removeDataListener = window.wagterm.sshSession.onData((payload) => {
      if (payload.sessionId !== response.sessionId) return;

      if (!sessionReceivedData.current.get(response.sessionId)) {
        sessionReceivedData.current.set(response.sessionId, true);
        const timeout = connectTimeouts.current.get(response.sessionId);
        if (timeout) {
          window.clearTimeout(timeout);
          connectTimeouts.current.delete(response.sessionId);
        }
        updateSessionStatus(
          response.sessionId,
          `Connected: ${profile.username}@${profile.host}`,
          true
        );
      }
      writeToTerminal(response.sessionId, payload.data);
    });

    // Set up exit listener
    const removeExitListener = window.wagterm.sshSession.onExit((payload) => {
      if (payload.sessionId !== response.sessionId) return;

      const timeout = connectTimeouts.current.get(response.sessionId);
      if (timeout) {
        window.clearTimeout(timeout);
        connectTimeouts.current.delete(response.sessionId);
      }

      writeToTerminal(response.sessionId, `\n[session closed exit=${payload.exitCode ?? 'null'}]\n`);

      if (!sessionReceivedData.current.get(response.sessionId)) {
        updateSessionStatus(
          response.sessionId,
          `Connection failed (exit ${payload.exitCode ?? 'null'}).`,
          false
        );
      } else {
        updateSessionStatus(response.sessionId, 'Disconnected', false);
      }
    });

    sessionListeners.current.set(response.sessionId, {
      onData: removeDataListener,
      onExit: removeExitListener
    });
  };

  const handleConnectionSave = async () => {
    setConnectionError('');
    if (connectionForm.authMethod === 'pem' && !connectionForm.credentialId.trim()) {
      setConnectionError('SSH key is required.');
      return;
    }
    if (connectionForm.authMethod === 'password' && !connectionForm.password.trim()) {
      setConnectionError('Password is required.');
      return;
    }
    const payload = {
      profile: {
        id: editingConnectionId ?? crypto.randomUUID(),
        name: connectionForm.name.trim(),
        host: connectionForm.host.trim(),
        port: Number(connectionForm.port),
        username: connectionForm.username.trim(),
        authMethod: connectionForm.authMethod,
        credentialId: connectionForm.credentialId.trim() || undefined,
        keyPath:
          connectionForm.authMethod === 'pem'
            ? keyById.get(connectionForm.credentialId)?.path ?? undefined
            : undefined,
        hostKeyPolicy: connectionForm.hostKeyPolicy,
        knownHostsPath: connectionForm.knownHostsPath.trim() || undefined
      },
      password: connectionForm.authMethod === 'password' ? connectionForm.password.trim() : undefined
    };

    try {
      if (editingConnectionId) {
        await window.wagterm.storage.updateConnection(payload);
      } else {
        await window.wagterm.storage.addConnection(payload);
      }
      setConnectionSheetOpen(false);
      resetConnectionForm();
      await loadConnections();
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to save connection.');
    }
  };

  const handleKeySave = async () => {
    setKeyError('');
    const resolvedType = keyForm.kind === 'pem' ? 'pem' : detectedKeyType;

    if (keyForm.kind === 'pem') {
      if (!keyForm.path.trim()) {
        setKeyError('PEM file path is required.');
        return;
      }
    } else {
      if (!keyForm.publicKey.trim() || !keyForm.privateKey.trim()) {
        setKeyError('Public and private key are required for SSH keys.');
        return;
      }
      if (!resolvedType) {
        setKeyError('Unable to detect SSH key type. Use ed25519 or rsa keys.');
        return;
      }
    }

    const payload = {
      key: {
        id: editingKeyId ?? crypto.randomUUID(),
        name: keyForm.name.trim(),
        type: resolvedType,
        publicKey: keyForm.publicKey.trim() || undefined,
        fingerprint: keyForm.fingerprint.trim() || undefined,
        path: keyForm.path.trim() || undefined
      },
      privateKey: keyForm.privateKey.trim() || undefined,
      passphrase: keyForm.passphrase.trim() || undefined,
      clearPrivateKey: keyForm.kind === 'pem',
      clearPassphrase: keyForm.kind === 'pem'
    };

    try {
      if (editingKeyId) {
        await window.wagterm.storage.updateKey(payload);
      } else {
        await window.wagterm.storage.addKey(payload);
      }
      setKeySheetOpen(false);
      resetKeyForm();
      await loadKeys();
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : 'Failed to save key.');
    }
  };

  const handleSendConversation = async () => {
    if (!conversationInput.trim() || !activeTab || activeTab === 'connections') return;

    const userMessage = conversationInput.trim();
    const sessionId = activeTab;
    const session = terminalSessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }

    setConversationMessages(prev => {
      const newMap = new Map(prev);
      const messages = newMap.get(sessionId) || [];
      newMap.set(sessionId, [...messages, { role: 'user', content: userMessage }]);
      return newMap;
    });
    setConversationInput('');

    try {
      const aiResponse = await window.wagterm.ai.generate({
        sessionId,
        prompt: userMessage,
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

      const commands = aiResponse.response.commands ?? [];
      const assistantMessage =
        aiResponse.response.message ?? (commands.length > 0 ? 'AI proposed commands.' : 'AI response received.');

      setCommandProposals(prev => {
        const newMap = new Map(prev);
        const proposals: CommandProposal[] = commands.map((cmd) => ({
          id: cmd.id ?? crypto.randomUUID(),
          command: cmd.command,
          rationale: cmd.rationale,
          risk: cmd.risk,
          requiresApproval: cmd.requiresApproval,
          status: 'pending'
        }));
        newMap.set(sessionId, proposals);
        return newMap;
      });

      setConversationMessages(prev => {
        const newMap = new Map(prev);
        const messages = newMap.get(sessionId) || [];
        newMap.set(sessionId, [...messages, { role: 'assistant', content: assistantMessage }]);
        return newMap;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed.';
      setConversationMessages(prev => {
        const newMap = new Map(prev);
        const messages = newMap.get(sessionId) || [];
        newMap.set(sessionId, [...messages, { role: 'assistant', content: message }]);
        return newMap;
      });
    }
  };

  const updateProposalStatus = (sessionId: string, proposalId: string, status: CommandProposal['status']) => {
    setCommandProposals(prev => {
      const newMap = new Map(prev);
      const proposals = newMap.get(sessionId) ?? [];
      newMap.set(
        sessionId,
        proposals.map((proposal) =>
          proposal.id === proposalId ? { ...proposal, status } : proposal
        )
      );
      return newMap;
    });
  };

  const handleApproveCommand = (sessionId: string, proposalId: string) => {
    const proposals = commandProposals.get(sessionId) ?? [];
    const proposal = proposals.find((item) => item.id === proposalId);
    if (!proposal) {
      return;
    }

    updateProposalStatus(sessionId, proposalId, 'approved');
    void window.wagterm.sshSession.sendInput({
      sessionId,
      data: `${proposal.command}\n`
    });

    setConversationMessages(prev => {
      const newMap = new Map(prev);
      const messages = newMap.get(sessionId) || [];
      newMap.set(sessionId, [
        ...messages,
        { role: 'assistant', content: `Executed: ${proposal.command}` }
      ]);
      return newMap;
    });
  };

  const handleRejectCommand = (sessionId: string, proposalId: string) => {
    updateProposalStatus(sessionId, proposalId, 'rejected');
  };

  useEffect(() => {
    return () => {
      // Cleanup all listeners on unmount
      sessionListeners.current.forEach(listeners => {
        listeners.onData();
        listeners.onExit();
      });
      connectTimeouts.current.forEach(timeout => window.clearTimeout(timeout));
      terminalsById.current.forEach(terminal => terminal.dispose());
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'connections') {
      return;
    }
    const terminal = terminalsById.current.get(activeTab);
    const fitAddon = fitAddonsById.current.get(activeTab);
    if (terminal && fitAddon) {
      setTimeout(() => {
        fitAddon.fit();
        terminal.refresh(0, terminal.rows - 1);
        terminal.focus();
      }, 0);
    }
  }, [activeTab]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (activeTab === 'connections') {
        return;
      }
      const fitAddon = fitAddonsById.current.get(activeTab);
      if (fitAddon) {
        fitAddon.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - Only visible on connections tab */}
      {activeTab === 'connections' && (
        <Sidebar section={section} sections={sections} setSection={setSection} appInfo={appInfo} />
      )}

      {/* Main Content with Chrome-style tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chrome-style Tab Bar */}
        <SessionTabs
          terminalSessions={terminalSessions}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          closeSession={(id) => {
            void closeSession(id);
          }}
        />

        {/* Tab Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Connections Tab Content */}
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

          {/* Session Tab Content */}
          {terminalSessions.map((session) => (
            <div
              key={session.id}
              className={activeTab === session.id ? 'flex-1 flex overflow-hidden' : 'hidden'}
            >
              <TerminalPane session={session} attachTerminal={attachTerminal} />
              <AiPane
                session={session}
                conversationMessages={conversationMessages}
                conversationInput={conversationInput}
                setConversationInput={setConversationInput}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                handleSendConversation={handleSendConversation}
                commandProposals={commandProposals}
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
