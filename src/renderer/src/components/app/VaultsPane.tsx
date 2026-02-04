import React from 'react';
import { Key, Plus, LayoutGrid, List, Sparkles, ArrowUp, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import VaultsHeader from './VaultsHeader';
import VaultsStats from './VaultsStats';
import VaultCard from './VaultCard';
import type { KeyRecord } from './types';

type KeyForm = {
  name: string;
  kind: 'ssh' | 'pem';
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  path: string;
  passphrase: string;
};

type VaultsPaneProps = {
  keys: KeyRecord[];
  keySheetOpen: boolean;
  setKeySheetOpen: (open: boolean) => void;
  keyForm: KeyForm;
  setKeyForm: React.Dispatch<React.SetStateAction<KeyForm>>;
  keyError: string;
  editingKeyId: string | null;
  setEditingKeyId: (id: string | null) => void;
  resetKeyForm: () => void;
  handleKeySave: () => void;
  loadKeys: () => Promise<void>;
  detectedKeyType: string | null;
};

const VaultsPane = ({
  keys,
  keySheetOpen,
  setKeySheetOpen,
  keyForm,
  setKeyForm,
  keyError,
  editingKeyId,
  setEditingKeyId,
  resetKeyForm,
  handleKeySave,
  loadKeys,
  detectedKeyType
}: VaultsPaneProps) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-background">
      <VaultsHeader
        onNewSecret={() => {
          resetKeyForm();
          setKeySheetOpen(true);
        }}
      />

      {/* Content area with floating AI prompt */}
      <div className="flex-1 relative overflow-hidden">
        {/* Scrollable content */}
        <div className="absolute inset-0 overflow-y-auto p-8 pb-24">
          <VaultsStats totalSecrets={keys.length} />

          {/* Section heading + view toggle */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
              Managed Secrets
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="p-1.5 rounded text-white bg-neutral-800"
              >
                <LayoutGrid className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded text-neutral-500 hover:text-neutral-300"
              >
                <List className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {/* Cards grid or empty state */}
          {keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-16 w-16 rounded-xl bg-neutral-900 flex items-center justify-center border border-neutral-800 mb-6">
                <Key className="h-8 w-8 text-neutral-600" />
              </div>
              <h3 className="text-base font-medium text-white mb-2">No secrets stored</h3>
              <p className="text-sm text-neutral-500 mb-6">
                Add a PEM file or import an SSH key to get started
              </p>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-white/20 text-xs font-medium rounded-md text-white bg-white/5 hover:bg-white/10 transition-colors"
                onClick={() => {
                  resetKeyForm();
                  setKeySheetOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Secret
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
              {keys.map((key) => (
                <VaultCard
                  key={key.id}
                  record={key}
                  onEdit={() => {
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
                  onDelete={async () => {
                    if (window.confirm('Delete this secret?')) {
                      await window.wagterm.storage.deleteKey({ id: key.id });
                      await loadKeys();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Floating AI prompt */}
        <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center pointer-events-none">
          <div className="w-full max-w-2xl px-8 pointer-events-auto">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Sparkles className="h-5 w-5 text-neutral-500 group-focus-within:text-white transition-colors" />
              </div>
              <input
                className="block w-full pl-12 pr-12 py-3.5 border border-border rounded-xl leading-5 bg-card text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 shadow-lg transition-all"
                placeholder="Ask AI to rotate the AWS root key or generate a new SSH pair..."
                type="text"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  type="button"
                  className="p-1 rounded-md text-neutral-500 hover:text-white transition-colors"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sheet for add/edit */}
      <Sheet open={keySheetOpen} onOpenChange={setKeySheetOpen}>
        <SheetContent className="!max-w-md !p-0 !bg-[#080808] !border-l !border-border flex flex-col !gap-0">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 border-b border-border/50">
            <h2 className="text-lg font-medium text-white">
              {editingKeyId ? 'Edit Secret' : 'New Secret'}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {editingKeyId
                ? 'Update key metadata or secrets.'
                : 'Import or generate a new SSH key for authentication'}
            </p>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
            {/* Name & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300" htmlFor="v-name">
                  Name
                </label>
                <input
                  id="v-name"
                  className="w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors"
                  placeholder="Deploy key"
                  value={keyForm.name}
                  onChange={(e) => setKeyForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300" htmlFor="v-kind">
                  Type
                </label>
                <div className="relative">
                  <select
                    id="v-kind"
                    className="w-full appearance-none bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 pr-8 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors"
                    value={keyForm.kind}
                    onChange={(e) => {
                      const nextKind = e.target.value as 'ssh' | 'pem';
                      setKeyForm((prev) => ({
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
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {keyForm.kind === 'pem' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300" htmlFor="v-pem">
                  PEM File
                </label>
                <input
                  id="v-pem"
                  type="file"
                  accept=".pem,.key,.ppk"
                  className="w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-neutral-700 file:bg-neutral-900 file:text-neutral-300 file:text-xs focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const buffer = await file.arrayBuffer();
                    const result = await window.wagterm.storage.importPem({
                      fileName: file.name,
                      data: Array.from(new Uint8Array(buffer))
                    });
                    setKeyForm((prev) => ({ ...prev, path: result.path }));
                  }}
                />
                {keyForm.path && (
                  <p className="text-xs text-neutral-500">Selected: {keyForm.path}</p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300" htmlFor="v-pubkey">
                    Public Key
                  </label>
                  <input
                    id="v-pubkey"
                    className="w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white text-sm placeholder-neutral-600 font-mono focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors"
                    placeholder="ssh-ed25519 AAAA..."
                    value={keyForm.publicKey}
                    onChange={(e) =>
                      setKeyForm((prev) => ({ ...prev, publicKey: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300" htmlFor="v-privkey">
                    Private Key
                  </label>
                  <textarea
                    id="v-privkey"
                    className="min-h-[120px] w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white text-sm placeholder-neutral-600 font-mono focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors resize-none"
                    placeholder={
                      editingKeyId
                        ? 'Leave blank to keep current private key'
                        : '-----BEGIN OPENSSH PRIVATE KEY-----'
                    }
                    value={keyForm.privateKey}
                    onChange={(e) =>
                      setKeyForm((prev) => ({ ...prev, privateKey: e.target.value }))
                    }
                  />
                </div>
                <p className="text-xs text-neutral-500">
                  Detected: {detectedKeyType ? detectedKeyType.toUpperCase() : 'Unknown'}
                </p>
              </>
            )}

            {/* Fingerprint */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300" htmlFor="v-fingerprint">
                Fingerprint <span className="text-neutral-600">(optional)</span>
              </label>
              <input
                id="v-fingerprint"
                className="w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white text-sm placeholder-neutral-600 font-mono focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors"
                placeholder="SHA256:..."
                value={keyForm.fingerprint}
                onChange={(e) =>
                  setKeyForm((prev) => ({ ...prev, fingerprint: e.target.value }))
                }
              />
            </div>

            {/* Passphrase */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300" htmlFor="v-passphrase">
                Passphrase <span className="text-neutral-600">(optional)</span>
              </label>
              <input
                id="v-passphrase"
                type="password"
                className="w-full bg-[#111] border border-neutral-800 rounded-lg py-2.5 px-3 text-white text-sm placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-white transition-colors"
                placeholder={editingKeyId ? 'Leave blank to keep current passphrase' : 'Passphrase'}
                value={keyForm.passphrase}
                onChange={(e) =>
                  setKeyForm((prev) => ({ ...prev, passphrase: e.target.value }))
                }
              />
            </div>

            {keyError && (
              <p className="text-sm text-red-400">{keyError}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-border/50 flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-colors"
              onClick={() => setKeySheetOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors shadow-glow"
              onClick={handleKeySave}
            >
              {editingKeyId ? 'Save Changes' : 'Create Secret'}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default VaultsPane;
