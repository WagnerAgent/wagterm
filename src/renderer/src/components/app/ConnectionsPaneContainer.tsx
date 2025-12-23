import React, { useEffect } from 'react';
import ConnectionsPane from './ConnectionsPane';
import type { ConnectionProfile, TerminalSession } from './types';
import { useConnections } from '../../hooks/useConnections';
import { useKeysContext } from '../../context/KeysContext';

type ConnectionsPaneContainerProps = {
  terminalSessions: TerminalSession[];
  connectToProfile: (profile: ConnectionProfile) => void;
};

const ConnectionsPaneContainer = ({ terminalSessions, connectToProfile }: ConnectionsPaneContainerProps) => {
  const { keys } = useKeysContext();
  const {
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
  } = useConnections({ keys });

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  return (
    <ConnectionsPane
      connections={connections}
      keys={keys}
      terminalSessions={terminalSessions}
      connectionSheetOpen={connectionSheetOpen}
      setConnectionSheetOpen={setConnectionSheetOpen}
      connectionForm={connectionForm}
      setConnectionForm={setConnectionForm}
      connectionError={connectionError}
      editingConnectionId={editingConnectionId}
      setEditingConnectionId={setEditingConnectionId}
      resetConnectionForm={resetConnectionForm}
      handleConnectionSave={handleConnectionSave}
      loadConnections={loadConnections}
      connectToProfile={connectToProfile}
    />
  );
};

export default ConnectionsPaneContainer;
