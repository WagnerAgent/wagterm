import React from 'react';
import KeysPane from './KeysPane';
import { useKeysContext } from '../../context/KeysContext';

const KeysPaneContainer = () => {
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
    <KeysPane
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

export default KeysPaneContainer;
