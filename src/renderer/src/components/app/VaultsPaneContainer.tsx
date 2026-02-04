import React from 'react';
import VaultsPane from './VaultsPane';
import { useKeysContext } from '../../context/KeysContext';

const VaultsPaneContainer = () => {
  const {
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
  } = useKeysContext();

  return (
    <VaultsPane
      keys={keys}
      keySheetOpen={keySheetOpen}
      setKeySheetOpen={setKeySheetOpen}
      keyForm={keyForm}
      setKeyForm={setKeyForm}
      keyError={keyError}
      editingKeyId={editingKeyId}
      setEditingKeyId={setEditingKeyId}
      resetKeyForm={resetKeyForm}
      handleKeySave={handleKeySave}
      loadKeys={loadKeys}
      detectedKeyType={detectedKeyType}
    />
  );
};

export default VaultsPaneContainer;
