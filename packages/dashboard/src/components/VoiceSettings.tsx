import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

export default function VoiceSettings(): JSX.Element {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>('default');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const list = await api.voice.list();
    setProfiles(list);
    return list;
  }, []);

  const loadProfile = useCallback(
    async (name: string) => {
      setLoading(true);
      setError(null);
      try {
        const text = await api.voice.read(name);
        setContent(text);
        setOriginalContent(text);
        setActiveProfile(name);
        setSavedAt(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadProfiles().then((list) => {
      if (list.length > 0) {
        loadProfile(list.includes('default') ? 'default' : list[0]);
      } else {
        setLoading(false);
      }
    });
  }, [loadProfiles, loadProfile]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.voice.write(content, activeProfile);
      setOriginalContent(content);
      setSavedAt(new Date());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const name = await api.voice.create(newName.trim());
      setNewName('');
      await loadProfiles();
      await loadProfile(name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(name: string) {
    if (name === 'default') return;
    if (!confirm(`Delete voice profile "${name}"?`)) return;
    setError(null);
    try {
      await api.voice.delete(name);
      const list = await loadProfiles();
      if (list.length > 0) {
        await loadProfile(list.includes('default') ? 'default' : list[0]);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const dirty = content !== originalContent;

  if (loading && profiles.length === 0) return <p className="text-sm text-bottle/60">Loading voice profiles…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Voice profiles</h2>
        <div className="flex items-center gap-3">
          {savedAt && !dirty && (
            <span className="text-xs text-bottle/50">Saved {savedAt.toLocaleTimeString()}</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-md bg-bottle px-3 py-1.5 text-xs font-medium text-cream hover:bg-bottle/90 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <p className="text-xs text-bottle/50">
        Each profile defines a different writing voice. Assign profiles to repos so different projects post in different
        styles. Changes apply to the next commit's draft immediately.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        {profiles.map((name) => (
          <div key={name} className="flex items-center gap-1">
            <button
              onClick={() => loadProfile(name)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeProfile === name ? 'bg-bottle text-cream' : 'border border-bottle/20 text-bottle/70 hover:bg-bottle/10'
              }`}
            >
              {name}
            </button>
            {name !== 'default' && (
              <button
                onClick={() => handleDelete(name)}
                className="text-[10px] text-red-400 hover:text-red-600"
                title={`Delete "${name}"`}
              >
                ×
              </button>
            )}
          </div>
        ))}

        <div className="flex items-center gap-1 ml-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="new profile name"
            className="rounded-md border border-bottle/20 px-2 py-1 text-xs w-32"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="rounded-md border border-bottle/20 px-2 py-1 text-xs font-medium hover:bg-bottle/10 disabled:opacity-40"
          >
            {creating ? '…' : '+ Add'}
          </button>
        </div>
      </div>

      {profiles.length > 0 ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={24}
          className="w-full rounded-lg border border-bottle/20 bg-white p-4 font-mono text-sm leading-relaxed"
        />
      ) : (
        <p className="text-sm text-bottle/50">No voice profiles found. Create one above to get started.</p>
      )}
    </div>
  );
}
