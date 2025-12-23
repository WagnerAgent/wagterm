import React from 'react';
import { Edit2, Key, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
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

type KeysPaneProps = {
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

const KeysPane = ({
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
}: KeysPaneProps) => {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">SSH Keys</h3>
          <p className="text-sm text-muted-foreground mt-1">Generate or import keys (ED25519, RSA, PEM)</p>
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
                    onChange={(event) => setKeyForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyKind">Type</Label>
                  <select
                    id="keyKind"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={keyForm.kind}
                    onChange={(event) => {
                      const nextKind = event.target.value as 'ssh' | 'pem';
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
                  {keyForm.path && <p className="text-xs text-muted-foreground">Selected: {keyForm.path}</p>}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="publicKey">Public Key</Label>
                    <Input
                      id="publicKey"
                      placeholder="ssh-ed25519 AAAA..."
                      value={keyForm.publicKey}
                      onChange={(event) => setKeyForm((prev) => ({ ...prev, publicKey: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="privateKey">Private Key</Label>
                    <textarea
                      id="privateKey"
                      className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={editingKeyId ? 'Leave blank to keep current private key' : '-----BEGIN OPENSSH PRIVATE KEY-----'}
                      value={keyForm.privateKey}
                      onChange={(event) => setKeyForm((prev) => ({ ...prev, privateKey: event.target.value }))}
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
                  onChange={(event) => setKeyForm((prev) => ({ ...prev, fingerprint: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="passphrase">Passphrase (optional)</Label>
                <Input
                  id="passphrase"
                  type="password"
                  placeholder={editingKeyId ? 'Leave blank to keep current passphrase' : 'Passphrase'}
                  value={keyForm.passphrase}
                  onChange={(event) => setKeyForm((prev) => ({ ...prev, passphrase: event.target.value }))}
                />
              </div>

              {keyError && <p className="text-sm text-destructive">{keyError}</p>}
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={() => setKeySheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleKeySave}>Save Key</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
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
    </div>
  );
};

export default KeysPane;
