# Wagterm

<div align="center">
  <p>Open-source AI SSH desktop client built with Electron, TypeScript, and React.</p>
</div>

<div align="center">

[![Release](https://img.shields.io/github/v/release/WagnerAgent/wagterm)](https://github.com/WagnerAgent/wagterm/releases)
[![Build](https://github.com/WagnerAgent/wagterm/actions/workflows/release.yml/badge.svg)](https://github.com/WagnerAgent/wagterm/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/WagnerAgent/wagterm)](LICENSE)

</div>

## Overview

Wagterm is an Electron-based desktop app focused on SSH workflows with an AI-assisted experience. It uses `electron-vite` for fast iteration and a clean separation between main, preload, and renderer processes.

## Tech stack

- Electron + `electron-vite`
- React + Vite (renderer)
- TypeScript
- Tailwind CSS
- SQLite (`better-sqlite3`)

## Getting started

### Prerequisites

- Node.js 18+ (20 recommended)
- npm 9+

### Install and run

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev`: start the app in dev mode
- `npm run build`: build main/preload/renderer bundles
- `npm run preview`: preview the renderer build
- `npm run lint`: run ESLint
- `npm run rebuild:electron`: rebuild native deps for Electron
- `npm run package`: build installers via `electron-builder`

## Packaging

Packaging is driven by the `electron-builder` config in `package.json`.

- macOS: `.dmg`
- Windows: NSIS installer

```bash
npm run build
npm run rebuild:electron
npm run package
```

## Releases

GitHub Actions builds and publishes installers when you push a tag like `v0.1.0`. Manual runs upload artifacts only.

```bash
git tag v0.1.0
git push origin main --tags
```

## Project structure

- `src/main`: Electron main process
- `src/preload`: secure IPC bridge
- `src/renderer`: UI surface (Vite + React)
- `src/agent`: agentic scaffolding for decisions and command proposals

## Contributing

Contributions are welcome. Please open an issue or discussion describing the change and your proposed approach.

## License

MIT. See `LICENSE` when available.
