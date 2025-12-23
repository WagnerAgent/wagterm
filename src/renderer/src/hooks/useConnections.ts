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
  knownHostsPath: ''
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
