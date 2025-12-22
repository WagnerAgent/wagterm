import './style.css';

type AppInfo = {
  name: string;
  version: string;
};

type McpServersInfo = {
  count: number;
};

declare global {
  interface Window {
    wagterm: {
      getAppInfo: () => Promise<AppInfo>;
      ssh: {
        listMcpServers: () => Promise<{ servers: Array<{ id: string }> }>;
      };
    };
  }
}

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Wagterm</p>
          <h1>AI-powered SSH, locally controlled.</h1>
          <p class="subtitle">Scaffolded Electron + TypeScript shell ready for agent workflows.</p>
        </div>
        <div class="card" id="app-info">Loading app info...</div>
        <div class="card subtle" id="mcp-info">Loading MCP servers...</div>
      </header>
      <section class="grid">
        <article class="panel">
          <h2>Conversations</h2>
          <p>Chat and agent decisions will land here.</p>
        </article>
        <article class="panel">
          <h2>Approvals</h2>
          <p>Command proposals will require explicit approval.</p>
        </article>
        <article class="panel">
          <h2>Connections</h2>
          <p>Profiles for EC2, Droplets, and other hosts.</p>
        </article>
        <article class="panel">
          <h2>Credentials</h2>
          <p>PEM and key management with local-only storage.</p>
        </article>
      </section>
    </main>
  `;

  window.wagterm.getAppInfo().then((info) => {
    const appInfo = document.querySelector<HTMLDivElement>('#app-info');
    if (appInfo) {
      appInfo.textContent = `${info.name} v${info.version}`;
    }
  });

  window.wagterm.ssh.listMcpServers().then((response) => {
    const mcpInfo = document.querySelector<HTMLDivElement>('#mcp-info');
    if (mcpInfo) {
      const info: McpServersInfo = { count: response.servers.length };
      mcpInfo.textContent = `MCP servers: ${info.count}`;
    }
  });
}
