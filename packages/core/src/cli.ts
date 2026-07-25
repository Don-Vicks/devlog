#!/usr/bin/env node
import 'dotenv/config';
import path from 'path';
import { Command } from 'commander';
import { installHook } from './hooks/install';
import { processCommit } from './pipeline';
import { getDb, listPending, setPostStatus, listRepos } from './db';

const program = new Command();
program.name('devlog').description('Automated build-in-public tool');

program
  .command('install <repoPath>')
  .description('Install the post-commit hook in a repo')
  .action((repoPath: string) => {
    const cliPath = path.resolve(__dirname, 'cli.js');
    const hookPath = installHook(path.resolve(repoPath), cliPath);
    console.log(`[devlog] Hook installed at ${hookPath}`);
    console.log(`[devlog] Add a .devlog.yml in ${repoPath} to configure project_name, visibility, etc.`);
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
  .action((postId: string, opts: { edit?: string }) => {
    const db = getDb();
    const post = setPostStatus(db, Number(postId), 'approved', opts.edit ?? null);
    console.log(`[devlog] Post #${post.id} approved.`);
    console.log(`\n${post.edited_content || post.content}\n`);
    console.log('[devlog] Copy the above and post manually, or enable auto-posting once accounts are connected.');
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
  .command('repos')
  .description('List watched repos')
  .action(() => {
    const db = getDb();
    listRepos(db).forEach((r) => {
      console.log(`${r.display_name}  [${r.visibility}]  ${r.path}`);
    });
  });

program.parse(process.argv);
