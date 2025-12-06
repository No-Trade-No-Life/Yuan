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

/**
 * Parse conventional commit format
 * @param {string} subject - Commit subject line
 * @returns {{type: string, scope: string|null, breaking: boolean}}
 */
const parseConventionalCommit = (subject) => {
  const conventionalRegex = /^(\w+)(\(([^)]+)\))?(!)?:\s*(.+)$/;
  const match = subject.match(conventionalRegex);

  if (!match) {
    return { type: 'other', scope: null, breaking: false };
  }

  return {
    type: match[1], // feat, fix, refactor, etc.
    scope: match[3] || null,
    breaking: match[4] === '!',
  };
};

/**
 * Extract code snippets from patch
 * @param {string} patch - Git patch content
 * @param {string} filePath - File path for context
 * @returns {Array<{type: string, name: string, code: string, lineStart: number, lineEnd: number}>}
 */
const extractCodeSnippets = (patch, filePath) => {
  if (!patch) return [];

  const snippets = [];
  const lines = patch.split('\n');
  let currentSnippet = null;
  let lineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track line numbers from hunk headers
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      lineNum = parseInt(hunkMatch[1], 10);
      continue;
    }

    // Skip diff headers
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('---') ||
      line.startsWith('+++')
    ) {
      continue;
    }

    // Look for function/class definitions in added lines
    if (line.startsWith('+')) {
      const content = line.substring(1);

      // Match function definitions
      const funcMatch = content.match(/(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+(\w+)/);
      // Match class definitions
      const classMatch = content.match(/(?:export\s+)?class\s+(\w+)/);
      // Match interface definitions (TypeScript)
      const interfaceMatch = content.match(/(?:export\s+)?interface\s+(\w+)/);

      if (funcMatch || classMatch || interfaceMatch) {
        if (currentSnippet && currentSnippet.lines.length > 0) {
          // Save previous snippet if exists
          // Dedent the code by removing common leading whitespace
          const dedentedCode = dedentCode(currentSnippet.lines);
          snippets.push({
            type: currentSnippet.type,
            name: currentSnippet.name,
            code: dedentedCode,
            lineStart: currentSnippet.lineStart,
            lineEnd: lineNum - 1,
          });
        }

        // Start new snippet
        currentSnippet = {
          type: funcMatch ? 'function' : classMatch ? 'class' : 'interface',
          name: (funcMatch || classMatch || interfaceMatch)[1],
          lines: [content],
          lineStart: lineNum,
        };
      } else if (currentSnippet && currentSnippet.lines.length < 15) {
        // Continue collecting lines for current snippet (max 15 lines)
        currentSnippet.lines.push(content);
      }

      lineNum++;
    } else if (!line.startsWith('-')) {
      lineNum++;
    }
  }

  // Save last snippet
  if (currentSnippet && currentSnippet.lines.length > 0) {
    const dedentedCode = dedentCode(currentSnippet.lines);
    snippets.push({
      type: currentSnippet.type,
      name: currentSnippet.name,
      code: dedentedCode,
      lineStart: currentSnippet.lineStart,
      lineEnd: lineNum - 1,
    });
  }

  return snippets;
};

/**
 * Remove common leading whitespace from code lines
 * @param {string[]} lines - Array of code lines
 * @returns {string} - Dedented code
 */
const dedentCode = (lines) => {
  if (lines.length === 0) return '';

  // Find minimum indentation (excluding empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue; // Skip empty lines
    const indent = line.match(/^\s*/)[0].length;
    minIndent = Math.min(minIndent, indent);
  }

  // If all lines are empty or no indentation found, return as-is
  if (minIndent === Infinity || minIndent === 0) {
    return lines.join('\n');
  }

  // Remove common indentation
  const dedented = lines.map((line) => {
    if (line.trim().length === 0) return ''; // Keep empty lines empty
    return line.substring(minIndent);
  });

  return dedented.join('\n');
};

/**
 * Determine change type from numstat
 * @param {number|null} additions
 * @param {number|null} deletions
 * @returns {string}
 */
const getChangeType = (additions, deletions) => {
  if (additions === null || deletions === null) return 'binary';
  if (additions > 0 && deletions === 0) return 'added';
  if (additions === 0 && deletions > 0) return 'deleted';
  if (additions > 0 && deletions > 0) return 'modified';
  return 'renamed';
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

        // Extract code snippets from patch
        const codeSnippets = extractCodeSnippets(patch, stat.path);

        // Determine change type
        const changeType = getChangeType(stat.additions, stat.deletions);

        files.push({
          ...stat,
          changeType,
          patch,
          codeSnippets,
        });
      } catch (error) {
        // If patch extraction fails, include file without patch
        console.warn(`Warning: Could not extract patch for ${stat.path} in commit ${short}`);
        files.push({
          ...stat,
          changeType: 'unknown',
          patch: null,
          codeSnippets: [],
        });
      }
    }

    // Parse conventional commit
    const conventionalCommit = parseConventionalCommit(subject);

    commits.push({
      hash,
      short,
      author,
      email,
      authoredAt,
      subject,
      conventionalCommit,
      files,
    });
  }

  return commits;
};

/**
 * Analyze commits to identify technical domains
 * @param {Array} commits - Array of commit objects
 * @returns {Array<{name: string, commits: string[], files: string[]}>}
 */
const analyzeDomains = (commits) => {
  const domainMap = new Map();

  // Domain patterns based on file paths and commit types
  const patterns = {
    API请求优化与限速: {
      paths: /src\/(public-data|api|services).*\/(quote|request|client)\.ts/,
      types: ['feat', 'perf'],
    },
    错误处理与观测: { paths: /error|log|monitor|metric|observe/, types: ['fix', 'refactor'] },
    安全与鉴权: { paths: /auth|credential|sign|security|token/, types: ['feat', 'fix'] },
    订单与交易: { paths: /order|trade|submit|cancel|modify/, types: ['feat', 'fix'] },
    账户管理: { paths: /account|balance|position|margin/, types: ['feat', 'fix'] },
    市场数据: { paths: /quote|price|ohlc|ticker|depth/, types: ['feat', 'fix'] },
    接口重构: { paths: /api|interface|types/, types: ['refactor'] },
    配置与环境: { paths: /config|env|\.json|\.yaml/, types: ['chore', 'feat'] },
    测试: { paths: /test|spec|__tests__/, types: ['test'] },
    文档: { paths: /README|CHANGELOG|\.md/, types: ['docs'] },
  };

  for (const commit of commits) {
    for (const [domainName, pattern] of Object.entries(patterns)) {
      const matchesPath = commit.files.some((file) => pattern.paths.test(file.path));
      const matchesType = pattern.types.includes(commit.conventionalCommit.type);

      if (matchesPath || matchesType) {
        if (!domainMap.has(domainName)) {
          domainMap.set(domainName, { commits: new Set(), files: new Set() });
        }
        domainMap.get(domainName).commits.add(commit.short);
        commit.files.forEach((file) => domainMap.get(domainName).files.add(file.path));
      }
    }
  }

  return Array.from(domainMap.entries()).map(([name, data]) => ({
    name,
    commits: Array.from(data.commits),
    files: Array.from(data.files).slice(0, 10), // Limit to 10 files per domain
  }));
};

/**
 * Identify risk indicators from commits
 * @param {Array} commits - Array of commit objects
 * @returns {Array<{type: string, severity: string, details: string, commits: string[]}>}
 */
const identifyRisks = (commits) => {
  const risks = [];

  // Check for breaking changes
  const breakingCommits = commits.filter((c) => c.conventionalCommit.breaking);
  if (breakingCommits.length > 0) {
    risks.push({
      type: 'breaking_change',
      severity: 'high',
      details: `${breakingCommits.length} 个提交标记为破坏性变更`,
      commits: breakingCommits.map((c) => c.short),
    });
  }

  // Check for large refactoring
  const largeRefactors = commits.filter(
    (c) => c.conventionalCommit.type === 'refactor' && c.files.some((f) => f.deletions > 100),
  );
  if (largeRefactors.length > 0) {
    risks.push({
      type: 'large_refactor',
      severity: 'medium',
      details: `${largeRefactors.length} 个大规模重构提交（删除超过100行）`,
      commits: largeRefactors.map((c) => c.short),
    });
  }

  // Check for missing tests
  const hasTestFiles = commits.some((c) => c.files.some((f) => /test|spec|__tests__/.test(f.path)));
  const hasFeatOrFix = commits.some((c) => ['feat', 'fix'].includes(c.conventionalCommit.type));
  if (hasFeatOrFix && !hasTestFiles) {
    risks.push({
      type: 'no_tests',
      severity: 'medium',
      details: '包含功能或修复提交但未见测试文件更新',
      commits: [],
    });
  }

  // Check for API/interface changes
  const apiChanges = commits.filter((c) =>
    c.files.some((f) => /api|interface|types/.test(f.path) && f.changeType !== 'added'),
  );
  if (apiChanges.length > 0) {
    risks.push({
      type: 'api_change',
      severity: 'high',
      details: `${apiChanges.length} 个提交修改了API或接口定义`,
      commits: apiChanges.map((c) => c.short),
    });
  }

  return risks;
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

  // Perform global analysis
  console.info('Analyzing technical domains...');
  const domains = analyzeDomains(commits);

  console.info('Identifying risk indicators...');
  const riskIndicators = identifyRisks(commits);

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
    analysis: {
      domains,
      riskIndicators,
    },
    metadata: {
      tool: 'git-changes-reporter',
      version: '2.0.0',
      repository: repoRoot,
    },
  };

  // Write output
  await writeFile(output, JSON.stringify(outputData, null, 2));
  console.info(`✅ JSON data written to ${output}`);
  console.info(
    `📊 Summary: ${commitCount} commits, ${contributors.length} contributors, ${topDirs.length} directories changed`,
  );
  console.info(
    `🔍 Analysis: ${domains.length} domains identified, ${riskIndicators.length} risk indicators found`,
  );
};

main().catch((err) => {
  console.error('❌ Error:', err?.stack || err?.message || err);
  process.exit(1);
});
