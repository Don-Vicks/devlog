import { contextBridge, ipcRenderer } from 'electron';
import type { Repo, Post, PostWithRepo, RepoConfig } from '@devlog/core';

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
    read: (): Promise<string> => ipcRenderer.invoke('voice:read'),
    write: (content: string): Promise<boolean> => ipcRenderer.invoke('voice:write', { content }),
  },
  onDbChanged: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on('devlog:db-changed', listener);
    return () => ipcRenderer.removeListener('devlog:db-changed', listener);
  },
};

contextBridge.exposeInMainWorld('devlogAPI', devlogAPI);

export type DevlogAPI = typeof devlogAPI;
