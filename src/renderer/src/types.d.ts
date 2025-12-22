declare module '*.svg' {
  const content: string;
  export default content;
}

export {};

declare global {
  interface Window {
    wagterm: {
      getAppInfo: () => Promise<{ name: string; version: string }>;
      storage: {
        listConnections: () => Promise<{
          profiles: Array<{
            id: string;
            name: string;
            host: string;
            port: number;
            username: string;
            authMethod: 'pem' | 'password';
            credentialId?: string;
          }>;
        }>;
        addConnection: (request: {
          profile: {
            id: string;
            name: string;
            host: string;
            port: number;
            username: string;
            authMethod: 'pem' | 'password';
            credentialId?: string;
          };
        }) => Promise<{ profile: { id: string } }>;
        updateConnection: (request: {
          profile: {
            id: string;
            name: string;
            host: string;
            port: number;
            username: string;
            authMethod: 'pem' | 'password';
            credentialId?: string;
          };
        }) => Promise<{ profile: { id: string } }>;
        deleteConnection: (request: { id: string }) => Promise<{ id: string }>;
        listKeys: () => Promise<{
          keys: Array<{
            id: string;
            name: string;
            type: 'ed25519' | 'rsa' | 'pem';
            fingerprint?: string;
          }>;
        }>;
        addKey: (request: {
          key: {
            id: string;
            name: string;
            type: 'ed25519' | 'rsa' | 'pem';
            publicKey?: string;
            fingerprint?: string;
            path?: string;
          };
          secret?: string;
        }) => Promise<{ key: { id: string } }>;
      };
      ssh: {
        listMcpServers: () => Promise<{ servers: Array<{ id: string }> }>;
      };
      sshSession: {
        start: (request: {
          profile: {
            id: string;
            name: string;
            host: string;
            port: number;
            username: string;
            authMethod: 'pem' | 'password';
            credentialId?: string;
          };
          cols: number;
          rows: number;
          hostKeyPolicy?: 'strict' | 'accept-new';
          knownHostsPath?: string;
        }) => Promise<{ sessionId: string }>;
        sendInput: (request: { sessionId: string; data: string }) => Promise<void>;
        close: (request: { sessionId: string }) => Promise<void>;
        onData: (listener: (event: { sessionId: string; data: string }) => void) => () => void;
        onExit: (
          listener: (event: { sessionId: string; exitCode: number | null; signal?: number }) => void
        ) => () => void;
      };
    };
  }
}
