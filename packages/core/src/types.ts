export type Visibility = 'public' | 'private' | 'client';
export type Platform = 'x' | 'linkedin' | 'facebook' | 'instagram';
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'posted' | 'failed';
export type PostMode = 'single' | 'thread';

export interface RepoConfig {
  project_name: string | null;
  visibility: Visibility;
  project_tag: string | null;
  voice_profile: string;
  platforms: Platform[];
}

export interface Repo {
  id: number;
  path: string;
  display_name: string;
  visibility: Visibility;
  project_tag: string | null;
  voice_profile: string;
  platforms: string; // JSON-encoded Platform[] as stored in SQLite
  created_at: string;
}

export interface Post {
  id: number;
  repo_id: number;
  source_commit: string | null;
  platform: Platform;
  content: string;
  thread_parts: string | null; // JSON-encoded string[]
  media_path: string | null;
  status: PostStatus;
  edited_content: string | null;
  created_at: string;
  posted_at: string | null;
}

export interface VoiceExample {
  id: number;
  post_id: number;
  original_content: string;
  edited_content: string;
  created_at: string;
}

export interface Engagement {
  id: number;
  post_id: number;
  likes: number;
  replies: number;
  impressions: number;
  pulled_at: string;
}

export interface Account {
  id: number;
  platform: Platform;
  handle: string;
  status: 'connected' | 'expired' | 'error';
  token_ref: string;
  refresh_token_ref: string | null;
  expiry_at: string | null;
  last_posted_at: string | null;
  created_at?: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  filesChanged: string[];
}

export interface CommitPayload extends CommitInfo {
  diff: string | null;
  manualSummary: string | null;
}

export interface RedactionResult {
  clean: string;
  redactedCount: number;
  patternsHit: string[];
}

export interface ResolvedName {
  name: string;
  source: 'config' | 'package_json' | 'readme' | 'git_remote' | 'folder';
}

export interface GeneratePostArgs {
  visibility: Visibility;
  projectName: string;
  projectTag: string | null;
  commitMessage: string;
  diff: string | null;
  manualSummary: string | null;
  mode: PostMode;
  voiceProfile?: string;
  voiceExamples: VoiceExample[];
  engagementNotes?: string;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}
