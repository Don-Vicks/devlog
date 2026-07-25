import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Platform, Post, PostStatus, Repo, Visibility, VoiceExample } from '../types';

const DB_DIR = path.join(os.homedir(), '.devlog');
const DB_PATH = path.join(DB_DIR, 'devlog.sqlite');

export function getDb(): Database.Database {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

export interface UpsertRepoArgs {
  repoPath: string;
  displayName: string;
  visibility: Visibility;
  projectTag: string | null;
  voiceProfile: string;
  platforms: Platform[];
}

export function upsertRepo(db: Database.Database, args: UpsertRepoArgs): Repo {
  const stmt = db.prepare(`
    INSERT INTO repos (path, display_name, visibility, project_tag, voice_profile, platforms)
    VALUES (@repoPath, @displayName, @visibility, @projectTag, @voiceProfile, @platforms)
    ON CONFLICT(path) DO UPDATE SET
      display_name=excluded.display_name,
      visibility=excluded.visibility,
      project_tag=excluded.project_tag,
      voice_profile=excluded.voice_profile,
      platforms=excluded.platforms
  `);
  stmt.run({
    repoPath: args.repoPath,
    displayName: args.displayName,
    visibility: args.visibility,
    projectTag: args.projectTag,
    voiceProfile: args.voiceProfile || 'default',
    platforms: JSON.stringify(args.platforms?.length ? args.platforms : ['x']),
  });
  return db.prepare('SELECT * FROM repos WHERE path = ?').get(args.repoPath) as Repo;
}

export function listRepos(db: Database.Database): Repo[] {
  return db.prepare('SELECT * FROM repos ORDER BY created_at DESC').all() as Repo[];
}

export interface CreatePostArgs {
  repoId: number;
  sourceCommit: string | null;
  platform: Platform;
  content: string;
  threadParts?: string[] | null;
  mediaPath?: string | null;
}

export function createPost(db: Database.Database, args: CreatePostArgs): Post {
  const stmt = db.prepare(`
    INSERT INTO posts (repo_id, source_commit, platform, content, thread_parts, media_path)
    VALUES (@repoId, @sourceCommit, @platform, @content, @threadParts, @mediaPath)
  `);
  const info = stmt.run({
    repoId: args.repoId,
    sourceCommit: args.sourceCommit,
    platform: args.platform,
    content: args.content,
    threadParts: args.threadParts ? JSON.stringify(args.threadParts) : null,
    mediaPath: args.mediaPath ?? null,
  });
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid) as Post;
}

export function listPending(db: Database.Database): Post[] {
  return db.prepare(`SELECT * FROM posts WHERE status = 'pending' ORDER BY created_at ASC`).all() as Post[];
}

export interface PostWithRepo extends Post {
  repo_display_name: string;
}

export function listAllPosts(db: Database.Database, limit = 200): PostWithRepo[] {
  return db
    .prepare(
      `
      SELECT posts.*, repos.display_name AS repo_display_name
      FROM posts
      JOIN repos ON repos.id = posts.repo_id
      ORDER BY posts.created_at DESC
      LIMIT ?
    `
    )
    .all(limit) as PostWithRepo[];
}

export function setPostStatus(
  db: Database.Database,
  id: number,
  status: PostStatus,
  editedContent: string | null = null
): Post {
  db.prepare(
    `
    UPDATE posts SET status = ?, edited_content = COALESCE(?, edited_content),
    posted_at = CASE WHEN ? = 'posted' THEN datetime('now') ELSE posted_at END
    WHERE id = ?
  `
  ).run(status, editedContent, status, id);

  if (editedContent) {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
    if (post && editedContent !== post.content) {
      db.prepare(
        `INSERT INTO voice_examples (post_id, original_content, edited_content) VALUES (?, ?, ?)`
      ).run(id, post.content, editedContent);
    }
  }
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post;
}

export function recentVoiceExamples(db: Database.Database, limit = 5): VoiceExample[] {
  return db.prepare(`SELECT * FROM voice_examples ORDER BY created_at DESC LIMIT ?`).all(limit) as VoiceExample[];
}
