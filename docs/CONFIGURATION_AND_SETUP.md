# Devlog Configuration & Setup Guide

This guide details how to configure the Devlog workspace, set up local repositories, customize voice profiles, and manage environment variables.

---

## 1. Repository Configuration (`.devlog.yml`)

Each repository watched by Devlog should have a `.devlog.yml` configuration file in its root directory. This tells Devlog how to handle commits, what name to display, and where to generate social drafts.

### Example Configuration

```yaml
# Copy to the root of your repository as .devlog.yml

project_name: Padi              # Name displayed in Devlog dashboard (always overrides auto-detection)
visibility: public               # Options: public | private | client
project_tag: "#PadiApp"          # Appended to the end of your generated posts
voice_profile: default           # The markdown voice profile to use (e.g. 'default' matches voice/profiles/default.md)
platforms:
  - x
  - linkedin                     # Un-comment to generate drafts for multiple platforms
```

### Visibility Contexts
Devlog respects the privacy of your work by supporting three distinct visibility levels:

*   **`public`**: Devlog processes git diffs fully and feeds them into the configured LLM to write highly technical, detailed, context-rich post drafts.
*   **`private` / `client`**: Devlog **never** sends git diffs or file change history to the LLMs. To write drafts for these repos, format your commit messages using double brackets like this:
    ```bash
    git commit -m "fix: database transaction lock issue [[summary: resolved a deadlock occurring during rapid user sign-ups]]"
    ```
    Devlog extracts the text inside `[[summary: ...]]` and uses it as the sole prompt content, keeping your codebase secure and proprietary.

---

## 2. Secrets & Content Redaction

Before any code diff is sent to LLMs (even for public repositories), the `@devlog/core` pipeline runs it through an automated redaction engine to purge sensitive information.

### Automatic Redaction Rules
*   **API Tokens and Keys**: Matches standard high-entropy signatures (e.g., `sk-proj-...`, `AIzaSy...`, `AWS_ACCESS_KEY_ID`).
*   **Environment Variables**: Automatically identifies assignments to common secrets in code (e.g., `PASSWORD = "..."`, `db_uri = "..."`).
*   **Personal Information**: Masks local filesystem absolute paths, system usernames, and IP addresses.
*   **Custom Overrides**: Uses simple pattern matches from project configuration (if defined) to avoid leaking specific domain keys or internal server names.

---

## 3. Custom Voice Profiles

Devlog models its writing style on voice profiles stored under `packages/core/voice/profiles/` (or in the packaged environment, `Resources/core/voice/profiles/`). 

### Creating a Profile
To create a custom writing style (e.g., `founder` or `technical-writer`), write a markdown profile file:

1.  Place the new profile in `packages/core/voice/profiles/founder.md`.
2.  Update your repository's `.devlog.yml`:
    ```yaml
    voice_profile: founder
    ```

### Structure of a Voice Profile Markdown

A profile contains explicit instructions for tone, structure, formatting, and banned words. Here is the recommended structure:

```markdown
# Voice Rules — Founder Style

## Voice
- Casual, transparent, highly personal.
- Focus on why decisions are made, not just what lines changed.
- Avoid sounding overly formal or academic.

## Banned Phrases
- "Excited to announce"
- "Thrilled to share"
- "Game-changer"

## Formatting
- No emojis.
- Limit output to 1 target platform tag.
- Short, punchy sentences.
```

---

## 4. AI Provider Configurations

Devlog is provider-agnostic and will route requests dynamically based on available API keys in your `.env`.

| API Provider | Environment Variable | Usage Description |
|---|---|---|
| **Gemini** | `GEMINI_API_KEY` | Primary model engine for structural parsing and multi-format generation. |
| **Groq** | `GROQ_API_KEY` | Fallback model engine when high throughput and low-latency completions are needed. |
| **Ollama** | No Key Required (uses local daemon) | Fallback local model engine when developer internet is disconnected, or for privacy-first local tasks. |

### Environment File Setup
Create a file named `.env` in the monorepo root or at `~/.devlog/.env`:

```env
# Core API Keys
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Telegram configuration (optional, for remote push alerts)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

---

## 5. Native Module Build Guide (`better-sqlite3`)

Devlog uses SQLite via the `better-sqlite3` native Node library. Because native modules compiled for standard command-line Node.js are binary-incompatible with the Electron V8 runtime, **you must compile `better-sqlite3` twice**.

### Compilation Targets

1.  **System Node (CLI Runtime)**:
    *   Used by the post-commit Git hooks and the CLI binary.
    *   Typically matches Node v24 (or your local system version).
2.  **Electron Runtime (Tray App)**:
    *   Used by the tray controller and IPC handlers.
    *   Matches the custom Chromium/Node engine compiled into Electron.

### How to Compile

Run the built-in workspace scripts to handle compilation and configuration automatically:

```bash
# 1. Compile native modules for System Node (used by CLI and hook)
npm run rebuild:cli

# 2. Compile native modules for Electron (used by the tray app)
npm run rebuild:electron
```

Under the hood, these run `node-gyp` with matching target flags:
```bash
# Rebuilding for Electron manually
npx node-gyp rebuild --target=32.3.3 --arch=x64 --dist-url=https://electronjs.org/headers
```

> [!WARNING]
> If you run the Electron dev server and see the error `Error: The module '/path/to/better-sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION`, run `npm run build` or `npm run rebuild:electron` to re-align binary versions.
