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
  RepoConfig,
} from '@devlog/core';
import path from 'path';

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
      const db = getDb();
      const post = setPostStatus(db, args.id, 'approved', args.editedContent ?? null);
      db.close();
      return post;
    }
  );

  ipcMain.handle('posts:reject', (_event, args: { id: number }) => {
    const db = getDb();
    const post = setPostStatus(db, args.id, 'rejected');
    db.close();
    return post;
  });

  ipcMain.handle('voice:read', () => readVoiceRules());

  ipcMain.handle('voice:write', (_event, args: { content: string }) => {
    writeVoiceRules(args.content);
    return true;
  });
}
