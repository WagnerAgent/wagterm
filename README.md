# Wagterm

Open-source AI SSH desktop client (Electron + TypeScript).

## Development

Follow Electron's recommended setup by installing Electron as a dev dependency in the project.

```bash
npm install
npm run dev
```

## Structure

- `src/main`: Electron main process
- `src/preload`: Secure IPC bridge
- `src/renderer`: UI surface (Vite)
- `src/agent`: Agentic scaffolding for decisions and command proposals
