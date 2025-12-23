import 'dotenv/config';
import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IpcChannels } from '../shared/ipc';
import { AssistantService } from './assistant/assistantService';
import { SshMcpService } from './ssh/sshMcpService';
import { SshPtyService } from './ssh/sshPtyService';
import { initializeDatabase } from './storage/database';
import { StorageService } from './storage/storageService';

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

app.whenReady().then(() => {
  const sshService = new SshMcpService();
  const sshPtyService = new SshPtyService();
  const assistantService = new AssistantService(sshPtyService);
  const db = initializeDatabase(join(app.getPath('userData'), 'wagterm.sqlite'));
  const storageService = new StorageService(db);

  ipcMain.handle(IpcChannels.appInfo, () => ({
    name: app.getName(),
    version: app.getVersion()
  }));

  ipcMain.handle(IpcChannels.listMcpServers, () => sshService.listMcpServers());
  ipcMain.handle(IpcChannels.addMcpServer, (_event, request) =>
    sshService.addMcpServer(request.server)
  );
  ipcMain.handle(IpcChannels.listConnections, () => sshService.listConnections());
  ipcMain.handle(IpcChannels.connect, (_event, request) => sshService.connect(request));
  ipcMain.handle(IpcChannels.disconnect, (_event, connectionId) =>
    sshService.disconnect(connectionId)
  );
  ipcMain.handle(IpcChannels.connectionsList, () => storageService.listConnections());
  ipcMain.handle(IpcChannels.connectionsAdd, (_event, request) =>
    storageService.addConnection(request)
  );
  ipcMain.handle(IpcChannels.connectionsUpdate, (_event, request) =>
    storageService.updateConnection(request)
  );
  ipcMain.handle(IpcChannels.connectionsDelete, (_event, request) =>
    storageService.deleteConnection(request)
  );
  ipcMain.handle(IpcChannels.keysList, () => storageService.listKeys());
  ipcMain.handle(IpcChannels.keysAdd, (_event, request) => storageService.addKey(request));
  ipcMain.handle(IpcChannels.keysUpdate, (_event, request) => storageService.updateKey(request));
  ipcMain.handle(IpcChannels.keysDelete, (_event, request) => storageService.deleteKey(request));
  ipcMain.handle(IpcChannels.sshSessionStart, (event, request) =>
    sshPtyService.startSession(request, event.sender)
  );
  ipcMain.handle(IpcChannels.sshSessionInput, (_event, request) =>
    sshPtyService.sendInput(request)
  );
  ipcMain.handle(IpcChannels.sshSessionResize, (_event, request) =>
    sshPtyService.resize(request)
  );
  ipcMain.handle(IpcChannels.sshSessionOutput, (_event, request) =>
    sshPtyService.getRecentOutput(request)
  );
  ipcMain.handle(IpcChannels.sshSessionClose, (_event, request) =>
    sshPtyService.close(request)
  );
  ipcMain.handle(IpcChannels.assistantGenerate, (_event, request) =>
    assistantService.generate(request)
  );
  ipcMain.handle(IpcChannels.assistantStreamStart, (event, request) =>
    assistantService.stream(request, event.sender)
  );
  ipcMain.on(IpcChannels.assistantAgentAction, (event, action) =>
    assistantService.handleAgentAction(action, event.sender)
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
