import fetch from 'node-fetch';
import { getDb, listPending, setPostStatus, PostWithRepo } from '../db';
import { approveAndMaybePublish } from '../publish/publish';
import { Post } from '../types';

const API_BASE = 'https://api.telegram.org/bot';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
}

interface TelegramMessage {
  chat_id: number;
  text: string;
  parse_mode?: string;
}

async function sendMessage(token: string, msg: TelegramMessage): Promise<void> {
  await fetch(`${API_BASE}${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
}

async function getUpdates(token: string, offset: number): Promise<TelegramUpdate[]> {
  const res = await fetch(`${API_BASE}${token}/getUpdates?offset=${offset}&timeout=30`);
  if (!res.ok) throw new Error(`Telegram getUpdates failed: ${res.status}`);
  const data = (await res.json()) as { ok: boolean; result: TelegramUpdate[] };
  return data.ok ? data.result : [];
}

function formatPost(post: PostWithRepo): string {
  return `#${post.id} [${post.platform}] for ${post.repo_display_name}\n\n${post.content}`;
}

function pendingListMessage(posts: PostWithRepo[]): string {
  if (posts.length === 0) return 'No pending drafts.';
  const lines = posts.map((p) => `/approve_${p.id} — ${p.repo_display_name} (${p.platform})\n> ${p.content.slice(0, 120)}${p.content.length > 120 ? '...' : ''}`);
  return `*Pending drafts (${posts.length}):*\n\n${lines.join('\n\n')}`;
}

async function handleMessage(token: string, chatId: number, text: string): Promise<void> {
  const db = getDb();

  if (text === '/start' || text === '/help') {
    await sendMessage(token, {
      chat_id: chatId,
      parse_mode: 'Markdown',
      text: [
        '*devlog bot*',
        '',
        'Manage your draft queue from Telegram.',
        '',
        '`/queue` — list pending drafts',
        '`/approve_<id>` — approve and auto-post',
        '`/reject_<id>` — reject a draft',
        '`/view_<id>` — view full draft content',
        '',
        'Or use the CLI: `devlog queue`, `devlog approve 3`',
      ].join('\n'),
    });
    db.close();
    return;
  }

  if (text === '/queue') {
    const pending = listPending(db);
    // Enrich with repo display names
    const enriched = pending.map((post) => {
      const row = db.prepare('SELECT display_name FROM repos WHERE id = ?').get(post.repo_id) as { display_name: string } | undefined;
      return { ...post, repo_display_name: row?.display_name || 'unknown' } as PostWithRepo;
    });
    await sendMessage(token, { chat_id: chatId, parse_mode: 'Markdown', text: pendingListMessage(enriched) });
    db.close();
    return;
  }

  const approveMatch = text.match(/^\/approve_(\d+)$/);
  if (approveMatch) {
    const postId = Number(approveMatch[1]);
    try {
      const post = await approveAndMaybePublish(postId);
      const status = post.status === 'posted' ? 'posted' : post.status === 'failed' ? 'failed (auto-post error)' : 'approved';
      await sendMessage(token, {
        chat_id: chatId,
        text: `Post #${postId} is now ${status}.\n\n${post.edited_content || post.content}`,
      });
    } catch (err) {
      await sendMessage(token, { chat_id: chatId, text: `Failed to approve #${postId}: ${(err as Error).message}` });
    }
    db.close();
    return;
  }

  const rejectMatch = text.match(/^\/reject_(\d+)$/);
  if (rejectMatch) {
    const postId = Number(rejectMatch[1]);
    setPostStatus(db, postId, 'rejected');
    await sendMessage(token, { chat_id: chatId, text: `Post #${postId} rejected.` });
    db.close();
    return;
  }

  const viewMatch = text.match(/^\/view_(\d+)$/);
  if (viewMatch) {
    const postId = Number(viewMatch[1]);
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId) as Post | undefined;
    if (post) {
      const repo = db.prepare('SELECT display_name FROM repos WHERE id = ?').get(post.repo_id) as { display_name: string } | undefined;
      await sendMessage(token, {
        chat_id: chatId,
        parse_mode: 'Markdown',
        text: formatPost({ ...post, repo_display_name: repo?.display_name || 'unknown' }),
      });
    } else {
      await sendMessage(token, { chat_id: chatId, text: `Post #${postId} not found.` });
    }
    db.close();
    return;
  }

  db.close();
  await sendMessage(token, {
    chat_id: chatId,
    text: 'Unknown command. Send /help for available commands.',
  });
}

/**
 * Start the Telegram bot using long-polling.
 * Runs indefinitely until the process is killed.
 */
export async function startBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');
  }
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID is not set in .env');
  }

  console.log('[devlog] Telegram bot starting...');
  console.log(`[devlog] Listening for commands in chat ${chatId}`);

  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = await getUpdates(token, offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message?.text && update.message.chat.id === Number(chatId)) {
          const text = update.message.text;
          const from = update.message.from?.first_name || 'unknown';
          console.log(`[devlog] Telegram message from ${from}: ${text}`);
          await handleMessage(token, Number(chatId), text);
        }
      }
    } catch (err) {
      console.error('[devlog] Bot poll error:', (err as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
