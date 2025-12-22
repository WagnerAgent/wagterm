import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { IpcChannels } from '../shared/ipc';
import { SshMcpService } from './ssh/sshMcpService';

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
