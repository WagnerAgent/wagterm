import React from 'react';
import { Edit2, Plus, Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import type { ConnectionProfile, KeyRecord, TerminalSession } from './types';

type ConnectionForm = {
  name: string;
  host: string;
  username: string;
  port: number;
  credentialId: string;
  authMethod: 'pem' | 'password';
  password: string;
  hostKeyPolicy: 'strict' | 'accept-new';
  knownHostsPath: string;
};

type ConnectionsPaneProps = {
  connections: ConnectionProfile[];
  keys: KeyRecord[];
  terminalSessions: TerminalSession[];
  connectionSheetOpen: boolean;
  setConnectionSheetOpen: (open: boolean) => void;
  connectionForm: ConnectionForm;
  setConnectionForm: React.Dispatch<React.SetStateAction<ConnectionForm>>;
  connectionError: string;
  editingConnectionId: string | null;
  setEditingConnectionId: (id: string | null) => void;
  resetConnectionForm: () => void;
  handleConnectionSave: () => void;
  loadConnections: () => Promise<void>;
  connectToProfile: (profile: ConnectionProfile) => void;
};

const ConnectionsPane = ({
  connections,
  keys,
  terminalSessions,
  connectionSheetOpen,
  setConnectionSheetOpen,
  connectionForm,
  setConnectionForm,
  connectionError,
  editingConnectionId,
  setEditingConnectionId,
  resetConnectionForm,
  handleConnectionSave,
  loadConnections,
  connectToProfile
}: ConnectionsPaneProps) => {
  return (
    <div className="space-y-8">
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
                    onChange={(event) => setConnectionForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    placeholder="1.2.3.4"
                    value={connectionForm.host}
                    onChange={(event) => setConnectionForm((prev) => ({ ...prev, host: event.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="ubuntu"
                      value={connectionForm.username}
                      onChange={(event) => setConnectionForm((prev) => ({ ...prev, username: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={connectionForm.port}
                      onChange={(event) => setConnectionForm((prev) => ({ ...prev, port: Number(event.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authMethod">Auth Method</Label>
                  <select
                    id="authMethod"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={connectionForm.authMethod}
                    onChange={(event) => {
                      const next = event.target.value as 'pem' | 'password';
                      setConnectionForm((prev) => ({
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
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setConnectionForm((prev) => ({
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
                      onChange={(event) => setConnectionForm((prev) => ({ ...prev, password: event.target.value }))}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="hostKeyPolicy">Host Key Policy</Label>
                  <select
                    id="hostKeyPolicy"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={connectionForm.hostKeyPolicy}
                    onChange={(event) =>
                      setConnectionForm((prev) => ({
                        ...prev,
                        hostKeyPolicy: event.target.value as 'strict' | 'accept-new'
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
                    onChange={(event) =>
                      setConnectionForm((prev) => ({ ...prev, knownHostsPath: event.target.value }))
                    }
                  />
                </div>

                {connectionError && <p className="text-sm text-destructive">{connectionError}</p>}
              </div>

              <SheetFooter>
                <Button variant="outline" onClick={() => setConnectionSheetOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConnectionSave}>{editingConnectionId ? 'Update' : 'Create'}</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {connections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TerminalIcon className="h-12 w-12 text-muted-foreground mb-4" />
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
                    <div
                      className={`h-2 w-2 rounded-full ${
                        terminalSessions.some((session) => session.profile.id === profile.id && session.connected)
                          ? 'bg-green-500'
                          : 'bg-muted-foreground/30'
                      }`}
                    />
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
  );
};

export default ConnectionsPane;
