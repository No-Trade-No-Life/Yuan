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
      'Usage: generate-json.js <old_commit> <new_commit> [output_path]',
      '',
      'Generate structured JSON for commits in range <old_commit>..<new_commit>',
      'including per-file stats and patch text.',
      '',
      'Arguments:',
      '  <old_commit>    Start commit reference (hash, tag, branch)',
      '  <new_commit>    End commit reference',
      '  [output_path]   Optional output path (default: docs/reports/git-changes-YYYY-MM-DD.json)',
      '',
      'Examples:',
      '  generate-json.js HEAD~10 HEAD',
      '  generate-json.js v1.0.0 HEAD ./reports/changes.json',
      '  generate-json.js 6df6ea741 1b4e97ac5',
    ].join('\n'),
  );
};

const validateGitRepo = async () => {
  try {
    const { stdout } = await exec('git', ['rev-parse', '--is-inside-work-tree']);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
};

const getRepoRoot = async () => {
  const { stdout } = await exec('git', ['rev-parse', '--show-toplevel']);
  return stdout.trim();
};

const getCommitInfo = async (ref) => {
  try {
    const hash = (await exec('git', ['rev-parse', ref])).stdout.trim();
    const short = (await exec('git', ['rev-parse', '--short', ref])).stdout.trim();
    return { hash, short };
  } catch (error) {
    throw new Error(`Invalid commit reference: ${ref}\n${error.message}`);
  }
};

const getDateRange = async (oldRef, newRef) => {
  const startDate =
    (await exec('git', ['log', '--reverse', '--date=short', '--format=%ad', `${oldRef}..${newRef}`])).stdout
      .split('\n')
      .filter(Boolean)[0] || null;
  const endDate =
    (
      await exec('git', ['log', '-1', '--date=short', '--format=%ad', `${oldRef}..${newRef}`])
    ).stdout.trim() || null;
  return { startDate, endDate };
};

const getCommitCount = async (oldRef, newRef) => {
  const count = Number(
    (await exec('git', ['rev-list', '--count', `${oldRef}..${newRef}`])).stdout.trim() || '0',
  );
  return count;
};

const getContributors = async (oldRef, newRef) => {
  const authorLines = (await exec('git', ['log', `${oldRef}..${newRef}`, '--format=%an|%ae'])).stdout
    .split('\n')
    .filter(Boolean);
  const contributorMap = new Map();
  for (const line of authorLines) {
    const [name, email] = line.split('|');
    const key = `${name}|${email}`;
    contributorMap.set(key, (contributorMap.get(key) || 0) + 1);
  }
  return Array.from(contributorMap.entries()).map(([key, commits]) => {
    const [name, email] = key.split('|');
    return { name, email, commits };
  });
};

const getTopDirectories = async (oldRef, newRef) => {
  const files = (await exec('git', ['diff', '--name-only', `${oldRef}..${newRef}`])).stdout
    .split('\n')
    .filter(Boolean);

  const dirCounts = files.reduce((acc, filePath) => {
    const dir = filePath.split('/')[0] || '.';
    acc.set(dir, (acc.get(dir) || 0) + 1);
    return acc;
  }, new Map());

  return Array.from(dirCounts.entries())
    .map(([dir, fileCount]) => ({ dir, fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount);
};

const getCommitDetails = async (oldRef, newRef) => {
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

    // Get file statistics for this commit
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

      try {
        const patch = (
          await exec('git', ['show', '--unified=0', '--no-color', `${hash}^!`, '--', stat.path], {
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large patches
          })
        ).stdout;
        files.push({ ...stat, patch });
      } catch (error) {
        // If patch extraction fails, include file without patch
        console.warn(`Warning: Could not extract patch for ${stat.path} in commit ${short}`);
        files.push({ ...stat, patch: null });
      }
    }

    commits.push({ hash, short, author, email, authoredAt, subject, files });
  }

  return commits;
};

const main = async () => {
  const [oldRef, newRef, outputArg] = process.argv.slice(2);

  // Validate arguments
  if (!oldRef || !newRef) {
    usage();
    process.exit(1);
  }

  // Validate git repository
  if (!(await validateGitRepo())) {
    console.error('Error: Not inside a git repository');
    process.exit(1);
  }

  // Change to repository root
  const repoRoot = await getRepoRoot();
  process.chdir(repoRoot);
  console.info(`Working in repository: ${repoRoot}`);

  // Get commit information
  console.info('Validating commit references...');
  const oldInfo = await getCommitInfo(oldRef);
  const newInfo = await getCommitInfo(newRef);

  // Determine output path
  const today = new Date().toISOString().slice(0, 10);
  const output = outputArg || `docs/reports/git-changes-${today}.json`;

  // Create output directory if needed
  await mkdir(dirname(output), { recursive: true });

  // Get date range and commit count
  console.info('Analyzing commit range...');
  const { startDate, endDate } = await getDateRange(oldRef, newRef);
  const commitCount = await getCommitCount(oldRef, newRef);

  if (!startDate || !endDate || commitCount === 0) {
    console.error(`Error: No commits found in range ${oldInfo.short}..${newInfo.short}`);
    process.exit(1);
  }

  console.info(`Found ${commitCount} commits from ${startDate} to ${endDate}`);

  // Collect data
  console.info('Collecting contributor information...');
  const contributors = await getContributors(oldRef, newRef);

  console.info('Analyzing file changes...');
  const topDirs = await getTopDirectories(oldRef, newRef);

  console.info('Extracting commit details...');
  const commits = await getCommitDetails(oldRef, newRef);

  // Prepare output data
  const outputData = {
    range: {
      old: oldRef,
      new: newRef,
      label: `${oldInfo.short}..${newInfo.short}`,
      startDate,
      endDate,
      commitCount,
      generatedAt: new Date().toISOString(),
    },
    contributors,
    topDirs,
    commits,
    metadata: {
      tool: 'git-changes-reporter',
      version: '1.0.0',
      repository: repoRoot,
    },
  };

  // Write output
  await writeFile(output, JSON.stringify(outputData, null, 2));
  console.info(`✅ JSON data written to ${output}`);
  console.info(
    `📊 Summary: ${commitCount} commits, ${contributors.length} contributors, ${topDirs.length} directories changed`,
  );
};

main().catch((err) => {
  console.error('❌ Error:', err?.stack || err?.message || err);
  process.exit(1);
});
