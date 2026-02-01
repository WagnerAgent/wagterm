import 'dotenv/config';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { mkdir, writeFile, chmod } from 'fs/promises';
import { randomUUID } from 'crypto';
import { IpcChannels } from '../shared/ipc';
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
  ImportPemRequest,
  ImportPemResponse,
  ListCommandHistoryRequest,
  ListCommandHistoryResponse
} from '../shared/ssh';
import { AssistantService } from './assistant/assistantService';
import { clearAiKey, getAiKey, setAiKey } from './security/credentials';
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
  const db = initializeDatabase(join(app.getPath('userData'), 'wagterm.sqlite'));
  const storageService = new StorageService(db);
  const sshPtyService = new SshPtyService(storageService);
  const assistantService = new AssistantService(sshPtyService);

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
  ipcMain.handle(
    IpcChannels.commandHistoryList,
    (_event, request: ListCommandHistoryRequest): ListCommandHistoryResponse =>
      storageService.listCommandHistory(request)
  );
  ipcMain.handle(IpcChannels.settingsGetAiKeys, async (): Promise<GetAiKeysResponse> => {
    const [openai, anthropic] = await Promise.all([getAiKey('openai'), getAiKey('anthropic')]);
    return {
      keys: [
        { provider: 'openai', configured: Boolean(openai) },
        { provider: 'anthropic', configured: Boolean(anthropic) }
      ]
    };
  });
  ipcMain.handle(
    IpcChannels.settingsSetAiKey,
    async (_event, request: SetAiKeyRequest): Promise<SetAiKeyResponse> => {
      const apiKey = request.apiKey.trim();
      if (!apiKey) {
        throw new Error('API key is required.');
      }
      await setAiKey(request.provider, apiKey);
      return { provider: request.provider, configured: true };
    }
  );
  ipcMain.handle(
    IpcChannels.settingsClearAiKey,
    async (_event, request: ClearAiKeyRequest): Promise<ClearAiKeyResponse> => {
      await clearAiKey(request.provider);
      return { provider: request.provider, configured: false };
    }
  );
  ipcMain.handle(IpcChannels.settingsGetApp, (): GetAppSettingsResponse => {
    return { settings: storageService.getAppSettings() };
  });
  ipcMain.handle(
    IpcChannels.settingsUpdateApp,
    (_event, request: UpdateAppSettingsRequest): UpdateAppSettingsResponse => {
      return { settings: storageService.updateAppSettings(request.settings) };
    }
  );
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
  ipcMain.handle(
    IpcChannels.keysImportPem,
    async (_event, request: ImportPemRequest): Promise<ImportPemResponse> => {
      const safeName = request.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${randomUUID()}_${safeName || 'key.pem'}`;
      const baseDir = join(app.getPath('userData'), 'keys');
      const fullPath = join(baseDir, fileName);
      await mkdir(baseDir, { recursive: true });
      await writeFile(fullPath, Buffer.from(request.data));
    try {
      await chmod(fullPath, 0o600);
    } catch {
      // Best effort on platforms that don't support chmod.
    }
      return { path: fullPath };
    }
  );
  ipcMain.handle(IpcChannels.dialogOpenFile, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'PEM Files', extensions: ['pem', 'key', 'ppk'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return { canceled: result.canceled, path: result.filePaths[0] ?? null };
  });

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
