#!/usr/bin/env node
import { loadEnv } from './config/loadEnv';
loadEnv();
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { Command } from 'commander';
import { installHook } from './hooks/install';
import { processCommit } from './pipeline';
import { startBot } from './queue/bot';
import { getDb, listPending, listRepos, approveAndMaybePublish, setPostStatus } from './index';

const program = new Command();
program.name('devlog').description('Automated build-in-public tool');

program
  .command('install [repoPath]')
  .description('Install the post-commit hook and configure .devlog.yml in a repo')
  .action(async (repoPath?: string) => {
    const resolvedRepoPath = path.resolve(repoPath || '.');
    const cliPath = path.resolve(__dirname, 'cli.js');
    const hookPath = installHook(resolvedRepoPath, cliPath);
    console.log(`[devlog] Hook installed at ${hookPath}`);

    const configPath = path.join(resolvedRepoPath, '.devlog.yml');
    if (fs.existsSync(configPath)) {
      console.log(`[devlog] .devlog.yml already exists at ${configPath}. Skipping configuration creation.`);
      return;
    }

    const defaultProjectName = path.basename(resolvedRepoPath);
    let projectName = defaultProjectName;
    let visibility = 'public';
    let projectTag = `#${defaultProjectName}`;
    let platforms = ['x', 'linkedin'];

    if (process.stdin.isTTY) {
      console.log('\n--- devlog Repository Setup ---');
      const ask = (query: string, defaultValue: string): Promise<string> => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        return new Promise((resolve) => {
          rl.question(`${query} [${defaultValue}]: `, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue);
          });
        });
      };

      projectName = await ask('Project Name', defaultProjectName);
      
      let vis = '';
      while (vis !== 'public' && vis !== 'private' && vis !== 'client') {
        const input = await ask('Visibility (public | private | client)', 'public');
        vis = input.toLowerCase();
        if (vis !== 'public' && vis !== 'private' && vis !== 'client') {
          console.log('Invalid visibility. Please enter public, private, or client.');
        }
      }
      visibility = vis;

      projectTag = await ask('Project Tag (e.g. #MyProject)', `#${projectName}`);
      if (!projectTag.startsWith('#') && projectTag.length > 0) {
        projectTag = '#' + projectTag;
      }

      const platformsInput = await ask('Platforms to target (comma-separated, options: x, linkedin)', 'x, linkedin');
      platforms = platformsInput
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p === 'x' || p === 'linkedin');
      if (platforms.length === 0) {
        platforms = ['x'];
      }
    } else {
      console.log(`[devlog] Non-interactive environment detected. Creating default .devlog.yml.`);
    }

    const configContent = `# Configuration for devlog
project_name: ${projectName}
visibility: ${visibility}
project_tag: "${projectTag}"
voice_profile: default
platforms:
${platforms.map((p) => `  - ${p}`).join('\n')}
`;

    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`[devlog] Created configuration at ${configPath}`);
  });

program
  .command('process-commit <repoPath>')
  .description('(internal) Run the pipeline for the latest commit — called by the git hook')
  .action(async (repoPath: string) => {
    try {
      const posts = await processCommit(path.resolve(repoPath));
      console.log(`[devlog] Generated ${posts.length} draft(s).`);
    } catch (err) {
      console.error('[devlog] Pipeline failed:', (err as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command('queue')
  .description('List pending drafts awaiting approval')
  .action(() => {
    const db = getDb();
    const pending = listPending(db);
    if (!pending.length) {
      console.log('[devlog] No pending drafts.');
      return;
    }
    pending.forEach((p) => {
      console.log(`\n#${p.id} [${p.platform}] (repo_id ${p.repo_id})\n${p.content}\n`);
    });
  });

program
  .command('approve <postId>')
  .option('-e, --edit <content>', 'Approve with edited content')
  .description('Approve a pending post (copy the output, mark approved)')
  .action(async (postId: string, opts: { edit?: string }) => {
    const post = await approveAndMaybePublish(Number(postId), opts.edit ?? null);
    console.log(`[devlog] Post #${post.id} is now ${post.status}.`);
    console.log(`\n${post.edited_content || post.content}\n`);
  });

program
  .command('reject <postId>')
  .description('Reject a pending post')
  .action((postId: string) => {
    const db = getDb();
    setPostStatus(db, Number(postId), 'rejected');
    console.log(`[devlog] Post #${postId} rejected.`);
  });

program
  .command('bot')
  .description('Start the Telegram bot to review and approve drafts from chat')
  .action(async () => {
    try {
      await startBot();
    } catch (err) {
      console.error('[devlog] Bot failed:', (err as Error).message);
      process.exitCode = 1;
    }
  });

program
  .command('repos')
  .description('List watched repos')
  .action(() => {
    const db = getDb();
    listRepos(db).forEach((r) => {
      console.log(`${r.display_name}  [${r.visibility}]  ${r.path}`);
    });
  });

program
  .command('retry [postId]')
  .description('Reset failed post(s) to pending. Omit postId to retry all failed posts.')
  .action((postId?: string) => {
    const db = getDb();
    const failed = postId
      ? [db.prepare('SELECT * FROM posts WHERE id = ? AND status = ?').get(Number(postId), 'failed')].filter(Boolean)
      : db.prepare("SELECT * FROM posts WHERE status = 'failed'").all();

    if (!failed.length) {
      console.log('[devlog] No failed posts to retry.');
      return;
    }

    const update = db.prepare(
      "UPDATE posts SET status = 'pending', media_path = NULL WHERE id = ?"
    );

    for (const post of failed as Array<{ id: number; platform: string }>) {
      update.run(post.id);
      console.log(`[devlog] Post #${post.id} (${post.platform}) reset to pending.`);
    }
    db.close();
  });

program.parse(process.argv);
