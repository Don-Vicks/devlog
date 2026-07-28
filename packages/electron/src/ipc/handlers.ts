import { ipcMain, dialog } from 'electron';
import {
  getDb,
  listRepos,
  listPending,
  listAllPosts,
  setPostStatus,
  installHook,
  loadRepoConfig,
  writeRepoConfig,
  resolveProjectName,
  upsertRepo,
  readVoiceRules,
  writeVoiceRules,
  listVoiceProfiles,
  createVoiceProfile,
  deleteVoiceProfile,
  listAccounts,
  connectXAccount,
  disconnectXAccount,
  connectLinkedInAccount,
  disconnectLinkedInAccount,
  approveAndMaybePublish,
  RepoConfig,
} from '@devlog/core';
import path from 'path';
import fs from 'fs';
import { shell } from 'electron';

/**
 * All dashboard <-> daemon communication goes through these handlers.
 * The renderer never touches SQLite or the filesystem directly — only
 * preload.ts's contextBridge-exposed methods, which call these.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle('repos:list', () => {
    const db = getDb();
    const repos = listRepos(db);
    db.close();
    return repos;
  });

  ipcMain.handle('repos:pickFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    'repos:add',
    (_event, args: { repoPath: string; config: Partial<RepoConfig> }) => {
      const { repoPath, config } = args;

      writeRepoConfig(repoPath, config);
      const cliPath = path.join(__dirname, '..', '..', '..', 'core', 'dist', 'cli.js');
      installHook(repoPath, cliPath);

      const fullConfig = loadRepoConfig(repoPath);
      const { name } = resolveProjectName(repoPath, fullConfig);

      const db = getDb();
      const repo = upsertRepo(db, {
        repoPath,
        displayName: name,
        visibility: fullConfig.visibility,
        projectTag: fullConfig.project_tag,
        voiceProfile: fullConfig.voice_profile,
        platforms: fullConfig.platforms,
      });
      db.close();
      return repo;
    }
  );

  ipcMain.handle('posts:listPending', () => {
    const db = getDb();
    const posts = listPending(db);
    db.close();
    return posts;
  });

  ipcMain.handle('posts:listAll', () => {
    const db = getDb();
    const posts = listAllPosts(db);
    db.close();
    return posts;
  });

  ipcMain.handle(
    'posts:approve',
    (_event, args: { id: number; editedContent?: string | null }) => {
      return approveAndMaybePublish(args.id, args.editedContent ?? null);
    }
  );

  ipcMain.handle('posts:reject', (_event, args: { id: number }) => {
    const db = getDb();
    const post = setPostStatus(db, args.id, 'rejected');
    db.close();
    return post;
  });

  ipcMain.handle('voice:list', () => listVoiceProfiles());

  ipcMain.handle('voice:read', (_event, args?: { profile?: string }) => readVoiceRules(args?.profile));

  ipcMain.handle('voice:write', (_event, args: { content: string; profile?: string }) => {
    writeVoiceRules(args.content, args.profile);
    return true;
  });

  ipcMain.handle('voice:create', (_event, args: { name: string; template?: string }) => {
    return createVoiceProfile(args.name, args.template);
  });

  ipcMain.handle('voice:delete', (_event, args: { name: string }) => {
    deleteVoiceProfile(args.name);
    return true;
  });

  ipcMain.handle('accounts:list', () => {
    const db = getDb();
    const accounts = listAccounts(db);
    db.close();
    return accounts;
  });

  ipcMain.handle('accounts:envStatus', () => {
    return {
      x: { configured: !!process.env.X_CLIENT_ID },
      linkedin: {
        configured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
      },
    };
  });

  ipcMain.handle('accounts:connect', async (_event, args: { platform: string }) => {
    const callbackPort = Number(process.env.X_CALLBACK_PORT || '4321');

    if (args.platform === 'x') {
      const clientId = process.env.X_CLIENT_ID;
      if (!clientId) {
        throw new Error(
          'X_CLIENT_ID is not set in .env. Go to https://developer.x.com/en/portal/dashboard to create an app, then add your Client ID to the .env file at the project root.'
        );
      }
      return connectXAccount({
        clientId,
        clientSecret: process.env.X_CLIENT_SECRET || undefined,
        callbackPort,
        openExternal: (url) => shell.openExternal(url),
      });
    }

    if (args.platform === 'linkedin') {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error(
          'LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are not set in .env. Go to https://www.linkedin.com/developers/apps to create an app, then add your credentials to the .env file at the project root.'
        );
      }
      return connectLinkedInAccount({
        clientId,
        clientSecret,
        callbackPort,
        openExternal: (url) => shell.openExternal(url),
      });
    }

    throw new Error(`Unsupported platform: ${args.platform}`);
  });

  ipcMain.handle('accounts:disconnect', async (_event, args: { platform: string; handle: string }) => {
    if (args.platform === 'x') {
      await disconnectXAccount(args.handle);
      return true;
    }
    if (args.platform === 'linkedin') {
      await disconnectLinkedInAccount(args.handle);
      return true;
    }
    throw new Error(`Unsupported platform: ${args.platform}`);
  });

  ipcMain.handle('media:readImage', (_event, args: { filePath: string }) => {
    try {
      if (!fs.existsSync(args.filePath)) return null;
      const data = fs.readFileSync(args.filePath);
      const b64 = data.toString('base64');
      return `data:image/png;base64,${b64}`;
    } catch {
      return null;
    }
  });
}
