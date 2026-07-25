import type { Repo, Post, PostWithRepo, RepoConfig } from '@devlog/core';

export interface DevlogWindowAPI {
  repos: {
    list: () => Promise<Repo[]>;
    pickFolder: () => Promise<string | null>;
    add: (repoPath: string, config: Partial<RepoConfig>) => Promise<Repo>;
  };
  posts: {
    listPending: () => Promise<Post[]>;
    listAll: () => Promise<PostWithRepo[]>;
    approve: (id: number, editedContent?: string | null) => Promise<Post>;
    reject: (id: number) => Promise<Post>;
  };
  voice: {
    read: () => Promise<string>;
    write: (content: string) => Promise<boolean>;
  };
  onDbChanged: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    devlogAPI: DevlogWindowAPI;
  }
}

/**
 * In dev mode (running via `vite` directly in a browser tab, not inside
 * Electron) window.devlogAPI won't exist. This stub prevents a hard crash
 * and makes it obvious in the UI that Electron IPC isn't connected.
 */
function getApi(): DevlogWindowAPI {
  if (typeof window !== 'undefined' && window.devlogAPI) return window.devlogAPI;

  const notConnected = () => {
    throw new Error('devlogAPI not available — run the dashboard inside the Electron shell, not a plain browser tab.');
  };

  return {
    repos: { list: async () => [], pickFolder: async () => null, add: notConnected as never },
    posts: {
      listPending: async () => [],
      listAll: async () => [],
      approve: notConnected as never,
      reject: notConnected as never,
    },
    voice: { read: async () => '', write: notConnected as never },
    onDbChanged: () => () => {},
  };
}

export const api = getApi();
