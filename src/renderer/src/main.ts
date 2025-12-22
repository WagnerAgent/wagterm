import './style.css';

type AppInfo = {
  name: string;
  version: string;
};

declare global {
  interface Window {
    wagterm: {
      getAppInfo: () => Promise<AppInfo>;
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
        listKeys: () => Promise<{ keys: Array<{ id: string; name: string; type: 'ed25519' | 'rsa' | 'pem'; fingerprint?: string }> }>;
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

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main class="shell layout">
      <aside class="sidebar">
        <div class="brand">
          <p class="eyebrow">Wagterm</p>
          <h1>AI SSH</h1>
        </div>
        <nav class="nav">
          <button class="nav-button active" data-section="connections">Connections</button>
          <button class="nav-button" data-section="keys">Keys</button>
          <button class="nav-button" data-section="settings">Settings</button>
        </nav>
        <div class="card subtle meta" id="app-info">Loading app info...</div>
      </aside>
      <section class="content">
        <header class="content-header">
          <div>
            <p class="eyebrow">Workspace</p>
            <h2 id="section-title">Connections</h2>
          </div>
          <div class="actions" id="section-actions"></div>
        </header>
        <div class="panel section-pane active" data-pane="connections">
          <div class="pane-header">
            <div>
              <h3>Connection Profiles</h3>
              <p>Manage EC2, Droplets, and local hosts.</p>
            </div>
            <button class="button" id="connection-new">New Connection</button>
          </div>
          <div class="form-card hidden" id="connection-form">
            <div class="form-row">
              <label>
                Name
                <input id="connection-name" placeholder="Production EC2" />
              </label>
              <label>
                Host
                <input id="connection-host" placeholder="1.2.3.4" />
              </label>
            </div>
            <div class="form-row">
              <label>
                Username
                <input id="connection-user" placeholder="ubuntu" />
              </label>
              <label>
                Port
                <input id="connection-port" type="number" value="22" />
              </label>
            </div>
            <div class="form-row">
              <label>
                Auth Method
                <select id="connection-auth">
                  <option value="pem">PEM</option>
                  <option value="password">Password</option>
                </select>
              </label>
              <label>
                Credential ID (optional)
                <input id="connection-credential" placeholder="key-id" />
              </label>
            </div>
            <div class="form-actions">
              <button class="ghost" id="connection-cancel">Cancel</button>
              <button class="button" id="connection-save">Save Connection</button>
            </div>
            <p class="form-error" id="connection-error"></p>
          </div>
          <div class="list">
            <div class="list-empty" id="connections-empty">
              <p class="list-title">No connections yet</p>
              <p class="list-subtitle">Create your first SSH profile.</p>
            </div>
            <div id="connections-list"></div>
          </div>
          <div class="terminal-panel">
            <div class="pane-header">
              <div>
                <h3>Active Session</h3>
                <p id="session-status">No active session.</p>
              </div>
              <button class="ghost" id="session-close" disabled>Close Session</button>
            </div>
            <div class="terminal-output">
              <pre id="session-output">Session output will appear here.</pre>
            </div>
            <div class="terminal-input">
              <input id="session-input" placeholder="Type a command and press Enter" />
              <button class="button" id="session-send">Send</button>
            </div>
          </div>
        </div>
        <div class="panel section-pane" data-pane="keys">
          <div class="pane-header">
            <div>
              <h3>SSH Keys</h3>
              <p>Generate or import keys (ED25519, RSA, PEM).</p>
            </div>
            <button class="button" id="key-new">Add Key</button>
          </div>
          <div class="form-card hidden" id="key-form">
            <div class="form-row">
              <label>
                Name
                <input id="key-name" placeholder="Deploy key" />
              </label>
              <label>
                Type
                <select id="key-type">
                  <option value="ed25519">ED25519</option>
                  <option value="rsa">RSA</option>
                  <option value="pem">PEM File</option>
                </select>
              </label>
            </div>
            <div class="form-row">
              <label>
                Public Key (optional)
                <input id="key-public" placeholder="ssh-ed25519 AAAA..." />
              </label>
              <label>
                Fingerprint (optional)
                <input id="key-fingerprint" placeholder="SHA256:..." />
              </label>
            </div>
            <div class="form-row">
              <label>
                PEM Path (optional)
                <input id="key-path" placeholder="/Users/you/.ssh/id_ed25519" />
              </label>
              <label>
                Secret (optional)
                <input id="key-secret" type="password" placeholder="Passphrase" />
              </label>
            </div>
            <div class="form-actions">
              <button class="ghost" id="key-cancel">Cancel</button>
              <button class="button" id="key-save">Save Key</button>
            </div>
            <p class="form-error" id="key-error"></p>
          </div>
          <div class="list">
            <div class="list-empty" id="keys-empty">
              <p class="list-title">No keys stored</p>
              <p class="list-subtitle">Add a PEM file or generate a new keypair.</p>
            </div>
            <div id="keys-list"></div>
          </div>
        </div>
        <div class="panel section-pane" data-pane="settings">
          <div class="pane-header">
            <div>
              <h3>Settings</h3>
              <p>Local preferences for SSH, security, and UI.</p>
            </div>
          </div>
          <div class="settings-grid">
            <div class="setting-card">
              <h4>Host Key Policy</h4>
              <p>Choose strict or accept-new behavior for known hosts.</p>
              <button class="ghost">Configure</button>
            </div>
            <div class="setting-card">
              <h4>Session Defaults</h4>
              <p>Default shell size, fonts, and session timeouts.</p>
              <button class="ghost">Edit</button>
            </div>
            <div class="setting-card">
              <h4>Security</h4>
              <p>Lock screen, local encryption, and audit logs.</p>
              <button class="ghost">Review</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  `;

  window.wagterm.getAppInfo().then((info) => {
    const appInfo = document.querySelector<HTMLDivElement>('#app-info');
    if (appInfo) {
      appInfo.textContent = `${info.name} v${info.version}`;
    }
  });

  void window.wagterm.ssh.listMcpServers();

  const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-button');
  const panes = document.querySelectorAll<HTMLDivElement>('.section-pane');
  const sectionTitle = document.querySelector<HTMLHeadingElement>('#section-title');

  const connectionsList = document.querySelector<HTMLDivElement>('#connections-list');
  const connectionsEmpty = document.querySelector<HTMLDivElement>('#connections-empty');
  const keysList = document.querySelector<HTMLDivElement>('#keys-list');
  const keysEmpty = document.querySelector<HTMLDivElement>('#keys-empty');

  const connectionForm = document.querySelector<HTMLDivElement>('#connection-form');
  const connectionError = document.querySelector<HTMLParagraphElement>('#connection-error');
  const connectionNew = document.querySelector<HTMLButtonElement>('#connection-new');
  const connectionCancel = document.querySelector<HTMLButtonElement>('#connection-cancel');
  const connectionSave = document.querySelector<HTMLButtonElement>('#connection-save');
  const connectionName = document.querySelector<HTMLInputElement>('#connection-name');
  const connectionHost = document.querySelector<HTMLInputElement>('#connection-host');
  const connectionUser = document.querySelector<HTMLInputElement>('#connection-user');
  const connectionPort = document.querySelector<HTMLInputElement>('#connection-port');
  const connectionAuth = document.querySelector<HTMLSelectElement>('#connection-auth');
  const connectionCredential = document.querySelector<HTMLInputElement>('#connection-credential');

  const keyForm = document.querySelector<HTMLDivElement>('#key-form');
  const keyError = document.querySelector<HTMLParagraphElement>('#key-error');
  const keyNew = document.querySelector<HTMLButtonElement>('#key-new');
  const keyCancel = document.querySelector<HTMLButtonElement>('#key-cancel');
  const keySave = document.querySelector<HTMLButtonElement>('#key-save');
  const keyName = document.querySelector<HTMLInputElement>('#key-name');
  const keyType = document.querySelector<HTMLSelectElement>('#key-type');
  const keyPublic = document.querySelector<HTMLInputElement>('#key-public');
  const keyFingerprint = document.querySelector<HTMLInputElement>('#key-fingerprint');
  const keyPath = document.querySelector<HTMLInputElement>('#key-path');
  const keySecret = document.querySelector<HTMLInputElement>('#key-secret');

  const sessionOutput = document.querySelector<HTMLPreElement>('#session-output');
  const sessionStatus = document.querySelector<HTMLParagraphElement>('#session-status');
  const sessionInput = document.querySelector<HTMLInputElement>('#session-input');
  const sessionSend = document.querySelector<HTMLButtonElement>('#session-send');
  const sessionClose = document.querySelector<HTMLButtonElement>('#session-close');

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.section;
      if (!target) {
        return;
      }

      navButtons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');

      panes.forEach((pane) => {
        pane.classList.toggle('active', pane.dataset.pane === target);
      });

      if (sectionTitle) {
        sectionTitle.textContent = button.textContent ?? '';
      }
    });
  });

  const connectionProfiles = new Map<string, {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: 'pem' | 'password';
    credentialId?: string;
  }>();

  let editingConnectionId: string | null = null;
  let currentSessionId: string | null = null;
  let removeSessionData: (() => void) | null = null;
  let removeSessionExit: (() => void) | null = null;

  const updateSessionStatus = (text: string) => {
    if (sessionStatus) {
      sessionStatus.textContent = text;
    }
  };

  const appendSessionOutput = (text: string) => {
    if (!sessionOutput) {
      return;
    }
    sessionOutput.textContent = `${sessionOutput.textContent ?? ''}${text}`;
    sessionOutput.scrollTop = sessionOutput.scrollHeight;
  };

  const clearSessionOutput = () => {
    if (sessionOutput) {
      sessionOutput.textContent = '';
    }
  };

  const renderConnections = async () => {
    if (!connectionsList || !connectionsEmpty) {
      return;
    }
    const response = await window.wagterm.storage.listConnections();
    connectionsList.innerHTML = '';
    connectionsEmpty.classList.toggle('hidden', response.profiles.length > 0);
    connectionProfiles.clear();

    response.profiles.forEach((profile) => {
      connectionProfiles.set(profile.id, profile);
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div>
          <p class="list-title">${profile.name}</p>
          <p class="list-subtitle">${profile.username}@${profile.host}:${profile.port}</p>
        </div>
        <div class="row-actions">
          <button class="ghost" data-action="connect" data-id="${profile.id}">Connect</button>
          <button class="ghost" data-action="edit" data-id="${profile.id}">Edit</button>
          <button class="ghost" data-action="delete" data-id="${profile.id}">Delete</button>
        </div>
      `;
      connectionsList.appendChild(item);
    });
  };

  const renderKeys = async () => {
    if (!keysList || !keysEmpty) {
      return;
    }
    const response = await window.wagterm.storage.listKeys();
    keysList.innerHTML = '';
    keysEmpty.classList.toggle('hidden', response.keys.length > 0);

    response.keys.forEach((key) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div>
          <p class="list-title">${key.name}</p>
          <p class="list-subtitle">${key.type.toUpperCase()} ${key.fingerprint ?? ''}</p>
        </div>
        <button class="ghost">Details</button>
      `;
      keysList.appendChild(item);
    });
  };

  const toggleForm = (form: HTMLElement | null, show: boolean) => {
    if (!form) {
      return;
    }
    form.classList.toggle('hidden', !show);
  };

  const resetConnectionForm = () => {
    if (connectionName) {
      connectionName.value = '';
    }
    if (connectionHost) {
      connectionHost.value = '';
    }
    if (connectionUser) {
      connectionUser.value = '';
    }
    if (connectionPort) {
      connectionPort.value = '22';
    }
    if (connectionAuth) {
      connectionAuth.value = 'pem';
    }
    if (connectionCredential) {
      connectionCredential.value = '';
    }
    if (connectionError) {
      connectionError.textContent = '';
    }
    editingConnectionId = null;
  };

  connectionNew?.addEventListener('click', () => {
    resetConnectionForm();
    toggleForm(connectionForm, true);
  });
  connectionCancel?.addEventListener('click', () => {
    resetConnectionForm();
    toggleForm(connectionForm, false);
  });
  keyNew?.addEventListener('click', () => toggleForm(keyForm, true));
  keyCancel?.addEventListener('click', () => toggleForm(keyForm, false));

  connectionSave?.addEventListener('click', async () => {
    if (
      !connectionName ||
      !connectionHost ||
      !connectionUser ||
      !connectionPort ||
      !connectionAuth
    ) {
      return;
    }

    if (connectionError) {
      connectionError.textContent = '';
    }

    const payload = {
      profile: {
        id: editingConnectionId ?? crypto.randomUUID(),
        name: connectionName.value.trim(),
        host: connectionHost.value.trim(),
        port: Number(connectionPort.value),
        username: connectionUser.value.trim(),
        authMethod: connectionAuth.value as 'pem' | 'password',
        credentialId: connectionCredential?.value.trim() || undefined
      }
    };

    try {
      if (editingConnectionId) {
        await window.wagterm.storage.updateConnection(payload);
      } else {
        await window.wagterm.storage.addConnection(payload);
      }
      toggleForm(connectionForm, false);
      editingConnectionId = null;
      await renderConnections();
    } catch (error) {
      if (connectionError) {
        connectionError.textContent =
          error instanceof Error ? error.message : 'Failed to save connection.';
      }
    }
  });

  keySave?.addEventListener('click', async () => {
    if (!keyName || !keyType) {
      return;
    }

    if (keyError) {
      keyError.textContent = '';
    }

    try {
      await window.wagterm.storage.addKey({
        key: {
          id: crypto.randomUUID(),
          name: keyName.value.trim(),
          type: keyType.value as 'ed25519' | 'rsa' | 'pem',
          publicKey: keyPublic?.value.trim() || undefined,
          fingerprint: keyFingerprint?.value.trim() || undefined,
          path: keyPath?.value.trim() || undefined
        },
        secret: keySecret?.value.trim() || undefined
      });
      toggleForm(keyForm, false);
      await renderKeys();
    } catch (error) {
      if (keyError) {
        keyError.textContent = error instanceof Error ? error.message : 'Failed to save key.';
      }
    }
  });

  connectionsList?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }
    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    if (!action || !id) {
      return;
    }

    if (action === 'delete') {
      const confirmDelete = confirm('Delete this connection?');
      if (!confirmDelete) {
        return;
      }
      await window.wagterm.storage.deleteConnection({ id });
      await renderConnections();
      return;
    }

    const profile = connectionProfiles.get(id);
    if (!profile) {
      return;
    }

    if (action === 'edit') {
      editingConnectionId = profile.id;
      if (connectionName) {
        connectionName.value = profile.name;
      }
      if (connectionHost) {
        connectionHost.value = profile.host;
      }
      if (connectionUser) {
        connectionUser.value = profile.username;
      }
      if (connectionPort) {
        connectionPort.value = String(profile.port);
      }
      if (connectionAuth) {
        connectionAuth.value = profile.authMethod;
      }
      if (connectionCredential) {
        connectionCredential.value = profile.credentialId ?? '';
      }
      toggleForm(connectionForm, true);
      return;
    }

    if (action === 'connect') {
      if (currentSessionId && sessionClose) {
        await window.wagterm.sshSession.close({ sessionId: currentSessionId });
      }

      clearSessionOutput();
      updateSessionStatus(`Connecting to ${profile.username}@${profile.host}...`);

      const response = await window.wagterm.sshSession.start({
        profile,
        cols: 100,
        rows: 30
      });
      currentSessionId = response.sessionId;
      updateSessionStatus(`Connected: ${profile.username}@${profile.host}`);

      removeSessionData?.();
      removeSessionExit?.();

      removeSessionData = window.wagterm.sshSession.onData((payload) => {
        if (payload.sessionId !== currentSessionId) {
          return;
        }
        appendSessionOutput(payload.data);
      });

      removeSessionExit = window.wagterm.sshSession.onExit((payload) => {
        if (payload.sessionId !== currentSessionId) {
          return;
        }
        appendSessionOutput(`\n[session closed exit=${payload.exitCode ?? 'null'}]\n`);
        updateSessionStatus('No active session.');
        currentSessionId = null;
        sessionClose?.setAttribute('disabled', 'true');
      });

      sessionClose?.removeAttribute('disabled');
    }
  });

  sessionSend?.addEventListener('click', () => {
    if (!sessionInput || !currentSessionId) {
      return;
    }
    const data = sessionInput.value;
    if (!data.trim()) {
      return;
    }
    void window.wagterm.sshSession.sendInput({ sessionId: currentSessionId, data: `${data}\n` });
    sessionInput.value = '';
  });

  sessionInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    sessionSend?.click();
  });

  sessionClose?.addEventListener('click', async () => {
    if (!currentSessionId) {
      return;
    }
    await window.wagterm.sshSession.close({ sessionId: currentSessionId });
    updateSessionStatus('No active session.');
    currentSessionId = null;
    sessionClose.setAttribute('disabled', 'true');
  });

  void renderConnections();
  void renderKeys();
}
