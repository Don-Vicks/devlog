# devlog (monorepo)

Automated build-in-public tool: watches your repos, turns commits into on-brand social post drafts, redacts secrets automatically, and gives you a dashboard to review/approve/manage everything. Electron shell, background daemon, and dashboard live together here as npm workspaces.

## Structure

```
devlog-monorepo/
  package.json              root scripts (build/typecheck everything)
  tsconfig.base.json          shared TS config extended by every package
  packages/
    core/                    @devlog/core — daemon logic, CLI, SQLite, redaction, AI generation
    electron/                @devlog/electron — tray app, dashboard window, IPC bridge
    dashboard/               @devlog/dashboard — React UI (Queue/Repos/History/Voice/Accounts)
```

**Dependency direction:** `dashboard` and `electron` both import types and functions from `core` (via `@devlog/core`, workspace-linked). `core` has zero dependency on the other two — it works standalone as a CLI, exactly as it did before the Electron shell existed.

## First-time setup

```bash
npm install          # installs all three packages, links @devlog/core via workspaces
npm run build         # builds core -> dashboard -> electron, in that order (order matters — see below)
cp packages/core/.env.example packages/core/.env
# edit packages/core/.env — add GEMINI_API_KEY at minimum
```

**Why build order matters:** `@devlog/electron` and `@devlog/dashboard` both resolve `@devlog/core`'s compiled `dist/index.d.ts` for types. If you run `npm run typecheck` or `npm run build` on electron/dashboard before core has been built at least once, it'll fail with "Cannot find module '@devlog/core'". The root `build` and `typecheck` scripts already handle this ordering — always prefer running them from the repo root rather than inside individual packages the first time.

## Running it

**As a CLI only** (no Electron, exactly like the original standalone tool):
```bash
node packages/core/dist/cli.js install /path/to/your/repo
cp packages/core/devlog.config.example.yml /path/to/your/repo/.devlog.yml
# edit .devlog.yml, then commit something in that repo
node packages/core/dist/cli.js queue
```

**As the Electron app** (dashboard + tray):
```bash
npm run build              # build everything first
npm run electron:dev        # launches the Electron shell pointing at the built dashboard
```

**Dashboard alone, in a browser tab, for UI iteration** (no Electron, no IPC — uses a stub API that no-ops writes):
```bash
npm run dashboard:dev
# open http://localhost:5173
```

## What's real vs. scaffolded

**Fully working, tested end-to-end:**
- Git hook install + commit extraction + visibility-aware redaction + AI generation routing (Gemini → Groq fallback → local Ollama for private/client repos)
- SQLite storage: repos, posts, voice examples, engagement (schema only for engagement — no puller yet)
- CLI: `install`, `process-commit`, `queue`, `approve`, `reject`, `repos`
- Electron main process: tray icon with live pending-count tooltip, dashboard window, chokidar watcher pushing `devlog:db-changed` IPC events when the SQLite file changes
- IPC bridge: `repos:list/add/pickFolder`, `posts:listPending/listAll/approve/reject`, `voice:read/write` — all wired to real `@devlog/core` functions, verified by direct invocation (not mocked)
- Dashboard: all five views (Queue, Repos, History, Voice, Accounts) build and type-check clean, calling the real API surface via `window.devlogAPI`

**Intentionally not built yet** (next phases):
- Real OAuth to X/LinkedIn/Meta — the Accounts view is a deliberately honest placeholder UI; every "Connect" button is disabled with an explanatory note
- Auto-posting — currently ends at "approve in the dashboard, copy the text yourself"
- Engagement metrics puller — schema exists, nothing populates it yet
- Packaged `.app`/`.dmg` build (electron-builder config) — currently runs via `npm run electron:dev`, not yet packaged for distribution

## Notes on Electron specifics

- `packages/electron/src/main.ts` creates a single dashboard `BrowserWindow` and a menu-bar `Tray`. Closing the window hides it rather than quitting — the tray controls the app's actual lifecycle, matching the "always running in the background" requirement.
- `packages/electron/src/preload.ts` is the only bridge between the renderer (dashboard) and Node/Electron APIs, via `contextBridge`. The dashboard never touches SQLite or the filesystem directly.
- The tray icon in `main.ts` uses a placeholder (`nativeImage.createFromNamedImage`) — swap in a real `.png`/`.icns` asset before shipping.
