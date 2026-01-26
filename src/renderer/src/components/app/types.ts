export type SectionKey = 'connections' | 'keys' | 'settings' | 'dithering-demo';

export type ConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'pem' | 'password';
  credentialId?: string;
  hostKeyPolicy?: 'strict' | 'accept-new';
  knownHostsPath?: string;
  jumpHost?: JumpHostConfig;
};

export type JumpHostConfig = {
  host: string;
  port: number;
  username: string;
  authMethod: 'pem' | 'password';
  credentialId?: string;
  keyPath?: string;
  hostKeyPolicy?: 'strict' | 'accept-new';
  knownHostsPath?: string;
};

export type KeyRecord = {
  id: string;
  name: string;
  type: 'ed25519' | 'rsa' | 'pem';
  fingerprint?: string;
  path?: string;
};

export type TerminalSession = {
  id: string;
  profile: ConnectionProfile;
  status: string;
  connected: boolean;
};

export type CommandHistoryEntry = {
  id: string;
  connectionId: string;
  sessionId: string;
  command: string;
  createdAt: string;
};

export type CommandProposal = {
  id: string;
  command: string;
  rationale?: string;
  risk?: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  interactive?: boolean;
  status: 'pending' | 'approved' | 'rejected';
  statusMessage?: string;
};
