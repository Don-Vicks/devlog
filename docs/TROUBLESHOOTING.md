# devlog troubleshooting guide

## better-sqlite3: NODE_MODULE_VERSION mismatch

```
Error: The module was compiled against a different Node.js version
using NODE_MODULE_VERSION 137. This version of Node.js requires
NODE_MODULE_VERSION 128.
```

**Why:** Two different Node versions exist on your machine:
- **System Node** (v24, MODULE_VERSION 137) — runs the CLI and git hook
- **Electron's internal Node** (v32, MODULE_VERSION 128) — runs the tray app

The `better-sqlite3` native binary only works with one version at a time. Switching between CLI and Electron requires a rebuild.

**Fix for CLI** (after `npm install` or `npm run build`):
```bash
cd node_modules/better-sqlite3 && rm -rf build && npx node-gyp rebuild --release
```

**Fix for Electron dev mode** (`npm run dev`):
```bash
cd node_modules/better-sqlite3 && rm -rf build && \
  npx node-gyp rebuild --release --target=32.3.3 --arch=arm64 \
  --dist-url=https://electronjs.org/headers
```

The `dev.sh` script handles this automatically before launching Electron.

**Fix for packaging** (`npm run package`):
electron-builder handles this — it runs `@electron/rebuild` automatically during the build. No manual step needed.

**Pro tip:** Use `npm run cli` for CLI work (always has system Node build) and `npm run dev` for the tray app (rebuilds for Electron). Don't expect both to work simultaneously without rebuilding.

---

## LinkedIn OAuth fails with "Invalid OAuth callback"

**Symptom:** After authorizing in the browser, you're redirected to the callback URL but get "Invalid OAuth callback" or "State mismatch"

**Causes:**
1. LinkedIn does **not** support PKCE — uses standard auth code flow with `client_secret`
2. The callback server must be running on `127.0.0.1` (not `localhost`) — LinkedIn's redirect validation is strict
3. The redirect URI in your LinkedIn app dashboard must exactly match `http://127.0.0.1:4321/callback/linkedin`

**Fix:**
1. Go to your app at https://www.linkedin.com/developers/apps
2. Under **Auth** → **Authorized redirect URLs for your app**, add:
   `http://127.0.0.1:4321/callback/linkedin`
3. Make sure "Use PKCE" is **disabled** in the LinkedIn app settings
4. Retry connecting from the Accounts tab

**Scopes required:** `w_member_social profile openid`

---

## LinkedIn posting fails (401 or 403)

**Symptom:** Post is marked as "failed" after approval

**Causes:**
1. **Expired token** — LinkedIn access tokens last ~12 months with no refresh mechanism. Check the account expiry in the DB:
   ```bash
   node -e "const {getDb,listAccounts}=require('./packages/core/dist');const db=getDb();console.log(JSON.stringify(listAccounts(db),null,2));db.close()"
   ```
   If expired, reconnect in the Accounts tab.

2. **Person URN format** — The posting uses OIDC `sub` from `/v2/userinfo` to construct `urn:li:person:{sub}`. This works with LinkedIn's v2 UGC API. If it fails, it's likely a permissions or scope issue.

3. **Media file missing** — If a post has `media_path` but the file was deleted (cleaned up after a previous failed attempt), the post will fail. Reset the post to pending without media:
   ```bash
   node -e "
   const Database = require('better-sqlite3');
   const path = require('path');
   const os = require('os');
   const db = new Database(path.join(os.homedir(), '.devlog', 'devlog.sqlite'));
   db.prepare(\"UPDATE posts SET status='pending', media_path=NULL WHERE id=<postId>\").run();
   db.close();
   "
   ```
   Or use `npm run cli retry <postId>`.

---

## X API posts fail with 403

**Symptom:** X posts fail, especially after the first successful post

**Cause:** The X API free tier ($0/month) is **write-only**. You cannot:
- `GET /2/users/me` (handle falls back to `"me"`)
- Post tweets (requires Basic tier at $200/month or pay-per-use)

You'll see errors like `403 Forbidden` or `Rate limit exceeded` on free tier.

**Fix:** Upgrade to Basic tier ($200/month) at https://developer.x.com/en/portal/dashboard. After upgrading, the OAuth flow remains the same.

---

## Port 4321 in use (EADDRINUSE)

**Symptom:** OAuth connection fails with "Port 4321 is in use"

**Cause:** A previous OAuth flow didn't shut down cleanly, or another app uses port 4321.

**Fix:**
```bash
lsof -i :4321
kill -9 <PID>
```

Or change the port by setting `X_CALLBACK_PORT` in your `.env`:
```
X_CALLBACK_PORT=4322
```

---

## Electron app shows blank window

**Symptom:** The Electron app launches but the dashboard window is blank

**Causes:**
1. **Dashboard not built** — In dev mode (`npm run dev`), Electron expects Vite dev server on port 5173. If Vite crashed, reload the page or restart with `npm run dev`.
2. **Wrong path in packaged mode** — The dashboard HTML must be at `Resources/dashboard/index.html` in the `.app` bundle. If you modified the `extraResources` config, check the path.

**Fix for dev:**
```bash
# Check Vite is running
lsof -i :5173
# If not, restart
npm run dev
```

**Fix for packaged:** Rebuild the package:
```bash
npm run package
```

---

## `git commit` hangs or is slow

**Symptom:** `git commit` takes 30+ seconds

**Cause:** The post-commit hook runs the AI generation pipeline (Groq API). If Groq is rate-limited, the hook waits for a response.

**Fix:** Run `git commit` with `--no-verify` to skip the hook:
```bash
git commit -m "message" --no-verify
```

If you want to temporarily disable the hook:
```bash
chmod -x .git/hooks/post-commit
```

To re-enable:
```bash
npm run cli install /path/to/repo
```

---

## Groq API rate limited (429)

**Symptom:** Pipeline fails with `Groq API error: 429 Rate limit reached`

**Free tier limits:** 30 requests/min, 100K tokens/day (TPD).

**Fix:**
- Wait until the rate limit resets (usually ~30 min for TPD limit)
- Upgrade to paid tier at https://console.groq.com/settings/billing
- Or set `GEMINI_API_KEY` as fallback:
  ```
  GEMINI_API_KEY=your_key_here
  ```

---

## DB schema changes not taking effect

**Symptom:** New columns or tables aren't appearing

**Cause:** `CREATE TABLE IF NOT EXISTS` won't add columns to existing tables. The DB at `~/.devlog/devlog.sqlite` was created with an old schema.

**Fix:** Either manually add the column:
```bash
sqlite3 ~/.devlog/devlog.sqlite "ALTER TABLE posts ADD COLUMN new_column TEXT;"
```

Or remove the DB (loses all data):
```bash
rm ~/.devlog/devlog.sqlite
```

---

## `npm run rebuild-native` fails

**Symptom:** node-gyp errors during native module rebuild

**Causes:**
1. **Missing Xcode Command Line Tools:**
   ```bash
   xcode-select --install
   ```

2. **Wrong Node version** — The rebuild target must match Electron's version:
   ```bash
   cd node_modules/better-sqlite3 && rm -rf build && \
   npx node-gyp rebuild --release --target=32.3.3 --arch=arm64 \
   --dist-url=https://electronjs.org/headers
   ```
   Check `packages/electron/package.json` for the exact `electron` version.

3. **arm64 vs x64 mismatch** — On Apple Silicon, always use `--arch=arm64`.
