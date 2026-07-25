import React, { useEffect, useMemo, useState } from 'react';
import type { PostWithRepo, PostStatus } from '@devlog/core';
import { api } from '../lib/api';

const STATUS_FILTERS: Array<PostStatus | 'all'> = ['all', 'pending', 'approved', 'rejected', 'posted', 'failed'];

const STATUS_COLORS: Record<PostStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-700',
  posted: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-700',
};

export default function History({ refreshKey }: { refreshKey: number }): JSX.Element {
  const [posts, setPosts] = useState<PostWithRepo[]>([]);
  const [filter, setFilter] = useState<PostStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.posts.listAll().then((data) => {
      setPosts(data);
      setLoading(false);
    });
  }, [refreshKey]);

  const filtered = useMemo(
    () => (filter === 'all' ? posts : posts.filter((p) => p.status === filter)),
    [posts, filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filter === s ? 'bg-bottle text-cream' : 'text-bottle/60 hover:bg-bottle/10'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-bottle/60">Loading history…</p>
      ) : !filtered.length ? (
        <p className="text-sm text-bottle/60">No posts match this filter.</p>
      ) : (
        <div className="divide-y divide-bottle/10 rounded-lg border border-bottle/10 bg-white">
          {filtered.map((post) => (
            <div key={post.id} className="px-4 py-3">
              <div className="mb-1 flex items-center justify-between text-xs text-bottle/50">
                <span>
                  {post.repo_display_name} · {post.platform}
                </span>
                <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[post.status]}`}>
                  {post.status}
                </span>
              </div>
              <p className="line-clamp-2 text-sm">{post.edited_content || post.content}</p>
              <p className="mt-1 text-xs text-bottle/40">
                {new Date(post.created_at).toLocaleString()}
                {post.posted_at ? ` · posted ${new Date(post.posted_at).toLocaleString()}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
