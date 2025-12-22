import { isAbsolute } from 'path';
import {
  type AddMcpServerResponse,
  type ConnectRequest,
  type ConnectResponse,
  type ConnectionStatus,
  type ConnectionValidationError,
  type DisconnectResponse,
  type ListConnectionsResponse,
  type ListMcpServersResponse,
  type McpServerConfig
} from '../../shared/ssh';
import { McpClient } from '../mcp/mcpClient';

const isValidHost = (host: string): boolean => {
  if (host.includes('://')) {
    return false;
  }
  return host.trim().length > 0;
};

const isValidPort = (port: number): boolean => port > 0 && port <= 65535;

const isLocalCommand = (command: string): boolean => {
  if (command.includes('://')) {
    return false;
  }
  return isAbsolute(command);
};

const hasRemoteArgs = (args: string[]): boolean =>
  args.some((arg) => arg.includes('http://') || arg.includes('https://'));

export class SshMcpService {
  private readonly mcpServers: McpServerConfig[] = [];
  private readonly connections = new Map<string, ConnectionStatus>();
  private readonly mcpClients = new Map<string, McpClient>();

  listMcpServers(): ListMcpServersResponse {
    return { servers: [...this.mcpServers] };
  }

  addMcpServer(config: McpServerConfig): AddMcpServerResponse {
    this.mcpServers.push(config);
    return { servers: [...this.mcpServers] };
  }

  listConnections(): ListConnectionsResponse {
    return { connections: [...this.connections.values()] };
  }

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const validationErrors = this.validateRequest(request);
    if (validationErrors.length > 0) {
      return {
        status: {
          id: request.profile.id,
          state: 'error',
          lastError: validationErrors.map((error) => error.message).join(' ')
        },
        warnings: []
      };
    }

    const status: ConnectionStatus = {
      id: request.profile.id,
      state: 'connecting'
    };

    this.connections.set(status.id, status);

    const server = this.getMcpServer(request.mcpServerId);
    const client = new McpClient(server.command, server.args);

    try {
      await client.connect();
      status.state = 'connected';
      this.mcpClients.set(status.id, client);
      this.connections.set(status.id, status);

      return { status, warnings: [] };
    } catch (error) {
      status.state = 'error';
      status.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.connections.set(status.id, status);

      return { status, warnings: [] };
    }
  }

  async disconnect(connectionId: string): Promise<DisconnectResponse> {
    const status = this.connections.get(connectionId) ?? {
      id: connectionId,
      state: 'disconnected'
    };

    const client = this.mcpClients.get(connectionId);
    if (client) {
      await client.disconnect();
      this.mcpClients.delete(connectionId);
    }

    status.state = 'disconnected';
    this.connections.set(connectionId, status);

    return { status };
  }

  private getMcpServer(serverId: string): McpServerConfig {
    const server = this.mcpServers.find((item) => item.id === serverId);
    if (!server) {
      throw new Error('MCP server not configured.');
    }

    return server;
  }

  private validateRequest(request: ConnectRequest): ConnectionValidationError[] {
    const { profile, mcpServerId } = request;
    const errors: ConnectionValidationError[] = [];

    if (!profile.id.trim()) {
      errors.push({ field: 'id', message: 'Connection id is required.' });
    }

    if (!profile.name.trim()) {
      errors.push({ field: 'name', message: 'Connection name is required.' });
    }

    if (!profile.username.trim()) {
      errors.push({ field: 'username', message: 'Username is required.' });
    }

    if (!isValidHost(profile.host)) {
      errors.push({ field: 'host', message: 'Host must be a hostname or IP.' });
    }

    if (!isValidPort(profile.port)) {
      errors.push({ field: 'port', message: 'Port must be 1-65535.' });
    }

    if (profile.authMethod === 'pem' && !profile.credentialId) {
      errors.push({ field: 'credentialId', message: 'PEM credential is required.' });
    }

    const server = this.mcpServers.find((item) => item.id === mcpServerId);
    if (!server) {
      errors.push({ field: 'mcpServerId', message: 'MCP server is not configured.' });
    } else {
      if (!isLocalCommand(server.command)) {
        errors.push({ field: 'mcpServerId', message: 'MCP command must be a local executable.' });
      }

      if (hasRemoteArgs(server.args)) {
        errors.push({ field: 'mcpServerId', message: 'MCP args cannot include remote URLs.' });
      }
    }

    return errors;
  }
}
