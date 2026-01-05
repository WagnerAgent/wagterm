import { useCallback, useMemo, useState } from 'react';
import type { ConnectionProfile, KeyRecord } from '../components/app/types';

const emptyConnectionForm = {
  name: '',
  host: '',
  username: '',
  port: 22,
  credentialId: '',
  authMethod: 'pem' as 'pem' | 'password',
  password: '',
  hostKeyPolicy: 'strict' as 'strict' | 'accept-new',
  knownHostsPath: '',
  jumpEnabled: false,
  jumpHost: '',
  jumpPort: 22,
  jumpUsername: '',
  jumpCredentialId: '',
  jumpAuthMethod: 'pem' as 'pem' | 'password',
  jumpHostKeyPolicy: 'strict' as 'strict' | 'accept-new',
  jumpKnownHostsPath: ''
};

type ConnectionForm = typeof emptyConnectionForm;

type UseConnectionsOptions = {
  keys: KeyRecord[];
};

export const useConnections = ({ keys }: UseConnectionsOptions) => {
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [connectionSheetOpen, setConnectionSheetOpen] = useState(false);
  const [connectionForm, setConnectionForm] = useState<ConnectionForm>(emptyConnectionForm);
  const [connectionError, setConnectionError] = useState('');
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  const keyById = useMemo(() => new Map(keys.map((key) => [key.id, key])), [keys]);

  const loadConnections = useCallback(async () => {
    const response = await window.wagterm.storage.listConnections();
    setConnections(response.profiles);
  }, []);

  const resetConnectionForm = () => {
    setConnectionForm(emptyConnectionForm);
    setConnectionError('');
    setEditingConnectionId(null);
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
    if (connectionForm.jumpEnabled) {
      if (!connectionForm.jumpHost.trim()) {
        setConnectionError('Jump host is required.');
        return;
      }
      if (!connectionForm.jumpUsername.trim()) {
        setConnectionError('Jump host username is required.');
        return;
      }
      if (connectionForm.jumpAuthMethod === 'pem' && !connectionForm.jumpCredentialId.trim()) {
        setConnectionError('Jump host SSH key is required.');
        return;
      }
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
        knownHostsPath: connectionForm.knownHostsPath.trim() || undefined,
        jumpHost: connectionForm.jumpEnabled
          ? {
              host: connectionForm.jumpHost.trim(),
              port: Number(connectionForm.jumpPort),
              username: connectionForm.jumpUsername.trim(),
              authMethod: connectionForm.jumpAuthMethod,
              credentialId: connectionForm.jumpCredentialId.trim() || undefined,
              keyPath:
                connectionForm.jumpAuthMethod === 'pem'
                  ? keyById.get(connectionForm.jumpCredentialId)?.path ?? undefined
                  : undefined,
              hostKeyPolicy: connectionForm.jumpHostKeyPolicy,
              knownHostsPath: connectionForm.jumpKnownHostsPath.trim() || undefined
            }
          : undefined
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

  return {
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
  };
};

export type { ConnectionForm };
