import React, { createContext, useContext, useEffect } from 'react';
import { useKeys } from '../hooks/useKeys';

type KeysContextValue = ReturnType<typeof useKeys>;

const KeysContext = createContext<KeysContextValue | null>(null);

export const KeysProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useKeys();
  const { loadKeys } = value;

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  return <KeysContext.Provider value={value}>{children}</KeysContext.Provider>;
};

export const useKeysContext = () => {
  const context = useContext(KeysContext);
  if (!context) {
    throw new Error('useKeysContext must be used within KeysProvider');
  }
  return context;
};
