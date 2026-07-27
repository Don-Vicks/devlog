import React, { useEffect, useState } from 'react';
import type { Account, Platform } from '@devlog/core';
import { api } from '../lib/api';

interface PlatformDef {
  id: Platform;
  label: string;
  envKey: string;
  setupUrl: string;
  setupSteps: string[];
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'x',
    label: 'X (Twitter)',
    envKey: 'X_CLIENT_ID',
    setupUrl: 'https://developer.x.com/en/portal/dashboard',
    setupSteps: [
      'Go to the X Developer Portal and create a project + app.',
      'Under "User authentication settings", enable OAuth 2.0 with PKCE.',
      'Set the callback URL to http://127.0.0.1:4321/callback',
      'Copy your Client ID into .env as X_CLIENT_ID.',
      'Set permissions to "Read and write".',
    ],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    envKey: 'LINKEDIN_CLIENT_ID',
    setupUrl: 'https://www.linkedin.com/developers/apps',
    setupSteps: [
      'Go to the LinkedIn Developer Portal and create an app.',
      'Under "Auth", add the redirect URL: http://127.0.0.1:4321/callback/linkedin',
      'Request the w_member_social and profile scopes.',
      'Copy your Client ID and Client Secret into .env.',
    ],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    envKey: 'META_APP_ID',
    setupUrl: 'https://developers.facebook.com/apps/',
    setupSteps: ['Facebook posting is coming in a future release.'],
  },
  {
    id: 'instagram',
    label: 'Instagram',
    envKey: 'META_APP_ID',
    setupUrl: 'https://developers.facebook.com/apps/',
    setupSteps: ['Instagram posting is coming in a future release.'],
  },
];

export default function Accounts(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envStatus, setEnvStatus] = useState<{ x: { configured: boolean }; linkedin: { configured: boolean } } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busyPlatform, setBusyPlatform] = useState<Platform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSetup, setExpandedSetup] = useState<Platform | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [accts, env] = await Promise.all([api.accounts.list(), api.accounts.envStatus()]);
      setAccounts(accts);
      setEnvStatus(env);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConnect(platform: Platform) {
    setBusyPlatform(platform);
    setError(null);
    try {
      await api.accounts.connect(platform);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyPlatform(null);
    }
  }

  async function handleDisconnect(platform: Platform, handle: string) {
    setBusyPlatform(platform);
    setError(null);
    try {
      await api.accounts.disconnect(platform, handle);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyPlatform(null);
    }
  }

  function isPlatformConfigured(platformId: Platform): boolean {
    if (!envStatus) return false;
    if (platformId === 'x') return envStatus.x.configured;
    if (platformId === 'linkedin') return envStatus.linkedin.configured;
    return false;
  }

  function getConnectedAccounts(platformId: Platform): Account[] {
    return accounts.filter((account) => account.platform === platformId);
  }

  const isSetupAvailable = (id: Platform) => id === 'x' || id === 'linkedin';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-bottle/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Connected Accounts</h2>
        <p className="mt-1 text-xs text-bottle/50">
          Connect your social accounts to auto-post approved drafts. Each platform requires API credentials in the{' '}
          <code className="rounded bg-bottle/5 px-1 py-0.5">.env</code> file at the project root.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {loading && envStatus === null && (
        <p className="text-sm text-bottle/60">Loading account status...</p>
      )}

      <div className="space-y-3">
        {PLATFORMS.map((platform) => {
          const connected = getConnectedAccounts(platform.id);
          const configured = isPlatformConfigured(platform.id);
          const available = isSetupAvailable(platform.id);
          const setupExpanded = expandedSetup === platform.id;

          return (
            <div key={platform.id} className="rounded-lg border border-bottle/10 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{platform.label}</p>
                    {!available ? (
                      <span className="rounded-full border border-dashed border-bottle/20 px-2 py-0.5 text-[10px] text-bottle/40">
                        Coming soon
                      </span>
                    ) : configured ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Configured
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Needs setup
                      </span>
                    )}
                    {connected.length > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-bottle/50">
                    {connected.length > 0
                      ? `Posting as: ${connected.map((a) => `@${a.handle}`).join(', ')}`
                      : available
                        ? configured
                          ? 'Ready to connect — click the button to authorize.'
                          : 'API credentials needed before connecting.'
                        : 'Not yet supported.'}
                  </p>
                </div>

                {available && (
                  <div className="flex items-center gap-2">
                    {connected.length > 0 ? (
                      <button
                        onClick={() => handleDisconnect(platform.id, connected[0].handle)}
                        disabled={busyPlatform === platform.id}
                        className="rounded-md border border-bottle/20 px-3 py-1.5 text-xs font-medium hover:bg-bottle/10 disabled:opacity-50"
                      >
                        {busyPlatform === platform.id ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.id)}
                        disabled={busyPlatform === platform.id || !configured}
                        className="rounded-md bg-bottle px-3 py-1.5 text-xs font-medium text-cream hover:bg-bottle/90 disabled:opacity-40"
                        title={!configured ? `Set ${platform.envKey} in .env first` : ''}
                      >
                        {busyPlatform === platform.id ? 'Connecting...' : 'Connect'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {connected.length > 0 && (
                <div className="mt-3 space-y-2">
                  {connected.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-md bg-bottle/5 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium">@{account.handle}</p>
                        <p className="text-bottle/50">
                          {account.status}
                          {account.expiry_at && ` \u00b7 expires ${new Date(account.expiry_at).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {available && !configured && (
                <div className="mt-3">
                  <button
                    onClick={() => setExpandedSetup(setupExpanded ? null : platform.id)}
                    className="text-xs font-medium text-bottle/60 hover:text-bottle"
                  >
                    {setupExpanded ? 'Hide setup guide' : 'Show setup guide'}
                  </button>

                  {setupExpanded && (
                    <div className="mt-2 rounded-md border border-bottle/10 bg-bottle/5 p-3">
                      <p className="mb-2 text-xs font-medium text-bottle/70">
                        How to get your {platform.label} API credentials:
                      </p>
                      <ol className="space-y-1.5 text-xs text-bottle/60">
                        {platform.setupSteps.map((step, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-medium text-bottle/40">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-2 text-xs text-bottle/50">
                        Then add to your{' '}
                        <code className="rounded bg-bottle/10 px-1 py-0.5">.env</code> file and restart the app.
                      </p>
                      <a
                        href={platform.setupUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-bottle underline hover:text-bottle/70"
                      >
                        Open {platform.label} Developer Portal
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
