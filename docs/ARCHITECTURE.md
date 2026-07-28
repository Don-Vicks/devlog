# devlog architecture

## Layout

```
devlog-monorepo/
├── packages/
│   ├── core/          # CLI, pipeline, AI generation, SQLite, OAuth, Telegram bot
│   ├── dashboard/     # React + Vite + Tailwind (tabbed UI: Queue, Repos, History, Voice, Accounts)
│   └── electron/      # System tray app, IPC bridge
├── scripts/
│   └── dev.sh         # Builds all, starts Vite, rebuilds native modules for Electron, launches
└── docs/
    └── ARCHITECTURE.md
```

## How the packaged .app is structured

When you run `npm run package`, electron-builder produces:

```
devlog.app/
└── Contents/
    ├── MacOS/devlog              # Electron binary
    ├── Info.plist
    └── Resources/
        ├── app.asar              # Electron app: main.ts, preload.ts, handlers.ts (compiled JS)
        ├── core/                 # @devlog/core (from packages/core/dist)
        │   ├── cli.js            # CLI entry point
        │   ├── pipeline.js       # Commit → draft orchestrator
        │   ├── generation/       # AI clients, voice rules, snippet renderer
        │   ├── publish/          # OAuth flows, X/LinkedIn posting
        │   ├── db/               # SQLite queries + schema.sql
        │   ├── queue/            # Telegram bot
        │   └── voice/profiles/   # Voice profiles (e.g. default.md)
        ├── dashboard/            # @devlog/dashboard (from packages/dashboard/dist)
        │   ├── index.html
        │   └── assets/           # Built JS + CSS
        └── better-sqlite3/       # Native module compiled for Electron 32.3.3 (MODULE_VERSION 128)
```

## UI loading: dev vs packaged

| Mode | Dashboard | Source |
|------|-----------|--------|
| Dev (`npm run dev`) | Vite dev server at `localhost:5173` | `packages/dashboard/src/` (HMR) |
| Packaged | `file://` from `Resources/dashboard/index.html` | `packages/dashboard/dist/` (static build) |

In `main.ts:21-24`:

```ts
if (app.isPackaged)
  win.loadFile(path.join(process.resourcesPath, 'dashboard', 'index.html'));
else
  win.loadURL('http://localhost:5173');
```

The dashboard Vite config sets `base: './'` so relative asset paths work under `file://`.

## CLI execution

The post-commit hook calls `node "<cliPath>" process-commit <repoPath> &` (backgrounded).

- **Dev:** `cliPath` = `packages/core/dist/cli.js`
- **Packaged:** `cliPath` = `Resources/core/cli.js` (no Electron needed, runs with system Node)
- **Install via Dashboard:** `handlers.ts:55` resolves `cliPath` relative to `__dirname` in the ASAR

The CLI is the same code regardless — just compiled JS from `@devlog/core`. The native module (`better-sqlite3`) must match the Node version running it:
- **System Node (v24, MODULE_VERSION 137):** used by CLI/hook. Rebuilt with plain `node-gyp rebuild`.
- **Electron (v32, MODULE_VERSION 128):** used by the tray app. Rebuilt with `--target=32.3.3 --dist-url=https://electronjs.org/headers`.

## Security boundary (IPC)

```
Renderer (React)          Preload (contextBridge)     Main Process (Node)
┌──────────────────┐      ┌──────────────────┐       ┌──────────────────┐
│ App.tsx           │      │ preload.ts       │       │ handlers.ts      │
│                   │─────▶│                  │──────▶│                  │
│ api.ts            │      │ devlogAPI = {    │       │ ipcMain.handle(  │
│  repos.list()     │      │   repos: ...,    │       │   'repos:add',   │
│  posts.approve()  │      │   posts: ...,    │       │   'posts:approve'│
│  voice.read()     │      │   voice: ...,    │       │   ...)           │
│  accounts.connect()│     │   accounts: ...  │       │                  │
│  media.readImage()│      │   media: ...,    │       │  → reads SQLite  │
│  onDbChanged()    │      │   onDbChanged()  │       │  → runs OAuth    │
└──────────────────┘      └──────────────────┘       │  → reads files   │
                                                      └──────────────────┘
```

- `contextIsolation: true`, `nodeIntegration: false`
- Renderer never touches SQLite, filesystem, or Node APIs directly
- DB changes detected by chokidar → `devlog:db-changed` event pushed to renderer for auto-refresh

## Environment variables

Two separate loading paths:

| Context | Load mechanism | Priority |
|---------|---------------|----------|
| CLI (git hook) | `loadEnv.ts` | `~/.devlog/.env` → monorepo root `.env` → cwd `.env` |
| Electron (tray) | `main.ts` `rootPath('.env')` | 3 levels up from `Resources/` → monorepo root `.env` |

In packaged mode, Electron loads `.env` from 3 directories above `Resources/` (i.e. `/Applications/devlog.app/.env`). The CLI always checks `~/.devlog/.env` first.

## Voice profiles

- **Storage:** `packages/core/voice/profiles/*.md` → `Resources/core/voice/profiles/` in packaged app
- **Resolution:** by profile name from `.devlog.yml`'s `voice_profile` field. Falls back to `default.md`.
- **Auto-create:** `ensureProfilesDir()` creates `profiles/` and writes a default template if missing
- **Migration:** legacy `voice-rules.md` migrates to `profiles/default.md` on first access

## Data flow

```
git commit
  ↓ (post-commit hook)
node cli.js process-commit <repo>
  ↓
pipeline.ts:
  1. extractCommitPayload (git diff)
  2. redact (secrets, names)
  3. generatePost (Groq → Gemini → Ollama)
     → extractSnippet (AI picks best code lines)
     → renderSnippet (sharp SVG→PNG)
  4. createPost (SQLite)
  5. notifyQueue (Telegram)
  ↓
user reviews in Dashboard or Telegram bot
  ↓
approve → approveAndMaybePublish
  → postToX / postToLinkedIn
```
