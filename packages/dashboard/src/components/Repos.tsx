import React, { useEffect, useState } from 'react';
import type { Repo, Platform, Visibility } from '@devlog/core';
import { api } from '../lib/api';

const ALL_PLATFORMS: Platform[] = ['x', 'linkedin', 'facebook', 'instagram'];

export default function Repos({ refreshKey }: { refreshKey: number }): JSX.Element {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [projectTag, setProjectTag] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['x']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const list = await api.repos.list();
    setRepos(list);
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function handlePickFolder() {
    const folder = await api.repos.pickFolder();
    if (folder) {
      setSelectedPath(folder);
      setProjectName(folder.split('/').pop() || '');
    }
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSave() {
    if (!selectedPath) return;
    setSaving(true);
    setError(null);
    try {
      await api.repos.add(selectedPath, {
        project_name: projectName || null,
        visibility,
        project_tag: projectTag || null,
        platforms,
      });
      setShowAddForm(false);
      setSelectedPath(null);
      setProjectName('');
      setProjectTag('');
      setVisibility('public');
      setPlatforms(['x']);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Watched repos</h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-md bg-bottle px-3 py-1.5 text-xs font-medium text-cream hover:bg-bottle/90"
        >
          {showAddForm ? 'Cancel' : '+ Add repo'}
        </button>
      </div>

      {showAddForm && (
        <div className="space-y-3 rounded-lg border border-bottle/10 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePickFolder}
              className="rounded-md border border-bottle/20 px-3 py-1.5 text-xs font-medium hover:bg-bottle/10"
            >
              Choose folder…
            </button>
            <span className="text-xs text-bottle/60">{selectedPath || 'No folder selected'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-bottle/70">
              Project name
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1 w-full rounded-md border border-bottle/20 p-1.5 text-sm"
              />
            </label>

            <label className="text-xs font-medium text-bottle/70">
              Visibility
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
                className="mt-1 w-full rounded-md border border-bottle/20 p-1.5 text-sm"
              >
                <option value="public">public</option>
                <option value="private">private</option>
                <option value="client">client</option>
              </select>
            </label>

            <label className="col-span-2 text-xs font-medium text-bottle/70">
              Project tag (optional)
              <input
                value={projectTag}
                onChange={(e) => setProjectTag(e.target.value)}
                placeholder="#PadiApp"
                className="mt-1 w-full rounded-md border border-bottle/20 p-1.5 text-sm"
              />
            </label>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-bottle/70">Platforms</p>
            <div className="flex gap-2">
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    platforms.includes(p) ? 'bg-bottle text-cream' : 'border border-bottle/20 text-bottle/70'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-700">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!selectedPath || saving}
            className="rounded-md bg-bottle px-3 py-1.5 text-xs font-medium text-cream hover:bg-bottle/90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save & install hook'}
          </button>
        </div>
      )}

      {!repos.length ? (
        <p className="text-sm text-bottle/60">No repos watched yet. Add one above.</p>
      ) : (
        <div className="divide-y divide-bottle/10 rounded-lg border border-bottle/10 bg-white">
          {repos.map((repo) => (
            <div key={repo.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{repo.display_name}</p>
                <p className="text-xs text-bottle/50">{repo.path}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  repo.visibility === 'public'
                    ? 'bg-green-100 text-green-800'
                    : repo.visibility === 'client'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {repo.visibility}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
