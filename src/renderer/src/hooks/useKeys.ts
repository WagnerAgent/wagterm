import { useCallback, useMemo, useState } from 'react';
import type { KeyRecord } from '../components/app/types';

type KeyKind = 'ssh' | 'pem';

type KeyForm = {
  name: string;
  kind: KeyKind;
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  path: string;
  passphrase: string;
};

const emptyKeyForm: KeyForm = {
  name: '',
  kind: 'ssh',
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

export const useKeys = () => {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [keySheetOpen, setKeySheetOpen] = useState(false);
  const [keyForm, setKeyForm] = useState<KeyForm>(emptyKeyForm);
  const [keyError, setKeyError] = useState('');
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);

  const detectedKeyType = useMemo(
    () => detectKeyType(keyForm.publicKey, keyForm.privateKey),
    [keyForm.publicKey, keyForm.privateKey]
  );

  const loadKeys = useCallback(async () => {
    const response = await window.wagterm.storage.listKeys();
    setKeys(response.keys);
  }, []);

  const resetKeyForm = () => {
    setKeyForm(emptyKeyForm);
    setKeyError('');
    setEditingKeyId(null);
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

  return {
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
  };
};

export type { KeyForm, KeyKind };
