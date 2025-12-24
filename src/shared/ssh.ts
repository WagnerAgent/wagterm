export type SshAuthMethod = 'pem' | 'password';

export type KeyType = 'ed25519' | 'rsa' | 'pem';

export type ConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshAuthMethod;
  credentialId?: string;
  keyPath?: string;
  hostKeyPolicy?: HostKeyPolicy;
  knownHostsPath?: string;
};

export type KeyRecord = {
  id: string;
  name: string;
  type: KeyType;
  publicKey?: string;
  fingerprint?: string;
  path?: string;
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

export type AddConnectionRequest = {
  profile: ConnectionProfile;
  password?: string;
};

export type AddConnectionResponse = {
  profile: ConnectionProfile;
};

export type UpdateConnectionRequest = {
  profile: ConnectionProfile;
  password?: string;
};

export type UpdateConnectionResponse = {
  profile: ConnectionProfile;
};

export type DeleteConnectionRequest = {
  id: string;
};

export type DeleteConnectionResponse = {
  id: string;
};

export type ListConnectionProfilesResponse = {
  profiles: ConnectionProfile[];
};

export type AddKeyRequest = {
  key: KeyRecord;
  privateKey?: string;
  passphrase?: string;
};

export type AddKeyResponse = {
  key: KeyRecord;
};

export type UpdateKeyRequest = {
  key: KeyRecord;
  privateKey?: string;
  passphrase?: string;
  clearPrivateKey?: boolean;
  clearPassphrase?: boolean;
};

export type UpdateKeyResponse = {
  key: KeyRecord;
};

export type DeleteKeyRequest = {
  id: string;
};

export type DeleteKeyResponse = {
  id: string;
};

export type ListKeysResponse = {
  keys: KeyRecord[];
};

export type ImportPemRequest = {
  fileName: string;
  data: number[];
};

export type ImportPemResponse = {
  path: string;
};

export type HostKeyPolicy = 'strict' | 'accept-new';

export type SshSessionStartRequest = {
  profile: ConnectionProfile;
  cols: number;
  rows: number;
  hostKeyPolicy?: HostKeyPolicy;
  knownHostsPath?: string;
};

export type SshSessionStartResponse = {
  sessionId: string;
};

export type SshSessionInputRequest = {
  sessionId: string;
  data: string;
};

export type SshSessionResizeRequest = {
  sessionId: string;
  cols: number;
  rows: number;
};

export type SshSessionCloseRequest = {
  sessionId: string;
};

export type SshSessionOutputRequest = {
  sessionId: string;
  limit?: number;
};

export type SshSessionOutputResponse = {
  sessionId: string;
  output: string;
  truncated: boolean;
};

export type SshSessionDataEvent = {
  sessionId: string;
  data: string;
};

export type SshSessionExitEvent = {
  sessionId: string;
  exitCode: number | null;
  signal?: number;
  error?: string;
};
