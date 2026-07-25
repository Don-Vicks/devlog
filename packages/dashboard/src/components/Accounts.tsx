import React from 'react';

const PLATFORMS = [
  { id: 'x', label: 'X (Twitter)', note: 'Free tier supports posting, has a monthly cap.' },
  { id: 'linkedin', label: 'LinkedIn', note: 'Posting scopes need partner approval — verify current requirements.' },
  { id: 'facebook', label: 'Facebook', note: 'No app review needed for personal/dev-mode use.' },
  { id: 'instagram', label: 'Instagram', note: 'Via Meta Graph API, same app as Facebook.' },
];

export default function Accounts(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        OAuth connection isn't wired up yet — this is the intended layout. Connecting an account here will need each
        platform's developer app credentials and a real OAuth handshake, built as the next phase (see the project
        spec's build order).
      </div>

      <div className="divide-y divide-bottle/10 rounded-lg border border-bottle/10 bg-white">
        {PLATFORMS.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-bottle/50">{p.note}</p>
            </div>
            <button
              disabled
              className="cursor-not-allowed rounded-md border border-bottle/20 px-3 py-1.5 text-xs font-medium text-bottle/40"
              title="Not yet implemented"
            >
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
