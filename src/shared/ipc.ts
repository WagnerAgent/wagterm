export const IpcChannels = {
  appInfo: 'app:info',
  listMcpServers: 'ssh:mcp:list',
  addMcpServer: 'ssh:mcp:add',
  connect: 'ssh:connect',
  disconnect: 'ssh:disconnect',
  listConnections: 'ssh:connections:list'
} as const;
