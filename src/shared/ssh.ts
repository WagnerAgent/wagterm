export type SshAuthMethod = 'pem' | 'password';

export type ConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  credentialId?: string;
};

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type ConnectionStatus = {
  id: string;
  state: ConnectionState;
  lastError?: string;
};

export type McpServerConfig = {
  id: string;
  name: string;
  command: string;
  args: string[];
};

export type ConnectionValidationError = {
  field: keyof ConnectionProfile | 'mcpServerId';
  message: string;
};

export type ConnectRequest = {
  profile: ConnectionProfile;
  mcpServerId: string;
};

export type ConnectResponse = {
  status: ConnectionStatus;
  warnings: string[];
};

export type ListConnectionsResponse = {
  connections: ConnectionStatus[];
};

export type DisconnectResponse = {
  status: ConnectionStatus;
};

export type AddMcpServerRequest = {
  server: McpServerConfig;
};

export type AddMcpServerResponse = {
  servers: McpServerConfig[];
};

export type ListMcpServersResponse = {
  servers: McpServerConfig[];
};
