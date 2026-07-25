import path from 'path';
import fs from 'fs';
import os from 'os';

export const MEDIA_DIR = path.join(os.homedir(), '.devlog', 'media');

function ensureMediaDir(): void {
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

/**
 * Screenshots a running local dev server using Playwright.
 * Requires the dev server to already be running at `url`.
 * Call only when UI/frontend files changed in the commit.
 */
export async function screenshotDevServer(url: string, filenamePrefix = 'ui'): Promise<string> {
  ensureMediaDir();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    const outPath = path.join(MEDIA_DIR, `${filenamePrefix}-${Date.now()}.png`);
    await page.screenshot({ path: outPath });
    return outPath;
  } finally {
    await browser.close();
  }
}
