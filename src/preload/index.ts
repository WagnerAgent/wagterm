import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type {
  AddMcpServerRequest,
  AddMcpServerResponse,
  AddConnectionRequest,
  AddConnectionResponse,
  AddKeyRequest,
  AddKeyResponse,
  UpdateKeyRequest,
  UpdateKeyResponse,
  ConnectRequest,
  ConnectResponse,
  DeleteConnectionRequest,
  DeleteConnectionResponse,
  DeleteKeyRequest,
  DeleteKeyResponse,
  ImportPemRequest,
  ImportPemResponse,
  DisconnectResponse,
  ListConnectionProfilesResponse,
  ListConnectionsResponse,
  ListKeysResponse,
  ListMcpServersResponse,
  SshSessionCloseRequest,
  SshSessionDataEvent,
  SshSessionExitEvent,
  SshSessionInputRequest,
  SshSessionOutputRequest,
  SshSessionOutputResponse,
  SshSessionResizeRequest,
  SshSessionStartRequest,
  SshSessionStartResponse,
  UpdateConnectionRequest,
  UpdateConnectionResponse
} from '../shared/ssh';
import type {
  ClearAiKeyRequest,
  ClearAiKeyResponse,
  GetAiKeysResponse,
  GetAppSettingsResponse,
  SetAiKeyRequest,
  SetAiKeyResponse,
  UpdateAppSettingsRequest,
  UpdateAppSettingsResponse
} from '../shared/settings';
import type {
  AiGenerateRequest,
  AiGenerateResponse,
  AiStreamChunkEvent,
  AiStreamCompleteEvent,
  AiStreamErrorEvent,
  AiStreamStartRequest
} from '../shared/assistant';
import type { AgentAction, AgentEvent } from '../shared/agent-ipc';

contextBridge.exposeInMainWorld('wagterm', {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
  storage: {
    listConnections: (): Promise<ListConnectionProfilesResponse> =>
      ipcRenderer.invoke(IpcChannels.connectionsList),
    addConnection: (request: AddConnectionRequest): Promise<AddConnectionResponse> =>
      ipcRenderer.invoke(IpcChannels.connectionsAdd, request),
    updateConnection: (request: UpdateConnectionRequest): Promise<UpdateConnectionResponse> =>
      ipcRenderer.invoke(IpcChannels.connectionsUpdate, request),
    deleteConnection: (request: DeleteConnectionRequest): Promise<DeleteConnectionResponse> =>
      ipcRenderer.invoke(IpcChannels.connectionsDelete, request),
    listKeys: (): Promise<ListKeysResponse> => ipcRenderer.invoke(IpcChannels.keysList),
    addKey: (request: AddKeyRequest): Promise<AddKeyResponse> =>
      ipcRenderer.invoke(IpcChannels.keysAdd, request),
    updateKey: (request: UpdateKeyRequest): Promise<UpdateKeyResponse> =>
      ipcRenderer.invoke(IpcChannels.keysUpdate, request),
    deleteKey: (request: DeleteKeyRequest): Promise<DeleteKeyResponse> =>
      ipcRenderer.invoke(IpcChannels.keysDelete, request),
    importPem: (request: ImportPemRequest): Promise<ImportPemResponse> =>
      ipcRenderer.invoke(IpcChannels.keysImportPem, request)
  },
  ssh: {
    listMcpServers: (): Promise<ListMcpServersResponse> =>
      ipcRenderer.invoke(IpcChannels.listMcpServers),
    addMcpServer: (request: AddMcpServerRequest): Promise<AddMcpServerResponse> =>
      ipcRenderer.invoke(IpcChannels.addMcpServer, request),
    listConnections: (): Promise<ListConnectionsResponse> =>
      ipcRenderer.invoke(IpcChannels.listConnections),
    connect: (request: ConnectRequest): Promise<ConnectResponse> =>
      ipcRenderer.invoke(IpcChannels.connect, request),
    disconnect: (connectionId: string): Promise<DisconnectResponse> =>
      ipcRenderer.invoke(IpcChannels.disconnect, connectionId)
  },
  sshSession: {
    start: (request: SshSessionStartRequest): Promise<SshSessionStartResponse> =>
      ipcRenderer.invoke(IpcChannels.sshSessionStart, request),
    sendInput: (request: SshSessionInputRequest): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.sshSessionInput, request),
    resize: (request: SshSessionResizeRequest): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.sshSessionResize, request),
    getRecentOutput: (request: SshSessionOutputRequest): Promise<SshSessionOutputResponse> =>
      ipcRenderer.invoke(IpcChannels.sshSessionOutput, request),
    close: (request: SshSessionCloseRequest): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.sshSessionClose, request),
    onData: (listener: (event: SshSessionDataEvent) => void) => {
      ipcRenderer.on(IpcChannels.sshSessionData, (_event, payload: SshSessionDataEvent) =>
        listener(payload)
      );
      return () => ipcRenderer.removeAllListeners(IpcChannels.sshSessionData);
    },
    onExit: (listener: (event: SshSessionExitEvent) => void) => {
      ipcRenderer.on(IpcChannels.sshSessionExit, (_event, payload: SshSessionExitEvent) =>
        listener(payload)
      );
      return () => ipcRenderer.removeAllListeners(IpcChannels.sshSessionExit);
    }
  },
  assistant: {
    generate: (request: AiGenerateRequest): Promise<AiGenerateResponse> =>
      ipcRenderer.invoke(IpcChannels.assistantGenerate, request),
    stream: (request: AiStreamStartRequest): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.assistantStreamStart, request),
    onChunk: (listener: (event: AiStreamChunkEvent) => void) => {
      ipcRenderer.on(IpcChannels.assistantStreamChunk, (_event, payload: AiStreamChunkEvent) =>
        listener(payload)
      );
      return () => ipcRenderer.removeAllListeners(IpcChannels.assistantStreamChunk);
    },
    onComplete: (listener: (event: AiStreamCompleteEvent) => void) => {
      ipcRenderer.on(IpcChannels.assistantStreamComplete, (_event, payload: AiStreamCompleteEvent) =>
        listener(payload)
      );
      return () => ipcRenderer.removeAllListeners(IpcChannels.assistantStreamComplete);
    },
    onError: (listener: (event: AiStreamErrorEvent) => void) => {
      ipcRenderer.on(IpcChannels.assistantStreamError, (_event, payload: AiStreamErrorEvent) =>
        listener(payload)
      );
      return () => ipcRenderer.removeAllListeners(IpcChannels.assistantStreamError);
    },
    agent: {
      sendAction: (action: AgentAction): void =>
        ipcRenderer.send(IpcChannels.assistantAgentAction, action),
      onEvent: (listener: (event: AgentEvent) => void) => {
        ipcRenderer.on(IpcChannels.assistantAgentEvent, (_event, payload: AgentEvent) =>
          listener(payload)
        );
        return () => ipcRenderer.removeAllListeners(IpcChannels.assistantAgentEvent);
      }
    }
  },
  dialog: {
    openFile: (): Promise<{ canceled: boolean; path: string | null }> =>
      ipcRenderer.invoke(IpcChannels.dialogOpenFile)
  },
  settings: {
    getAiKeys: (): Promise<GetAiKeysResponse> =>
      ipcRenderer.invoke(IpcChannels.settingsGetAiKeys),
    setAiKey: (request: SetAiKeyRequest): Promise<SetAiKeyResponse> =>
      ipcRenderer.invoke(IpcChannels.settingsSetAiKey, request),
    clearAiKey: (request: ClearAiKeyRequest): Promise<ClearAiKeyResponse> =>
      ipcRenderer.invoke(IpcChannels.settingsClearAiKey, request),
    getAppSettings: (): Promise<GetAppSettingsResponse> =>
      ipcRenderer.invoke(IpcChannels.settingsGetApp),
    updateAppSettings: (request: UpdateAppSettingsRequest): Promise<UpdateAppSettingsResponse> =>
      ipcRenderer.invoke(IpcChannels.settingsUpdateApp, request)
  }
});
