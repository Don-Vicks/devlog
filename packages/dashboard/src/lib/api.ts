import type { Repo, Post, PostWithRepo, RepoConfig, Account } from '@devlog/core';

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
    list: () => Promise<string[]>;
    read: (profile?: string) => Promise<string>;
    write: (content: string, profile?: string) => Promise<boolean>;
    create: (name: string, template?: string) => Promise<string>;
    delete: (name: string) => Promise<boolean>;
  };
  accounts: {
    list: () => Promise<Account[]>;
    envStatus: () => Promise<{ x: { configured: boolean }; linkedin: { configured: boolean } }>;
    connect: (platform: string) => Promise<Account>;
    disconnect: (platform: string, handle: string) => Promise<boolean>;
  };
  media: {
    readImage: (filePath: string) => Promise<string | null>;
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
    voice: {
      list: async () => [],
      read: async () => '',
      write: notConnected as never,
      create: notConnected as never,
      delete: notConnected as never,
    },
    accounts: {
      list: async () => [],
      envStatus: async () => ({ x: { configured: false }, linkedin: { configured: false } }),
      connect: notConnected as never,
      disconnect: notConnected as never,
    },
    media: {
      readImage: async () => null,
    },
    onDbChanged: () => () => {},
  };
}

export const api = getApi();
