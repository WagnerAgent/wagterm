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
            hostKeyPolicy?: 'strict' | 'accept-new';
            knownHostsPath?: string;
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
            hostKeyPolicy?: 'strict' | 'accept-new';
            knownHostsPath?: string;
          };
          password?: string;
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
            hostKeyPolicy?: 'strict' | 'accept-new';
            knownHostsPath?: string;
          };
          password?: string;
        }) => Promise<{ profile: { id: string } }>;
        deleteConnection: (request: { id: string }) => Promise<{ id: string }>;
        listKeys: () => Promise<{
          keys: Array<{
            id: string;
            name: string;
            type: 'ed25519' | 'rsa' | 'pem';
            fingerprint?: string;
            path?: string;
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
          privateKey?: string;
          passphrase?: string;
        }) => Promise<{ key: { id: string } }>;
        updateKey: (request: {
          key: {
            id: string;
            name: string;
            type: 'ed25519' | 'rsa' | 'pem';
            publicKey?: string;
            fingerprint?: string;
            path?: string;
          };
          privateKey?: string;
          passphrase?: string;
          clearPrivateKey?: boolean;
          clearPassphrase?: boolean;
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
            hostKeyPolicy?: 'strict' | 'accept-new';
            knownHostsPath?: string;
          };
          cols: number;
          rows: number;
          hostKeyPolicy?: 'strict' | 'accept-new';
          knownHostsPath?: string;
        }) => Promise<{ sessionId: string }>;
        sendInput: (request: { sessionId: string; data: string }) => Promise<void>;
        getRecentOutput: (request: { sessionId: string; limit?: number }) => Promise<{
          sessionId: string;
          output: string;
          truncated: boolean;
        }>;
        close: (request: { sessionId: string }) => Promise<void>;
        onData: (listener: (event: { sessionId: string; data: string }) => void) => () => void;
        onExit: (
          listener: (event: { sessionId: string; exitCode: number | null; signal?: number }) => void
        ) => () => void;
      };
      assistant: {
        generate: (request: {
          sessionId: string;
          prompt: string;
          model: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5';
          session: {
            id: string;
            name?: string;
            host: string;
            username: string;
            port: number;
          };
          outputLimit?: number;
        }) => Promise<{
          response: {
            commands: Array<{
              id?: string;
              command: string;
              rationale?: string;
              risk?: 'low' | 'medium' | 'high';
              requiresApproval: boolean;
            }>;
            message?: string;
            intent?: 'chat' | 'plan' | 'command';
          };
          rawText?: string;
        }>;
        stream: (request: {
          requestId: string;
          sessionId: string;
          prompt: string;
          model: 'gpt-5.2' | 'gpt-5-mini' | 'claude-sonnet-4.5' | 'claude-opus-4.5' | 'claude-haiku-4.5';
          session: {
            id: string;
            name?: string;
            host: string;
            username: string;
            port: number;
          };
          outputLimit?: number;
        }) => Promise<void>;
        onChunk: (listener: (event: { requestId: string; sessionId: string; text: string }) => void) => () => void;
        onComplete: (listener: (event: {
          requestId: string;
          sessionId: string;
          response: {
            commands: Array<{
              id?: string;
              command: string;
              rationale?: string;
              risk?: 'low' | 'medium' | 'high';
              requiresApproval: boolean;
            }>;
            message?: string;
          };
          rawText?: string;
        }) => void) => () => void;
        onError: (listener: (event: { requestId: string; sessionId: string; error: string }) => void) => () => void;
      };
    };
  }
}
