# @devlog/core

Watches your repos, turns commits into on-brand build-in-public posts, redacts secrets automatically, and queues drafts for your approval. This package is the daemon/CLI/pipeline — it works fully standalone (no Electron required), and is also consumed by `@devlog/electron` and `@devlog/dashboard` as a workspace dependency. See the monorepo root README for the full picture.

**TypeScript, strict mode on.** Shared types live in `src/types.ts`, exported via `src/index.ts` as this package's public API — e.g. `Visibility = 'public' | 'private' | 'client'` makes it a compile error to accidentally route a private repo's diff to a cloud model.

## Build first

```bash
npm install     # from the monorepo root, not this folder — see root README
npm run build -w @devlog/core
```

Everything below assumes core has been built — the CLI runs from `dist/cli.js`, not `src/cli.ts`, in production. For active development, `npm run dev -w @devlog/core` runs directly against the TS source via ts-node-dev with auto-restart.


## What's built right now (Phase 1-2 from the spec)

- ✅ Git post-commit hook installer
- ✅ Project name resolution (config > package.json > README > git remote > folder)
- ✅ Visibility-aware extraction (public repos send diffs, private/client repos send file names + a manual one-line summary only)
- ✅ Redaction pass (API keys, secrets, connection strings, internal URLs, configurable client-name blocklist)
- ✅ AI generation routing: Gemini Flash (free tier) for public repos, local Ollama for private/client repos, Groq as fallback
- ✅ Voice rules doc + auto few-shot learning from your edits
- ✅ SQLite storage for posts, repos, voice examples, engagement, accounts
- ✅ CLI queue/approve/reject workflow
- ✅ Telegram notification hook (optional)
- ✅ Media generation scaffolding (Playwright screenshots, code cards via carbon-now-cli)

## Not built yet (Phase 3-6 from the spec — needs your machine + credentials)

- Electron wrapper + tray icon + dashboard UI
- Real OAuth flows for X / LinkedIn / Meta (needs your developer app credentials, a browser, and a machine to receive the OAuth redirect)
- Auto-posting (currently: approve → copy the text yourself)
- Engagement feedback loop (needs a live connected X account with real posts)

These are scaffolded with clear extension points below so Claude Code (or I, in a follow-up) can build them directly on top of this without re-architecting anything.

## Setup

```bash
cd devlog
npm install
cp .env.example .env
# fill in GEMINI_API_KEY at minimum — https://aistudio.google.com/apikey
```

For private/client repos, install Ollama locally and pull a model:
```bash
ollama pull llama3.1:8b
```

## Watch a repo

```bash
# from the monorepo root
node packages/core/dist/cli.js install /path/to/your/repo
cp packages/core/devlog.config.example.yml /path/to/your/repo/.devlog.yml
# edit .devlog.yml: set project_name, visibility, project_tag
```

Now every commit in that repo triggers the pipeline automatically in the background.

## Review drafts

```bash
node packages/core/dist/cli.js queue                # list pending drafts
node packages/core/dist/cli.js approve 3            # approve post #3 as-is
node packages/core/dist/cli.js approve 3 -e "edited text here"   # approve with edits (also trains voice)
node packages/core/dist/cli.js reject 3
```

## Next steps

Electron shell and dashboard are now built — see `../electron` and `../dashboard`, and the monorepo root README for how to run them together. Remaining:

1. **OAuth for X** — register a developer app at developer.x.com, add `X_CLIENT_ID`/`X_CLIENT_SECRET` to `.env`, build the callback server (`src/publish/xAuth.ts` is the intended location — not yet built).
2. **Auto-posting** — once tokens are in Keychain, `src/publish/postToX.ts` calls the X API v2 `POST /2/tweets` endpoint using the stored token.
3. **Engagement metrics puller** — the `engagement` table exists in the schema; nothing populates it yet.

## Folder structure

```
core/
  src/
    index.ts                public export surface — import from here, not internal paths
    types.ts                 shared types used across the whole monorepo
    cli.ts                    entry point
    pipeline.ts                orchestrates the full extract->redact->generate->queue flow
    config/                     .devlog.yml loader (+ writer, used by the dashboard's Repos view)
    extraction/                 git diff/commit + project name resolution
    redaction/                   secret-stripping filters
    generation/                  Gemini / Groq / Ollama clients, prompt builder, voice-rules read/write
    media/                       screenshot + code card generation
    hooks/                       git hook installer
    queue/                       Telegram notifications
    db/                           SQLite schema + typed queries
  dist/                       compiled output (npm run build), git-ignored
  voice/
    voice-rules.md               edit this to shape your posting voice (also editable from the dashboard)
```
