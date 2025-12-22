import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Plus, Terminal as TerminalIcon, Key, Settings, X, Edit2, Trash2, Server, ArrowRight, ChevronDown } from 'lucide-react';
import WagtermLogo from './assets/wagterm_logo.svg';

type SectionKey = 'connections' | 'keys' | 'settings';

type ConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'pem' | 'password';
  credentialId?: string;
  hostKeyPolicy?: 'strict' | 'accept-new';
  knownHostsPath?: string;
};

type KeyRecord = {
  id: string;
  name: string;
  type: 'ed25519' | 'rsa' | 'pem';
  fingerprint?: string;
  path?: string;
};

type TerminalSession = {
  id: string;
  profile: ConnectionProfile;
  status: string;
  connected: boolean;
};

type CommandProposal = {
  id: string;
  command: string;
  rationale?: string;
  risk?: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  status: 'pending' | 'approved' | 'rejected';
};

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
        <aside className="w-60 border-r border-border bg-card flex flex-col">
          <div className="p-6 border-b border-border flex items-center">
            <img src={WagtermLogo} alt="Wagterm" className="h-auto w-56" />
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {sections.map((item) => (
              <button
                key={item.id}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  section === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                onClick={() => setSection(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="rounded-lg bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
              {appInfo ? `${appInfo.name} v${appInfo.version}` : 'Loading...'}
            </div>
          </div>
        </aside>
      )}

      {/* Main Content with Chrome-style tabs */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chrome-style Tab Bar */}
        <div className="flex items-end border-b border-border bg-card/50 px-4">
          {/* Connections Tab - Always visible */}
          <button
            onClick={() => setActiveTab('connections')}
            className={`relative px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg ${
              activeTab === 'connections'
                ? 'bg-background text-foreground border-t border-l border-r border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Server className="h-4 w-4" />
            <span>Connections</span>
          </button>

          {/* Session Tabs */}
          {terminalSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => {
                setActiveTab(session.id);
              }}
              className={`relative px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2 rounded-t-lg min-w-0 max-w-xs ${
                activeTab === session.id
                  ? 'bg-background text-foreground border-t border-l border-r border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${session.connected ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
              <span className="truncate">{session.profile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void closeSession(session.id);
                }}
                className="ml-1 hover:bg-accent/50 rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>

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
            <div className="space-y-8">
              {/* Connections Grid */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Connection Profiles</h3>
                    <p className="text-sm text-muted-foreground">Manage EC2, Droplets, and local hosts</p>
                  </div>

                  <Sheet open={connectionSheetOpen} onOpenChange={setConnectionSheetOpen}>
                    <SheetTrigger asChild>
                      <Button onClick={() => resetConnectionForm()}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Connection
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>{editingConnectionId ? 'Edit Connection' : 'New Connection'}</SheetTitle>
                        <SheetDescription>
                          {editingConnectionId ? 'Update your SSH connection profile' : 'Create a new SSH connection profile'}
                        </SheetDescription>
                      </SheetHeader>

                      <div className="space-y-4 py-6">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            placeholder="Production EC2"
                            value={connectionForm.name}
                            onChange={(e) => setConnectionForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="host">Host</Label>
                          <Input
                            id="host"
                            placeholder="1.2.3.4"
                            value={connectionForm.host}
                            onChange={(e) => setConnectionForm(prev => ({ ...prev, host: e.target.value }))}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                              id="username"
                              placeholder="ubuntu"
                              value={connectionForm.username}
                              onChange={(e) => setConnectionForm(prev => ({ ...prev, username: e.target.value }))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="port">Port</Label>
                            <Input
                              id="port"
                              type="number"
                              value={connectionForm.port}
                              onChange={(e) => setConnectionForm(prev => ({ ...prev, port: Number(e.target.value) }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="authMethod">Auth Method</Label>
                          <select
                            id="authMethod"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={connectionForm.authMethod}
                            onChange={(e) => {
                              const next = e.target.value as 'pem' | 'password';
                              setConnectionForm(prev => ({
                                ...prev,
                                authMethod: next,
                                credentialId: next === 'password' ? '' : prev.credentialId,
                                password: next === 'pem' ? '' : prev.password
                              }));
                            }}
                          >
                            <option value="pem">SSH Key</option>
                            <option value="password">Password</option>
                          </select>
                        </div>

                        {connectionForm.authMethod === 'pem' && (
                          <div className="space-y-2">
                            <Label htmlFor="credentialId">SSH Key</Label>
                            <select
                              id="credentialId"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={connectionForm.credentialId}
                              onChange={(e) => {
                                const nextId = e.target.value;
                                setConnectionForm(prev => ({
                                  ...prev,
                                  credentialId: nextId
                                }));
                              }}
                            >
                              <option value="">Select a key</option>
                              {keys.map((key) => (
                                <option key={key.id} value={key.id}>
                                  {key.name} ({key.type.toUpperCase()})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {connectionForm.authMethod === 'password' && (
                          <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                              id="password"
                              type="password"
                              placeholder="Server password"
                              value={connectionForm.password}
                              onChange={(e) => setConnectionForm(prev => ({ ...prev, password: e.target.value }))}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="hostKeyPolicy">Host Key Policy</Label>
                          <select
                            id="hostKeyPolicy"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={connectionForm.hostKeyPolicy}
                            onChange={(e) =>
                              setConnectionForm(prev => ({
                                ...prev,
                                hostKeyPolicy: e.target.value as 'strict' | 'accept-new'
                              }))
                            }
                          >
                            <option value="strict">Strict</option>
                            <option value="accept-new">Accept New</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="knownHostsPath">Known Hosts Path (optional)</Label>
                          <Input
                            id="knownHostsPath"
                            placeholder="/Users/you/.ssh/known_hosts"
                            value={connectionForm.knownHostsPath}
                            onChange={(e) =>
                              setConnectionForm(prev => ({ ...prev, knownHostsPath: e.target.value }))
                            }
                          />
                        </div>

                        {connectionError && (
                          <p className="text-sm text-destructive">{connectionError}</p>
                        )}
                      </div>

                      <SheetFooter>
                        <Button variant="outline" onClick={() => setConnectionSheetOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleConnectionSave}>
                          {editingConnectionId ? 'Update' : 'Create'}
                        </Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </div>

                {connections.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Server className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No connections yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">Create your first SSH profile to get started</p>
                      <Button onClick={() => setConnectionSheetOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Connection
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {connections.map((profile) => (
                      <Card key={profile.id} className="hover:border-primary/50 transition-colors">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span className="truncate">{profile.name}</span>
                            <div className={`h-2 w-2 rounded-full ${terminalSessions.some(s => s.profile.id === profile.id && s.connected) ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                          </CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {profile.username}@{profile.host}:{profile.port}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="gap-2">
                          <Button size="sm" onClick={() => connectToProfile(profile)} className="flex-1">
                            <TerminalIcon className="h-3 w-3 mr-1" />
                            Connect
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingConnectionId(profile.id);
                              setConnectionForm({
                                name: profile.name,
                                host: profile.host,
                                username: profile.username,
                                port: profile.port,
                                credentialId: profile.credentialId ?? '',
                                authMethod: profile.authMethod,
                                password: '',
                                hostKeyPolicy: profile.hostKeyPolicy ?? 'strict',
                                knownHostsPath: profile.knownHostsPath ?? ''
                              });
                              setConnectionSheetOpen(true);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (window.confirm('Delete this connection?')) {
                                await window.wagterm.storage.deleteConnection({ id: profile.id });
                                await loadConnections();
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'keys' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">SSH Keys</h3>
                  <p className="text-sm text-muted-foreground">Generate or import keys (ED25519, RSA, PEM)</p>
                </div>

                <Sheet open={keySheetOpen} onOpenChange={setKeySheetOpen}>
                  <SheetTrigger asChild>
                    <Button onClick={() => resetKeyForm()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Key
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>{editingKeyId ? 'Edit SSH Key' : 'Add SSH Key'}</SheetTitle>
                      <SheetDescription>
                        {editingKeyId ? 'Update key metadata or secrets.' : 'Import or generate a new SSH key for authentication'}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-4 py-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="keyName">Name</Label>
                          <Input
                            id="keyName"
                            placeholder="Deploy key"
                            value={keyForm.name}
                            onChange={(e) => setKeyForm(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="keyKind">Type</Label>
                          <select
                            id="keyKind"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={keyForm.kind}
                            onChange={(e) => {
                              const nextKind = e.target.value as 'ssh' | 'pem';
                              setKeyForm(prev => ({
                                ...prev,
                                kind: nextKind,
                                publicKey: nextKind === 'pem' ? '' : prev.publicKey,
                                privateKey: nextKind === 'pem' ? '' : prev.privateKey,
                                path: nextKind === 'ssh' ? '' : prev.path
                              }));
                            }}
                          >
                            <option value="ssh">SSH Key</option>
                            <option value="pem">PEM File</option>
                          </select>
                        </div>
                      </div>

                      {keyForm.kind === 'pem' ? (
                        <div className="space-y-2">
                          <Label htmlFor="pemFile">PEM File</Label>
                          <Input
                            id="pemFile"
                            type="file"
                            accept=".pem,.key,.ppk"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              const filePath = (file as File & { path?: string })?.path ?? '';
                              if (!filePath) {
                                return;
                              }
                              setKeyForm((prev) => ({
                                ...prev,
                                path: filePath
                              }));
                            }}
                          />
                          {keyForm.path && (
                            <p className="text-xs text-muted-foreground">Selected: {keyForm.path}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="publicKey">Public Key</Label>
                            <Input
                              id="publicKey"
                              placeholder="ssh-ed25519 AAAA..."
                              value={keyForm.publicKey}
                              onChange={(e) => setKeyForm(prev => ({ ...prev, publicKey: e.target.value }))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="privateKey">Private Key</Label>
                            <textarea
                              id="privateKey"
                              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              placeholder={editingKeyId ? 'Leave blank to keep current private key' : '-----BEGIN OPENSSH PRIVATE KEY-----'}
                              value={keyForm.privateKey}
                              onChange={(e) => setKeyForm(prev => ({ ...prev, privateKey: e.target.value }))}
                            />
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Detected: {detectedKeyType ? detectedKeyType.toUpperCase() : 'Unknown'}
                          </p>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="fingerprint">Fingerprint (optional)</Label>
                        <Input
                          id="fingerprint"
                          placeholder="SHA256:..."
                          value={keyForm.fingerprint}
                          onChange={(e) => setKeyForm(prev => ({ ...prev, fingerprint: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="passphrase">Passphrase (optional)</Label>
                        <Input
                          id="passphrase"
                          type="password"
                          placeholder={editingKeyId ? 'Leave blank to keep current passphrase' : 'Passphrase'}
                          value={keyForm.passphrase}
                          onChange={(e) => setKeyForm(prev => ({ ...prev, passphrase: e.target.value }))}
                        />
                      </div>

                      {keyError && (
                        <p className="text-sm text-destructive">{keyError}</p>
                      )}
                    </div>

                    <SheetFooter>
                      <Button variant="outline" onClick={() => setKeySheetOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleKeySave}>
                        Save Key
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>

              {keys.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Key className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No keys stored</h3>
                    <p className="text-sm text-muted-foreground mb-4">Add a PEM file or generate a new keypair</p>
                    <Button onClick={() => setKeySheetOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Key
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {keys.map((key) => (
                    <Card key={key.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <CardTitle className="text-base">{key.name}</CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {key.type.toUpperCase()} {key.fingerprint}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingKeyId(key.id);
                            setKeyForm({
                              name: key.name,
                              kind: key.type === 'pem' ? 'pem' : 'ssh',
                              publicKey: '',
                              privateKey: '',
                              fingerprint: key.fingerprint ?? '',
                              path: key.path ?? '',
                              passphrase: ''
                            });
                            setKeySheetOpen(true);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            if (window.confirm('Delete this key?')) {
                              await window.wagterm.storage.deleteKey({ id: key.id });
                              await loadKeys();
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'settings' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold">Settings</h3>
                <p className="text-sm text-muted-foreground">Local preferences for SSH, security, and UI</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Host Key Policy', description: 'Choose strict or accept-new behavior for known hosts.' },
                  { title: 'Session Defaults', description: 'Default shell size, fonts, and session timeouts.' },
                  { title: 'Security', description: 'Lock screen, local encryption, and audit logs.' },
                  { title: 'Tooling', description: 'Manage MCP tools and local integrations.' }
                ].map((item) => (
                  <Card key={item.title}>
                    <CardHeader>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button variant="outline" size="sm">Configure</Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}
              </div>
            </main>
          )}

          {/* Session Tab Content */}
          {terminalSessions.map((session) => (
            <div
              key={session.id}
              className={activeTab === session.id ? 'flex-1 flex overflow-hidden' : 'hidden'}
            >
              {/* Terminal Area */}
              <main className="flex-1 flex flex-col overflow-hidden border-r border-border">
                <div className="p-4 border-b border-border">
                  <p className="text-xs font-mono text-muted-foreground">{session.status}</p>
                </div>

                <div className="flex-1 bg-black overflow-hidden">
                  <div
                    className="h-full w-full wagterm-terminal"
                    ref={(element) => attachTerminal(session.id, element)}
                  />
                </div>
              </main>

              {/* AI Conversation Pane */}
              <aside className="w-96 bg-card flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {(commandProposals.get(session.id)?.length ?? 0) > 0 && (
                    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Proposed Commands</div>
                      {(commandProposals.get(session.id) ?? []).map((proposal) => (
                        <div key={proposal.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <code className="text-xs text-foreground font-mono break-all">{proposal.command}</code>
                            {proposal.risk && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  proposal.risk === 'high'
                                    ? 'bg-red-500/20 text-red-200'
                                    : proposal.risk === 'medium'
                                      ? 'bg-yellow-500/20 text-yellow-200'
                                      : 'bg-emerald-500/20 text-emerald-200'
                                }`}
                              >
                                {proposal.risk}
                              </span>
                            )}
                          </div>

                          {proposal.rationale && (
                            <p className="text-xs text-muted-foreground">{proposal.rationale}</p>
                          )}

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveCommand(session.id, proposal.id)}
                              disabled={proposal.status !== 'pending'}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectCommand(session.id, proposal.id)}
                              disabled={proposal.status !== 'pending'}
                            >
                              Reject
                            </Button>
                            {proposal.status !== 'pending' && (
                              <span className="text-[11px] uppercase text-muted-foreground">
                                {proposal.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!conversationMessages.get(session.id) || conversationMessages.get(session.id)!.length === 0) ? (
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
                    conversationMessages.get(session.id)!.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`rounded-lg px-4 py-2 max-w-[85%] ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
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
                        onChange={(e) => setConversationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendConversation();
                          }
                        }}
                        rows={1}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = target.scrollHeight + 'px';
                        }}
                      />

                      <div className="flex items-center justify-end gap-2 px-2">
                        <div className="relative">
                          <select
                            className="appearance-none bg-transparent text-xs text-muted-foreground pr-4 py-1 cursor-pointer focus:outline-none"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
