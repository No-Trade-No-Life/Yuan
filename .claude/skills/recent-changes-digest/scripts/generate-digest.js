#!/usr/bin/env node
/* eslint-disable no-console */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const usage = () => {
  console.error(
    [
      'Usage: scripts/generate-digest.js <old_commit> <new_commit> [output_path]',
      '',
      'Generate structured JSON for commits in range <old_commit>..<new_commit>',
      'including per-file stats and patch text. Default output: docs/reports/recent-changes-YYYY-MM-DD.json',
      '',
      'Example:',
      '  .claude/skills/recent-changes-digest/scripts/generate-digest.js HEAD~10 HEAD',
    ].join('\n'),
  );
};

const main = async () => {
  const [oldRef, newRef, outputArg] = process.argv.slice(2);
  if (!oldRef || !newRef) {
    usage();
    process.exit(1);
  }

  const repoRoot = (await exec('git', ['rev-parse', '--show-toplevel'])).stdout.trim();
  process.chdir(repoRoot);

  const shortOld = (await exec('git', ['rev-parse', '--short', oldRef])).stdout.trim();
  const shortNew = (await exec('git', ['rev-parse', '--short', newRef])).stdout.trim();
  const today = new Date().toISOString().slice(0, 10);
  const output = outputArg || `docs/reports/recent-changes-${today}.json`;

  await mkdir(dirname(output), { recursive: true });

  const startDate =
    (await exec('git', ['log', '--reverse', '--date=short', '--format=%ad', `${oldRef}..${newRef}`])).stdout
      .split('\n')
      .filter(Boolean)[0] || null;
  const endDate =
    (
      await exec('git', ['log', '-1', '--date=short', '--format=%ad', `${oldRef}..${newRef}`])
    ).stdout.trim() || null;
  const commitCount = Number(
    (await exec('git', ['rev-list', '--count', `${oldRef}..${newRef}`])).stdout.trim() || '0',
  );
  if (!startDate || !endDate || commitCount === 0) {
    throw new Error(`No commits found in range ${shortOld}..${shortNew}`);
  }

  const authorLines = (await exec('git', ['log', `${oldRef}..${newRef}`, '--format=%an|%ae'])).stdout
    .split('\n')
    .filter(Boolean);
  const contributorMap = new Map();
  for (const line of authorLines) {
    const [name, email] = line.split('|');
    const key = `${name}|${email}`;
    contributorMap.set(key, (contributorMap.get(key) || 0) + 1);
  }
  const contributors = Array.from(contributorMap.entries()).map(([key, commits]) => {
    const [name, email] = key.split('|');
    return { name, email, commits };
  });

  const topDirs = (await exec('git', ['diff', '--name-only', `${oldRef}..${newRef}`])).stdout
    .split('\n')
    .filter(Boolean)
    .map((p) => p.split('/')[0] || '.')
    .reduce((acc, dir) => acc.set(dir, (acc.get(dir) || 0) + 1), new Map());
  const topDirList = Array.from(topDirs.entries())
    .map(([dir, fileCount]) => ({ dir, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);

  const rawCommits = (
    await exec('git', [
      'log',
      '--reverse',
      '--date=iso8601',
      '--format=%H|%h|%an|%ae|%ad|%s',
      `${oldRef}..${newRef}`,
    ])
  ).stdout
    .split('\n')
    .filter(Boolean);

  const commits = [];
  for (const line of rawCommits) {
    const [hash, short, author, email, authoredAt, subject] = line.split('|');
    // per-file stats
    const numstat = (await exec('git', ['show', '--numstat', '--format=', hash])).stdout
      .split('\n')
      .filter(Boolean)
      .map((row) => {
        const [add, del, ...rest] = row.split('\t');
        return {
          additions: add === '-' ? null : Number(add),
          deletions: del === '-' ? null : Number(del),
          path: rest.join('\t'),
        };
      });

    const files = [];
    for (const stat of numstat) {
      if (!stat.path) continue;
      const patch = (
        await exec('git', ['show', '--unified=0', '--no-color', `${hash}^!`, '--', stat.path], {
          maxBuffer: 10 * 1024 * 1024,
        })
      ).stdout;
      files.push({ ...stat, patch });
    }

    commits.push({ hash, short, author, email, authoredAt, subject, files });
  }

  const outputData = {
    range: {
      old: oldRef,
      new: newRef,
      label: `${shortOld}..${shortNew}`,
      startDate,
      endDate,
      commitCount,
      generatedAt: new Date().toISOString(),
    },
    contributors,
    topDirs: topDirList,
    commits,
  };

  await writeFile(output, JSON.stringify(outputData, null, 2));
  console.info(`Digest written to ${output}`);
};

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
