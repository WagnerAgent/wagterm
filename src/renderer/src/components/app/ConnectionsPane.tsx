import React from 'react';
import { Plus, Terminal as TerminalIcon, LayoutGrid, List, Sparkles, ArrowUp, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import type { ConnectionProfile, KeyRecord, TerminalSession } from './types';
import DashboardHeader from './DashboardHeader';
import DashboardStats from './DashboardStats';
import ConnectionCard from './ConnectionCard';

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
  jumpEnabled: boolean;
  jumpHost: string;
  jumpPort: number;
  jumpUsername: string;
  jumpCredentialId: string;
  jumpAuthMethod: 'pem' | 'password';
  jumpHostKeyPolicy: 'strict' | 'accept-new';
  jumpKnownHostsPath: string;
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
  const activeSessions = terminalSessions.filter((s) => s.connected).length;

  const openEditSheet = (profile: ConnectionProfile) => {
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
      knownHostsPath: profile.knownHostsPath ?? '',
      jumpEnabled: Boolean(profile.jumpHost),
      jumpHost: profile.jumpHost?.host ?? '',
      jumpPort: profile.jumpHost?.port ?? 22,
      jumpUsername: profile.jumpHost?.username ?? '',
      jumpCredentialId: profile.jumpHost?.credentialId ?? '',
      jumpAuthMethod: profile.jumpHost?.authMethod ?? 'pem',
      jumpHostKeyPolicy: profile.jumpHost?.hostKeyPolicy ?? 'strict',
      jumpKnownHostsPath: profile.jumpHost?.knownHostsPath ?? ''
    });
    setConnectionSheetOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      <DashboardHeader
        onAddNew={() => {
          resetConnectionForm();
          setConnectionSheetOpen(true);
        }}
      />

      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 overflow-y-auto p-8 pb-24">
          {/* Stats grid */}
          <DashboardStats
            activeSessions={activeSessions}
            totalHosts={connections.length}
          />

          {/* Section title + view toggle */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Managed Hosts</h2>
            <div className="flex gap-2">
              <button type="button" className="p-1.5 rounded text-white bg-neutral-800">
                <LayoutGrid className="h-[18px] w-[18px]" />
              </button>
              <button type="button" className="p-1.5 rounded text-neutral-500 hover:text-neutral-300">
                <List className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {/* Connection cards grid */}
          {connections.length === 0 ? (
            <div className="bg-card rounded-xl p-12 border border-dashed border-border flex flex-col items-center justify-center">
              <TerminalIcon className="h-12 w-12 text-neutral-700 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No connections yet</h3>
              <p className="text-sm text-neutral-500 mb-6">Create your first SSH profile to get started</p>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 bg-white text-black text-xs font-medium rounded-md hover:bg-neutral-200 transition-colors shadow-glow"
                onClick={() => {
                  resetConnectionForm();
                  setConnectionSheetOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Connection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connections.map((profile) => (
                <ConnectionCard
                  key={profile.id}
                  profile={profile}
                  isConnected={terminalSessions.some(
                    (s) => s.profile.id === profile.id && s.connected
                  )}
                  onConnect={() => connectToProfile(profile)}
                  onEdit={() => openEditSheet(profile)}
                  onDelete={async () => {
                    if (window.confirm('Delete this connection?')) {
                      await window.wagterm.storage.deleteConnection({ id: profile.id });
                      await loadConnections();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* AI prompt bar — floating at bottom center */}
        <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center px-8 pointer-events-none">
          <div className="relative group w-full max-w-2xl pointer-events-auto">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Sparkles className="h-5 w-5 text-neutral-500 group-focus-within:text-white transition-colors" />
            </div>
            <input
              className="block w-full pl-12 pr-12 py-3.5 border border-border rounded-xl leading-5 bg-card text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 shadow-2xl transition-all"
              placeholder="Ask AI to connect to servers with high CPU usage..."
              type="text"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <button type="button" className="p-1 rounded-md text-neutral-500 hover:text-white transition-colors">
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Connection edit/create sheet */}
      <Sheet open={connectionSheetOpen} onOpenChange={setConnectionSheetOpen}>
        <SheetContent className="!max-w-md !p-0 !bg-[#080808] !border-l !border-border flex flex-col !gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 border-b border-border/50">
            <h2 className="text-xl font-semibold text-white tracking-tight">
              {editingConnectionId ? 'Edit Connection' : 'New Connection'}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {editingConnectionId ? 'Update your SSH connection profile' : 'Create a new SSH connection profile'}
            </p>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300" htmlFor="name">Name</label>
              <input
                className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm transition-colors focus:outline-none"
                id="name"
                placeholder="Production EC2"
                type="text"
                value={connectionForm.name}
                onChange={(e) => setConnectionForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300" htmlFor="host">Host</label>
              <input
                className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                id="host"
                placeholder="1.2.3.4"
                type="text"
                value={connectionForm.host}
                onChange={(e) => setConnectionForm((prev) => ({ ...prev, host: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="block text-sm font-medium text-neutral-300" htmlFor="username">Username</label>
                <input
                  className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                  id="username"
                  placeholder="ubuntu"
                  type="text"
                  value={connectionForm.username}
                  onChange={(e) => setConnectionForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="col-span-1 space-y-2">
                <label className="block text-sm font-medium text-neutral-300" htmlFor="port">Port</label>
                <input
                  className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                  id="port"
                  placeholder="22"
                  type="number"
                  value={connectionForm.port}
                  onChange={(e) => setConnectionForm((prev) => ({ ...prev, port: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300" htmlFor="authMethod">Auth Method</label>
              <div className="relative">
                <select
                  className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 pl-3 pr-10 text-white focus:ring-1 focus:ring-white focus:border-white text-sm appearance-none transition-colors focus:outline-none"
                  id="authMethod"
                  value={connectionForm.authMethod}
                  onChange={(e) => {
                    const next = e.target.value as 'pem' | 'password';
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
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {connectionForm.authMethod === 'pem' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300" htmlFor="credentialId">SSH Key</label>
                <div className="relative">
                  <select
                    className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 pl-3 pr-10 text-neutral-400 focus:ring-1 focus:ring-white focus:border-white text-sm appearance-none transition-colors focus:outline-none"
                    id="credentialId"
                    value={connectionForm.credentialId}
                    onChange={(e) => setConnectionForm((prev) => ({ ...prev, credentialId: e.target.value }))}
                  >
                    <option value="">Select a key</option>
                    {keys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name} ({key.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            )}

            {connectionForm.authMethod === 'password' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-300" htmlFor="password">Password</label>
                <input
                  className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm transition-colors focus:outline-none"
                  id="password"
                  placeholder="Server password"
                  type="password"
                  value={connectionForm.password}
                  onChange={(e) => setConnectionForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300" htmlFor="hostKeyPolicy">Host Key Policy</label>
              <div className="relative">
                <select
                  className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 pl-3 pr-10 text-white focus:ring-1 focus:ring-white focus:border-white text-sm appearance-none transition-colors focus:outline-none"
                  id="hostKeyPolicy"
                  value={connectionForm.hostKeyPolicy}
                  onChange={(e) =>
                    setConnectionForm((prev) => ({
                      ...prev,
                      hostKeyPolicy: e.target.value as 'strict' | 'accept-new'
                    }))
                  }
                >
                  <option value="strict">Strict</option>
                  <option value="accept-new">Accept New</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-300" htmlFor="knownHostsPath">
                Known Hosts Path <span className="text-neutral-500 font-normal">(optional)</span>
              </label>
              <input
                className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-400 placeholder-neutral-700 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                id="knownHostsPath"
                placeholder="/Users/you/.ssh/known_hosts"
                type="text"
                value={connectionForm.knownHostsPath}
                onChange={(e) => setConnectionForm((prev) => ({ ...prev, knownHostsPath: e.target.value }))}
              />
            </div>

            <div className="pt-2 flex items-start">
              <div className="flex items-center h-5">
                <input
                  className="h-[1.15em] w-[1.15em] rounded-sm border border-neutral-700 bg-transparent checked:border-white appearance-none focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  id="jumpEnabled"
                  type="checkbox"
                  checked={connectionForm.jumpEnabled}
                  onChange={(e) =>
                    setConnectionForm((prev) => ({ ...prev, jumpEnabled: e.target.checked }))
                  }
                  style={{
                    backgroundImage: connectionForm.jumpEnabled
                      ? "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")"
                      : 'none',
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
              </div>
              <div className="ml-3 text-sm">
                <label className="font-medium text-neutral-400 cursor-pointer" htmlFor="jumpEnabled">
                  Connect via a bastion host
                </label>
                <p className="text-neutral-600 text-xs mt-0.5">Configure jump server details in next step</p>
              </div>
            </div>

            {connectionForm.jumpEnabled && (
              <div className="space-y-6 rounded-lg border border-neutral-800 p-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300" htmlFor="jumpHost">Jump Host</label>
                  <input
                    className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                    id="jumpHost"
                    placeholder="bastion.example.com"
                    type="text"
                    value={connectionForm.jumpHost}
                    onChange={(e) => setConnectionForm((prev) => ({ ...prev, jumpHost: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="block text-sm font-medium text-neutral-300" htmlFor="jumpUsername">Jump Username</label>
                    <input
                      className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                      id="jumpUsername"
                      placeholder="ubuntu"
                      type="text"
                      value={connectionForm.jumpUsername}
                      onChange={(e) => setConnectionForm((prev) => ({ ...prev, jumpUsername: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-1 space-y-2">
                    <label className="block text-sm font-medium text-neutral-300" htmlFor="jumpPort">Port</label>
                    <input
                      className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white placeholder-neutral-600 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                      id="jumpPort"
                      placeholder="22"
                      type="number"
                      value={connectionForm.jumpPort}
                      onChange={(e) => setConnectionForm((prev) => ({ ...prev, jumpPort: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300" htmlFor="jumpAuthMethod">Auth Method</label>
                  <div className="relative">
                    <select
                      className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 pl-3 pr-10 text-white focus:ring-1 focus:ring-white focus:border-white text-sm appearance-none transition-colors focus:outline-none"
                      id="jumpAuthMethod"
                      value={connectionForm.jumpAuthMethod}
                      onChange={(e) =>
                        setConnectionForm((prev) => ({
                          ...prev,
                          jumpAuthMethod: e.target.value as 'pem' | 'password',
                          jumpCredentialId: e.target.value === 'password' ? '' : prev.jumpCredentialId
                        }))
                      }
                    >
                      <option value="pem">SSH Key</option>
                      <option value="password" disabled>Password (coming soon)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {connectionForm.jumpAuthMethod === 'pem' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-300" htmlFor="jumpCredentialId">SSH Key</label>
                    <div className="relative">
                      <select
                        className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 pl-3 pr-10 text-neutral-400 focus:ring-1 focus:ring-white focus:border-white text-sm appearance-none transition-colors focus:outline-none"
                        id="jumpCredentialId"
                        value={connectionForm.jumpCredentialId}
                        onChange={(e) => setConnectionForm((prev) => ({ ...prev, jumpCredentialId: e.target.value }))}
                      >
                        <option value="">Select a key</option>
                        {keys.map((key) => (
                          <option key={key.id} value={key.id}>
                            {key.name} ({key.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300" htmlFor="jumpHostKeyPolicy">Host Key Policy</label>
                  <div className="relative">
                    <select
                      className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 pl-3 pr-10 text-white focus:ring-1 focus:ring-white focus:border-white text-sm appearance-none transition-colors focus:outline-none"
                      id="jumpHostKeyPolicy"
                      value={connectionForm.jumpHostKeyPolicy}
                      onChange={(e) =>
                        setConnectionForm((prev) => ({
                          ...prev,
                          jumpHostKeyPolicy: e.target.value as 'strict' | 'accept-new'
                        }))
                      }
                    >
                      <option value="strict">Strict</option>
                      <option value="accept-new">Accept New</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300" htmlFor="jumpKnownHostsPath">
                    Known Hosts Path <span className="text-neutral-500 font-normal">(optional)</span>
                  </label>
                  <input
                    className="block w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-400 placeholder-neutral-700 focus:ring-1 focus:ring-white focus:border-white text-sm font-mono transition-colors focus:outline-none"
                    id="jumpKnownHostsPath"
                    placeholder="/Users/you/.ssh/known_hosts"
                    type="text"
                    value={connectionForm.jumpKnownHostsPath}
                    onChange={(e) => setConnectionForm((prev) => ({ ...prev, jumpKnownHostsPath: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {connectionError && <p className="text-sm text-red-400">{connectionError}</p>}
          </div>

          {/* Footer */}
          <div className="border-t border-border p-6 flex justify-end gap-3 bg-[#080808]">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white border border-neutral-800 rounded-md hover:bg-neutral-800 transition-colors"
              onClick={() => setConnectionSheetOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-6 py-2 text-sm font-medium text-black bg-white rounded-md hover:bg-neutral-200 shadow-glow transition-colors"
              onClick={handleConnectionSave}
            >
              {editingConnectionId ? 'Update' : 'Create'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ConnectionsPane;
