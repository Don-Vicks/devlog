# devlog

Automated build-in-public tool. Commits generate social posts, reviewed from a dashboard or Telegram, then auto-posted to X/LinkedIn.

## Architecture

Monorepo with three packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@devlog/core` | `packages/core` | CLI, pipeline, AI generation, SQLite DB, OAuth, Telegram bot |
| `@devlog/electron` | `packages/electron` | System tray app, IPC bridge to dashboard |
| `@devlog/dashboard` | `packages/dashboard` | React + Vite + Tailwind UI |

## Commands

```bash
npm run dev              # Full dev: builds all, starts Vite, launches Electron
npm run build            # Production build (core → dashboard → electron)
npm run typecheck        # Build + typecheck all packages
npm run rebuild-native   # Rebuild better-sqlite3 for Electron's Node version
```

## Data flow

```
git commit → post-commit hook → cli process-commit → pipeline.ts
  → extractCommitPayload (git diff)
  → redact (secrets, names)
  → generatePost (Gemini → Groq → Ollama)
  → createPost (SQLite)
  → notifyQueue (Telegram)
  → user reviews in Dashboard or Telegram bot
  → approve → approveAndMaybePublish → postToX / postToLinkedIn
```

## Key files

- `packages/core/src/pipeline.ts` — orchestrates the full commit→draft flow
- `packages/core/src/publish/publish.ts` — approve + auto-post routing
- `packages/core/src/generation/generatePost.ts` — AI prompt builder + model routing
- `packages/core/src/db/index.ts` — all SQLite queries (better-sqlite3, synchronous)
- `packages/core/src/config/loadEnv.ts` — loads .env from ~/.devlog or monorepo root
- `packages/core/src/queue/bot.ts` — Telegram bot (long-polling)
- `packages/electron/src/main.ts` — Electron entry point, tray + window lifecycle
- `packages/electron/src/ipc/handlers.ts` — all IPC handlers (dashboard ↔ core)
- `packages/dashboard/src/App.tsx` — tab layout (Queue, Repos, History, Voice, Accounts)

## Conventions

- **TypeScript strict mode.** All packages use `tsconfig.base.json` (ES2021, strict, CommonJS output).
- **No comments in code** unless explaining a non-obvious why. The code should be self-documenting.
- **better-sqlite3 is synchronous.** All DB functions open a connection, do work, and close it. No persistent connections.
- **Security boundary.** The renderer (dashboard) never touches SQLite or the filesystem. All communication goes through preload → IPC → main process.
- **Voice profiles** live in `packages/core/voice/profiles/` as `.md` files. The `default` profile always exists.
- **.env** is loaded from `~/.devlog/.env` first (user-level), then monorepo root, then cwd. Never commit `.env`.

## Platform support

| Platform | Auth | Posting | Threads |
|----------|------|---------|---------|
| X (Twitter) | OAuth 2.0 + PKCE | v2 API | Yes (reply chain) |
| LinkedIn | OAuth 2.0 + PKCE | UGC Posts API | No (single posts) |
| Facebook | Not implemented | — | — |
| Instagram | Not implemented | — | — |

## AI routing

- **Public repos:** Groq llama-3.3-70b (free, 30 req/min) → Gemini Flash fallback if key is set
- **Private/client repos:** Local Ollama only (nothing leaves the machine)

## Env vars

See `.env` at the repo root. Minimum for generation: `GROQ_API_KEY` (free at console.groq.com). For X posting: add `X_CLIENT_ID`. For LinkedIn: add `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET`. For Telegram bot: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.

## Gotchas

- `npm run rebuild-native` after installing or updating `electron` — native modules must match Electron's Node version.
- The git hook runs `process-commit` in the background (`&`). Errors go to the terminal but don't block commits.
- LinkedIn tokens can't be auto-refreshed. When expired, the user must reconnect in the Accounts tab.
- Schema changes via `CREATE TABLE IF NOT EXISTS` won't add columns to existing tables. Existing DBs need manual `ALTER TABLE` or a fresh `~/.devlog/devlog.sqlite`.
