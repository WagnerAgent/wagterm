import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Plus, Terminal, Key, Settings, X, Edit2, Trash2, Server } from 'lucide-react';
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
};

type KeyRecord = {
  id: string;
  name: string;
  type: 'ed25519' | 'rsa' | 'pem';
  fingerprint?: string;
};

type TerminalSession = {
  id: string;
  profile: ConnectionProfile;
  output: string;
  status: string;
  connected: boolean;
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
  authMethod: 'pem' as const,
  credentialId: ''
};

const emptyKeyForm = {
  name: '',
  type: 'ed25519' as const,
  publicKey: '',
  fingerprint: '',
  path: '',
  secret: ''
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

  // Terminal sessions state
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionInput, setSessionInput] = useState('');

  // Chrome-style tabs state
  const [activeTab, setActiveTab] = useState<'connections' | string>('connections');

  // AI Conversation state - per session
  const [conversationMessages, setConversationMessages] = useState<Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>>(new Map());
  const [conversationInput, setConversationInput] = useState('');

  const sessionReceivedData = useRef<Map<string, boolean>>(new Map());
  const connectTimeouts = useRef<Map<string, number>>(new Map());
  const sessionListeners = useRef<Map<string, { onData: () => void; onExit: () => void }>>(new Map());

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

  const resetConnectionForm = () => {
    setConnectionForm(emptyConnectionForm);
    setConnectionError('');
    setEditingConnectionId(null);
  };

  const resetKeyForm = () => {
    setKeyForm(emptyKeyForm);
    setKeyError('');
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

    // Remove session from state
    setTerminalSessions(prev => prev.filter(s => s.id !== sessionId));

    // Remove conversation messages for this session
    setConversationMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });

    // If this was the active tab, switch back to connections
    if (activeTab === sessionId) {
      setActiveTab('connections');
    }
  }, [activeTab]);

  const appendSessionOutput = (sessionId: string, text: string) => {
    setTerminalSessions(prev =>
      prev.map(session =>
        session.id === sessionId
          ? { ...session, output: session.output + text }
          : session
      )
    );
  };

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
    // Create a new terminal session
    const response = await window.wagterm.sshSession.start({
      profile,
      cols: 100,
      rows: 30
    });

    const newSession: TerminalSession = {
      id: response.sessionId,
      profile,
      output: '',
      status: `Connecting to ${profile.username}@${profile.host}...`,
      connected: false
    };

    setTerminalSessions(prev => [...prev, newSession]);
    setActiveSessionId(response.sessionId);

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
      appendSessionOutput(response.sessionId, payload.data);
    });

    // Set up exit listener
    const removeExitListener = window.wagterm.sshSession.onExit((payload) => {
      if (payload.sessionId !== response.sessionId) return;

      const timeout = connectTimeouts.current.get(response.sessionId);
      if (timeout) {
        window.clearTimeout(timeout);
        connectTimeouts.current.delete(response.sessionId);
      }

      appendSessionOutput(response.sessionId, `\n[session closed exit=${payload.exitCode ?? 'null'}]\n`);

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
    const payload = {
      profile: {
        id: editingConnectionId ?? crypto.randomUUID(),
        name: connectionForm.name.trim(),
        host: connectionForm.host.trim(),
        port: Number(connectionForm.port),
        username: connectionForm.username.trim(),
        authMethod: connectionForm.authMethod,
        credentialId: connectionForm.credentialId.trim() || undefined
      }
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
    try {
      await window.wagterm.storage.addKey({
        key: {
          id: crypto.randomUUID(),
          name: keyForm.name.trim(),
          type: keyForm.type,
          publicKey: keyForm.publicKey.trim() || undefined,
          fingerprint: keyForm.fingerprint.trim() || undefined,
          path: keyForm.path.trim() || undefined
        },
        secret: keyForm.secret.trim() || undefined
      });
      setKeySheetOpen(false);
      resetKeyForm();
      await loadKeys();
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : 'Failed to save key.');
    }
  };

  const handleSendInput = () => {
    if (!activeTab || activeTab === 'connections' || !sessionInput.trim()) return;

    void window.wagterm.sshSession.sendInput({
      sessionId: activeTab,
      data: `${sessionInput}\n`
    });
    setSessionInput('');
  };

  const handleSendConversation = () => {
    if (!conversationInput.trim() || !activeTab || activeTab === 'connections') return;

    const userMessage = conversationInput.trim();
    const sessionId = activeTab;

    setConversationMessages(prev => {
      const newMap = new Map(prev);
      const messages = newMap.get(sessionId) || [];
      newMap.set(sessionId, [...messages, { role: 'user', content: userMessage }]);
      return newMap;
    });
    setConversationInput('');

    // TODO: Integrate with AI backend
    // For now, just add a placeholder response
    setTimeout(() => {
      setConversationMessages(prev => {
        const newMap = new Map(prev);
        const messages = newMap.get(sessionId) || [];
        newMap.set(sessionId, [
          ...messages,
          { role: 'assistant', content: 'AI response coming soon. This will help you generate commands and scripts.' }
        ]);
        return newMap;
      });
    }, 500);
  };

  useEffect(() => {
    return () => {
      // Cleanup all listeners on unmount
      sessionListeners.current.forEach(listeners => {
        listeners.onData();
        listeners.onExit();
      });
      connectTimeouts.current.forEach(timeout => window.clearTimeout(timeout));
    };
  }, []);

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
                setActiveSessionId(session.id);
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
                            onChange={(e) => setConnectionForm(prev => ({ ...prev, authMethod: e.target.value as 'pem' | 'password' }))}
                          >
                            <option value="pem">PEM</option>
                            <option value="password">Password</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="credentialId">Credential ID (optional)</Label>
                          <Input
                            id="credentialId"
                            placeholder="key-id"
                            value={connectionForm.credentialId}
                            onChange={(e) => setConnectionForm(prev => ({ ...prev, credentialId: e.target.value }))}
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
                            <Terminal className="h-3 w-3 mr-1" />
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
                                authMethod: profile.authMethod,
                                credentialId: profile.credentialId ?? ''
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
                      <SheetTitle>Add SSH Key</SheetTitle>
                      <SheetDescription>
                        Import or generate a new SSH key for authentication
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
                          <Label htmlFor="keyType">Type</Label>
                          <select
                            id="keyType"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={keyForm.type}
                            onChange={(e) => setKeyForm(prev => ({ ...prev, type: e.target.value as 'ed25519' | 'rsa' | 'pem' }))}
                          >
                            <option value="ed25519">ED25519</option>
                            <option value="rsa">RSA</option>
                            <option value="pem">PEM File</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="publicKey">Public Key (optional)</Label>
                        <Input
                          id="publicKey"
                          placeholder="ssh-ed25519 AAAA..."
                          value={keyForm.publicKey}
                          onChange={(e) => setKeyForm(prev => ({ ...prev, publicKey: e.target.value }))}
                        />
                      </div>

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
                        <Label htmlFor="path">PEM Path (optional)</Label>
                        <Input
                          id="path"
                          placeholder="/Users/you/.ssh/id_ed25519"
                          value={keyForm.path}
                          onChange={(e) => setKeyForm(prev => ({ ...prev, path: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="secret">Secret (optional)</Label>
                        <Input
                          id="secret"
                          type="password"
                          placeholder="Passphrase"
                          value={keyForm.secret}
                          onChange={(e) => setKeyForm(prev => ({ ...prev, secret: e.target.value }))}
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
                <div className="space-y-3">
                  {keys.map((key) => (
                    <Card key={key.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{key.name}</CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {key.type.toUpperCase()} {key.fingerprint}
                        </CardDescription>
                      </CardHeader>
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
            activeTab === session.id && (
              <React.Fragment key={session.id}>
                {/* Terminal Area */}
                <main className="flex-1 flex flex-col overflow-hidden border-r border-border">
                  <div className="p-4 border-b border-border">
                    <p className="text-xs font-mono text-muted-foreground">{session.status}</p>
                  </div>

                  <div className="flex-1 bg-black p-4 overflow-auto">
                    <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                      {session.output || 'Session output will appear here...'}
                    </pre>
                  </div>

                  <div className="p-4 border-t border-border bg-card">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a command and press Enter"
                        className="flex-1 font-mono bg-background"
                        value={sessionInput}
                        onChange={(e) => setSessionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendInput();
                          }
                        }}
                        disabled={!session.connected}
                      />
                      <Button onClick={handleSendInput} disabled={!session.connected}>
                        Send
                      </Button>
                    </div>
                  </div>
                </main>

                {/* AI Conversation Pane */}
                <aside className="w-96 bg-card flex flex-col">
                  <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold">AI Assistant</h3>
                    <p className="text-xs text-muted-foreground mt-1">Ask for help with commands and scripts</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {(!conversationMessages.get(session.id) || conversationMessages.get(session.id)!.length === 0) ? (
                      <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="bg-muted/50 rounded-full p-4 mb-4">
                          <Terminal className="h-8 w-8 text-muted-foreground" />
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
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask for help with commands..."
                        className="flex-1"
                        value={conversationInput}
                        onChange={(e) => setConversationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendConversation();
                          }
                        }}
                      />
                      <Button onClick={handleSendConversation} size="icon">
                        <Terminal className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Press Enter to send, Shift+Enter for new line
                    </p>
                  </div>
                </aside>
              </React.Fragment>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
