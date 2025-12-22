import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type {
  AddMcpServerRequest,
  AddMcpServerResponse,
  ConnectRequest,
  ConnectResponse,
  DisconnectResponse,
  ListConnectionsResponse,
  ListMcpServersResponse
} from '../shared/ssh';

contextBridge.exposeInMainWorld('wagterm', {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
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
  }
});
