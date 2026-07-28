import { contextBridge, ipcRenderer } from 'electron';
import type { Repo, Post, PostWithRepo, RepoConfig, Account } from '@devlog/core';

const devlogAPI = {
  repos: {
    list: (): Promise<Repo[]> => ipcRenderer.invoke('repos:list'),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('repos:pickFolder'),
    add: (repoPath: string, config: Partial<RepoConfig>): Promise<Repo> =>
      ipcRenderer.invoke('repos:add', { repoPath, config }),
  },
  posts: {
    listPending: (): Promise<Post[]> => ipcRenderer.invoke('posts:listPending'),
    listAll: (): Promise<PostWithRepo[]> => ipcRenderer.invoke('posts:listAll'),
    approve: (id: number, editedContent?: string | null): Promise<Post> =>
      ipcRenderer.invoke('posts:approve', { id, editedContent }),
    reject: (id: number): Promise<Post> => ipcRenderer.invoke('posts:reject', { id }),
  },
  voice: {
    list: (): Promise<string[]> => ipcRenderer.invoke('voice:list'),
    read: (profile?: string): Promise<string> => ipcRenderer.invoke('voice:read', { profile }),
    write: (content: string, profile?: string): Promise<boolean> =>
      ipcRenderer.invoke('voice:write', { content, profile }),
    create: (name: string, template?: string): Promise<string> =>
      ipcRenderer.invoke('voice:create', { name, template }),
    delete: (name: string): Promise<boolean> => ipcRenderer.invoke('voice:delete', { name }),
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke('accounts:list'),
    envStatus: (): Promise<{ x: { configured: boolean }; linkedin: { configured: boolean } }> =>
      ipcRenderer.invoke('accounts:envStatus'),
    connect: (platform: string): Promise<Account> => ipcRenderer.invoke('accounts:connect', { platform }),
    disconnect: (platform: string, handle: string): Promise<boolean> =>
      ipcRenderer.invoke('accounts:disconnect', { platform, handle }),
  },
  media: {
    readImage: (filePath: string): Promise<string | null> => ipcRenderer.invoke('media:readImage', { filePath }),
  },
  onDbChanged: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('devlog:db-changed', listener);
    return () => ipcRenderer.removeListener('devlog:db-changed', listener);
  },
};

contextBridge.exposeInMainWorld('devlogAPI', devlogAPI);

export type DevlogAPI = typeof devlogAPI;
