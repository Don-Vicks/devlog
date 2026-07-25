import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function VoiceSettings(): JSX.Element {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    api.voice.read().then((text) => {
      setContent(text);
      setOriginalContent(text);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    await api.voice.write(content);
    setOriginalContent(content);
    setSavedAt(new Date());
    setSaving(false);
  }

  const dirty = content !== originalContent;

  if (loading) return <p className="text-sm text-bottle/60">Loading voice rules…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Voice rules</h2>
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
        This file is loaded into every generation call. Edit tone, banned phrases, and structure rules here — changes
        apply to the next commit's draft immediately.
      </p>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={24}
        className="w-full rounded-lg border border-bottle/20 bg-white p-4 font-mono text-sm leading-relaxed"
      />
    </div>
  );
}
