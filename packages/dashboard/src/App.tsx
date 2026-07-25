import React, { useEffect, useState } from 'react';
import Queue from './components/Queue';
import Repos from './components/Repos';
import History from './components/History';
import VoiceSettings from './components/VoiceSettings';
import Accounts from './components/Accounts';
import { api } from './lib/api';

type Tab = 'queue' | 'repos' | 'history' | 'voice' | 'accounts';

const TABS: { id: Tab; label: string }[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'repos', label: 'Repos' },
  { id: 'history', label: 'History' },
  { id: 'voice', label: 'Voice' },
  { id: 'accounts', label: 'Accounts' },
];

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('queue');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Live-updates: main process pushes this event whenever the SQLite file
    // changes (new draft generated, etc.) so views don't need manual polling.
    const unsubscribe = api.onDbChanged(() => setRefreshKey((k) => k + 1));
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-cream text-bottle">
      <header className="flex items-center justify-between border-b border-bottle/10 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">devlog</h1>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-bottle text-cream' : 'text-bottle/70 hover:bg-bottle/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {tab === 'queue' && <Queue refreshKey={refreshKey} />}
        {tab === 'repos' && <Repos refreshKey={refreshKey} />}
        {tab === 'history' && <History refreshKey={refreshKey} />}
        {tab === 'voice' && <VoiceSettings />}
        {tab === 'accounts' && <Accounts />}
      </main>
    </div>
  );
}
