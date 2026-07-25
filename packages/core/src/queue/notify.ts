import fetch from 'node-fetch';
import { Post, Repo } from '../types';

/**
 * Sends generated drafts to Telegram for one-tap review.
 * Falls back to console logging if Telegram isn't configured.
 */
export async function notifyQueue(posts: Post[], repo: Repo): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log(`\n[devlog] ${posts.length} draft(s) generated for ${repo.display_name}. Run "devlog queue" to review.\n`);
    return;
  }

  for (const post of posts) {
    const text = `🛠 New draft for *${repo.display_name}* (${post.platform})\n\n${post.content}\n\nReply /approve_${post.id} or /reject_${post.id}`;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
      });
    } catch (err) {
      console.warn('[devlog] Telegram notify failed:', (err as Error).message);
    }
  }
}
