import React, { useEffect, useState } from 'react';
import type { Post } from '@devlog/core';
import { api } from '../lib/api';

function MediaPreview({ mediaPath }: { mediaPath: string | null }): JSX.Element | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaPath) return;
    api.media.readImage(mediaPath).then(setSrc);
  }, [mediaPath]);

  if (!mediaPath || !src) return null;

  return (
    <div className="mt-3">
      <img
        src={src}
        alt="Code snippet"
        className="max-w-full rounded-md border border-bottle/10 shadow-sm cursor-pointer"
        onClick={() => window.open(src, '_blank')}
      />
    </div>
  );
}

export default function Queue({ refreshKey }: { refreshKey: number }): JSX.Element {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftText, setDraftText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const pending = await api.posts.listPending();
      setPosts(pending);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function handleApprove(post: Post, edited?: string) {
    await api.posts.approve(post.id, edited ?? null);
    setEditingId(null);
    load();
  }

  async function handleReject(post: Post) {
    await api.posts.reject(post.id);
    load();
  }

  if (loading) return <p className="text-sm text-bottle/60">Loading queue…</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;

  if (!posts.length) {
    return (
      <div className="rounded-lg border border-bottle/10 bg-white/50 p-8 text-center">
        <p className="text-sm text-bottle/60">No pending drafts. Commit something and check back.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="rounded-lg border border-bottle/10 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs text-bottle/50">
            <span>
              #{post.id} · {post.platform} · repo #{post.repo_id}
            </span>
            <span>{new Date(post.created_at).toLocaleString()}</span>
          </div>

          {editingId === post.id ? (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-bottle/20 p-2 text-sm"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
          )}

          {editingId !== post.id && <MediaPreview mediaPath={post.media_path} />}

          <div className="mt-3 flex gap-2">
            {editingId === post.id ? (
              <>
                <button
                  onClick={() => handleApprove(post, draftText)}
                  className="rounded-md bg-bottle px-3 py-1.5 text-xs font-medium text-cream hover:bg-bottle/90"
                >
                  Save &amp; Approve
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-bottle/70 hover:bg-bottle/10"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleApprove(post)}
                  className="rounded-md bg-bottle px-3 py-1.5 text-xs font-medium text-cream hover:bg-bottle/90"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    setEditingId(post.id);
                    setDraftText(post.content);
                  }}
                  className="rounded-md border border-bottle/20 px-3 py-1.5 text-xs font-medium hover:bg-bottle/10"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleReject(post)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
