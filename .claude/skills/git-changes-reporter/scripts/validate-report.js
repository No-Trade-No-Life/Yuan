#!/usr/bin/env node
/* eslint-disable no-console */
const { readFile } = require('node:fs/promises');

const usage = () => {
  console.error(
    [
      'Usage: validate-report.js <markdown_file> [options]',
      '',
      'Validate Markdown report quality against skill requirements.',
      '',
      'Based on:',
      '  - references/report-template.md',
      '  - references/bad-examples.md',
      '',
      'Arguments:',
      '  <markdown_file>  Path to Markdown report file',
      '',
      'Options:',
      '  --json <path>      Path to JSON data file (auto-enables strict validation)',
      '  --basic            Disable strict validation (only basic format checks)',
      '  --checklist        Show agent verification checklist after validation',
      '',
      'Strict validation (auto-enabled with --json):',
      '  ✅ Verify commit coverage (100% of JSON commits)',
      '  ✅ Verify file references exist in repository',
      '  ✅ Verify commit hashes exist in repository',
      '',
      'Exit codes:',
      '  0  - Report passes all checks',
      '  1  - Report has issues',
      '',
      'Examples:',
      '  # Basic validation (format checks only)',
      '  validate-report.js docs/reports/git-changes-2025-12-05.md',
      '',
      '  # Strict validation (auto-enabled with --json)',
      '  validate-report.js report.md --json changes.json',
      '',
      '  # With agent checklist',
      '  validate-report.js report.md --json changes.json --checklist',
      '',
      '  # Force basic mode even with JSON',
      '  validate-report.js report.md --json changes.json --basic',
    ].join('\n'),
  );
};

/**
 * Check result structure
 */
class CheckResult {
  constructor() {
    this.passed = [];
    this.failed = [];
    this.warnings = [];
  }

  pass(message) {
    this.passed.push(message);
  }

  fail(message) {
    this.failed.push(message);
  }

  warn(message) {
    this.warnings.push(message);
  }

  hasFailures() {
    return this.failed.length > 0;
  }

  print() {
    if (this.passed.length > 0) {
      console.info('\n✅ Passed checks:');
      this.passed.forEach((msg) => console.info(`   ${msg}`));
    }

    if (this.warnings.length > 0) {
      console.info('\n⚠️  Warnings:');
      this.warnings.forEach((msg) => console.warn(`   ${msg}`));
    }

    if (this.failed.length > 0) {
      console.info('\n❌ Failed checks:');
      this.failed.forEach((msg) => console.error(`   ${msg}`));
    }

    console.info(
      `\n📊 Summary: ${this.passed.length} passed, ${this.warnings.length} warnings, ${this.failed.length} failed`,
    );
  }
}

/**
 * Check for required sections
 * Based on report-template.md structure
 */
const checkRequiredSections = (content, result) => {
  const requiredSections = [
    { pattern: /^## 1\. 概览/m, name: '概览' },
    { pattern: /^## 2\. (核心变更|改动聚焦领域)/m, name: '核心变更/改动聚焦领域' },
    { pattern: /^## 3\. (贡献者|贡献者分析)/m, name: '贡献者分析' },
    { pattern: /^## 4\. (风险评估|技术影响与风险)/m, name: '风险评估' },
  ];

  requiredSections.forEach((section) => {
    if (section.pattern.test(content)) {
      result.pass(`包含"${section.name}"章节`);
    } else {
      result.fail(`缺少"${section.name}"章节`);
    }
  });

  // Optional section: 单提交摘要
  if (/^## 5\. 单提交摘要/m.test(content)) {
    result.pass('包含"单提交摘要"章节（可选）');
  }
};

/**
 * Check overview section content
 */
const checkOverview = (content, result) => {
  const overviewSection = content.match(/## 1\. 概览\n\n([\s\S]*?)(?=\n## |$)/);

  if (!overviewSection) {
    return;
  }

  const section = overviewSection[1];

  // Check for key overview fields based on template
  const checks = [
    { pattern: /时间范围/, name: '时间范围' },
    { pattern: /提交数量/, name: '提交数量' },
    { pattern: /(主要)?贡献者/, name: '贡献者' },
    { pattern: /热点目录/, name: '热点目录' },
  ];

  const missing = checks.filter((c) => !c.pattern.test(section));

  if (missing.length === 0) {
    result.pass('概览包含所有必需字段（时间范围、提交数量、贡献者、热点目录）');
  } else {
    missing.forEach((c) => result.warn(`概览缺少"${c.name}"`));
  }
};

/**
 * Check for code snippets in domain/change sections
 * Bad example: 只说"新增函数"没有代码
 */
const checkCodeSnippets = (content, result) => {
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const domainSections = content.match(/### 2\.\d+ .+?\n\n([\s\S]*?)(?=\n### 2\.\d|\n## |$)/g) || [];

  if (codeBlocks.length > 0) {
    result.pass(`包含 ${codeBlocks.length} 个代码片段`);

    // Check if code blocks have language annotation
    const annotatedBlocks = codeBlocks.filter((block) => /^```\w+/m.test(block));
    if (annotatedBlocks.length === codeBlocks.length) {
      result.pass('所有代码片段都有语言标注');
    } else {
      result.warn(
        `${codeBlocks.length - annotatedBlocks.length} 个代码片段缺少语言标注（应使用 \`\`\`typescript 等）`,
      );
    }
  } else {
    result.fail('未找到代码片段 - 每个技术领域应包含 5-15 行核心代码');
  }

  // Check if each domain section has at least one code snippet or file reference
  let missingSnippets = 0;
  domainSections.forEach((section, index) => {
    const hasCodeBlock = /```[\s\S]*?```/.test(section);
    const hasFileReference = /\[.*?:L\d+.*?\]\(.*?#L\d+.*?\)/.test(section);

    if (!hasCodeBlock && !hasFileReference) {
      missingSnippets++;
      result.fail(`领域 2.${index + 1} 缺少代码片段或文件引用`);
    }
  });

  if (missingSnippets === 0 && domainSections.length > 0) {
    result.pass(`所有 ${domainSections.length} 个领域都有代码片段或文件引用`);
  }
};

/**
 * Check for TODO markers - report should not contain any
 */
const checkTodoMarkers = (content, result) => {
  const todos = content.match(/<!-- TODO.*?-->/g) || [];

  if (todos.length === 0) {
    result.pass('无未完成的 TODO 标记');
  } else {
    result.fail(`发现 ${todos.length} 个未完成的 TODO 标记`);
    todos.slice(0, 3).forEach((todo) => {
      result.fail(`  ${todo.substring(0, 60)}...`);
    });
    if (todos.length > 3) {
      result.fail(`  ...以及 ${todos.length - 3} 个其他 TODO`);
    }
  }
};

/**
 * Check for file references with line numbers
 * Bad example: 只说 `quote.ts` 没有行号
 * Good example: [quote.ts:L65-L78](apps/.../quote.ts#L65-L78)
 */
const checkFileReferences = (content, result) => {
  // Correct format: [name:L1-L10](path#L1-L10)
  const correctRefs = content.match(/\[[^\]]*:L\d+[^\]]*\]\([^)]+#L\d+[^)]*\)/g) || [];

  // Incorrect format: just path without line numbers in markdown link
  const incorrectRefs = content.match(/\[[^\]]+\.ts\]\([^)]+\)/g) || [];
  const incorrectWithoutLines = incorrectRefs.filter((ref) => !/#L\d+/.test(ref));

  if (correctRefs.length > 0) {
    result.pass(`包含 ${correctRefs.length} 个正确格式的文件引用（含行号链接）`);
  } else {
    result.warn('未找到带行号的文件引用 - 应使用 [file:L1-L10](path#L1-L10) 格式');
  }

  if (incorrectWithoutLines.length > 0) {
    result.warn(`发现 ${incorrectWithoutLines.length} 个缺少行号的文件引用 - 应添加行号如 #L42-L58`);
  }
};

/**
 * Check commit hash format
 * Bad example: `1279`, `703` (JSON line numbers)
 * Good example: `b285cde59` (7+ hex chars)
 */
const checkCommitHashFormat = (content, result) => {
  // Look for potential line numbers used as commit IDs (common mistake)
  // Pattern: backtick + 3-4 digits + backtick, not part of a larger number
  const lineNumbers = content.match(/`\d{3,4}`(?!\d)/g) || [];

  if (lineNumbers.length > 0) {
    result.fail(
      `❌ 发现可疑的数字引用 ${lineNumbers.slice(0, 5).join(', ')} - 可能错误使用了 JSON 行号作为 commit ID`,
    );
    result.fail('  正确的 commit ID 应该是 7+ 位十六进制字符，如 `b285cde59`');
    result.fail('');
    result.fail('💡 如何修复：');
    result.fail('  1. 在 JSON 文件中搜索对应行号的内容');
    result.fail('  2. 找到该 commit 的 "short" 字段（如 "b285cde59"）');
    result.fail('  3. 将报告中的行号替换为正确的 commit hash');
    result.fail('');
    result.fail('📝 验证命令示例：');
    result.fail('  # 在 JSON 中查找某个 commit');
    result.fail('  jq \'.commits[] | select(.short == "b285cde59")\' changes.json');
    result.fail('  # 列出所有 commit hash');
    result.fail("  jq '.commits[] | .short' changes.json");
  }

  // Check for proper commit hash format (7+ hex characters)
  const commitHashes = content.match(/`[0-9a-f]{7,}`/g) || [];

  if (commitHashes.length > 0) {
    result.pass(`包含 ${commitHashes.length} 个正确格式的 commit 哈希引用`);
  } else {
    result.warn('未找到 commit 哈希引用 - 应使用 `短哈希` 格式');
  }
};

/**
 * Check contributor table format
 * Required columns: 作者、提交数、主要领域、关键提交
 */
const checkContributorTable = (content, result) => {
  const tableMatch = content.match(/## 3\. (贡献者|贡献者分析)\n\n([\s\S]*?)(?=\n## |$)/);

  if (!tableMatch) {
    result.fail('缺少贡献者表格');
    return;
  }

  const section = tableMatch[2];
  const hasTable = /\|.*\|.*\|/.test(section);

  if (!hasTable) {
    result.fail('贡献者章节缺少表格');
    return;
  }

  // Check required columns
  const headerLine = section.match(/\|[^|]+\|[^|]+\|[^|]+\|[^|]*\|?/);
  if (!headerLine) {
    result.fail('贡献者表格格式不正确');
    return;
  }

  const header = headerLine[0].toLowerCase();
  const hasAuthor = /作者/.test(header);
  const hasCommitCount = /提交数/.test(header);
  const hasDomain = /(领域|工作|贡献)/.test(header);
  const hasKeyCommit = /(关键提交|提交)/.test(header);

  if (hasAuthor && hasCommitCount && hasDomain && hasKeyCommit) {
    result.pass('贡献者表格包含所有必需列（作者、提交数、主要领域、关键提交）');
  } else {
    if (!hasAuthor) result.warn('贡献者表格缺少"作者"列');
    if (!hasCommitCount) result.warn('贡献者表格缺少"提交数"列');
    if (!hasDomain) result.warn('贡献者表格缺少"主要领域"列');
    if (!hasKeyCommit) result.fail('贡献者表格缺少"关键提交"列');
  }

  // Check if table has data rows
  const rows = section.split('\n').filter((line) => /^\|[^-]/.test(line));
  const dataRows = rows.length - 1; // Subtract header row

  if (dataRows > 0) {
    result.pass(`贡献者表格包含 ${dataRows} 行数据`);
  } else {
    result.fail('贡献者表格无数据');
  }

  // Check if key commits use proper hash format
  const keyCommitCells = section.match(/\|\s*`[^`]+`\s*\|?\s*$/gm) || [];
  const validHashes = keyCommitCells.filter((cell) => /`[0-9a-f]{7,}`/.test(cell));

  if (keyCommitCells.length > 0 && validHashes.length === keyCommitCells.length) {
    result.pass('关键提交列使用正确的 commit 哈希格式');
  } else if (keyCommitCells.length > 0) {
    result.warn('关键提交列中部分提交可能未使用正确的哈希格式');
  }
};

/**
 * Check for design intent explanations
 * Bad example: "添加了 getRequestIntervalMs 函数" (只说做了什么)
 * Good example: 解释为什么需要、解决什么问题、方案选择理由 (至少50字)
 */
const checkDesignIntent = (content, result) => {
  const domainSections = content.match(/### 2\.\d+ .+?\n\n([\s\S]*?)(?=\n### 2\.\d|\n## |$)/g) || [];

  if (domainSections.length === 0) {
    result.warn('未找到领域/变更章节');
    return;
  }

  let hasIntent = 0;
  let missingIntent = 0;
  let tooShort = 0;

  domainSections.forEach((section) => {
    // Check if design intent is present
    const intentMatch = section.match(/\*\*设计意图\*\*[：:]\s*\n?([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/);

    if (!intentMatch) {
      missingIntent++;
      return;
    }

    const intentContent = intentMatch[1].trim();

    // Check minimum length (50 chars for meaningful explanation)
    if (intentContent.length < 50) {
      tooShort++;
    } else {
      hasIntent++;
    }
  });

  if (missingIntent === 0 && tooShort === 0) {
    result.pass(`所有 ${hasIntent} 个领域都包含充分的设计意图说明（≥50字）`);
  } else {
    if (missingIntent > 0) {
      result.fail(`${missingIntent} 个领域缺少"设计意图"字段`);
    }
    if (tooShort > 0) {
      result.fail(`${tooShort} 个领域的设计意图过短（应至少 50 字，解释"为什么"而非"做了什么"）`);
    }
  }
};

/**
 * Check risk assessment section
 * Bad example: "API 有变更，调用方需要注意" (过于笼统)
 * Good example: 列出具体受影响的模块/服务、风险级别、迁移要求
 */
const checkRiskAssessment = (content, result) => {
  const riskSection = content.match(/## 4\. (风险评估|技术影响与风险)\n\n([\s\S]*?)(?=\n## |$)/);

  if (!riskSection) {
    result.fail('缺少风险评估章节');
    return;
  }

  const section = riskSection[2];

  // Check for subsections
  const requiredSubsections = [
    { pattern: /### 兼容性影响/, name: '兼容性影响' },
    { pattern: /### 配置变更/, name: '配置变更' },
    { pattern: /### 性能影响/, name: '性能影响' },
    { pattern: /### 测试覆盖/, name: '测试覆盖' },
  ];

  const missing = requiredSubsections.filter((s) => !s.pattern.test(section));

  if (missing.length === 0) {
    result.pass('风险评估包含所有必需的子章节');
  } else {
    missing.forEach((s) => result.fail(`风险评估缺少"${s.name}"小节`));
  }

  // Check if subsections have substantial content (not just placeholders)
  requiredSubsections.forEach((sub) => {
    const subMatch = section.match(
      new RegExp(`${sub.pattern.source}\\n\\n?([\\s\\S]*?)(?=\\n### |\\n## |$)`),
    );

    if (subMatch) {
      const subContent = subMatch[1].trim();

      // Check for TODO markers
      if (/<!-- TODO/.test(subContent)) {
        result.warn(`"${sub.name}"小节包含未完成的 TODO 标记`);
        return;
      }

      // Check minimum content length
      if (subContent.length < 20) {
        result.warn(`"${sub.name}"小节内容过短`);
      } else {
        // Check for specificity (mentions specific modules/services)
        const hasSpecificContent =
          /`[^`]+`/.test(subContent) || // Has code references
          /apps\/|libraries\/|services\//.test(subContent) || // Has paths
          /(高风险|中风险|低风险)/.test(subContent); // Has risk levels

        if (hasSpecificContent) {
          result.pass(`"${sub.name}"小节包含具体内容`);
        } else {
          result.warn(`"${sub.name}"小节可能过于笼统 - 建议列出具体受影响的模块/服务`);
        }
      }
    }
  });
};

/**
 * Check commit summaries section (optional but thorough if present)
 */
const checkCommitSummaries = (content, result) => {
  const summarySection = content.match(/## 5\. 单提交摘要.*?\n\n([\s\S]*?)(?=\n---\n|$)/);

  if (!summarySection) {
    return; // Optional section
  }

  const section = summarySection[1];
  const commits = section.match(/### [`']?[0-9a-f]{7,}[`']?/gi) || [];

  if (commits.length > 0) {
    result.pass(`单提交摘要包含 ${commits.length} 个提交详情`);
  } else {
    result.warn('单提交摘要章节无有效内容');
    return;
  }

  // Check if summaries have required fields
  const summaries = section.split(/### [`']?[0-9a-f]{7,}/i).slice(1);
  let completeCount = 0;

  summaries.forEach((summary) => {
    const hasSubject = /\*\*主题\*\*/.test(summary);
    const hasChanges = /\*\*变更要点\*\*/.test(summary);

    if (hasSubject && hasChanges) {
      completeCount++;
    }
  });

  if (completeCount === summaries.length) {
    result.pass('所有单提交摘要包含必需字段（主题、变更要点）');
  } else {
    result.warn(`${summaries.length - completeCount} 个单提交摘要缺少必需字段`);
  }
};

/**
 * Verify all commits in JSON are covered in the report (strict mode)
 * @param {string} content - Report markdown content
 * @param {object} jsonData - Parsed JSON data
 * @param {CheckResult} result
 */
const checkCommitCoverage = (content, jsonData, result) => {
  const allCommits = new Set(jsonData.commits.map((c) => c.short));
  const mentionedCommits = new Set();

  // Extract all commit references from report (backtick format: `abc123de`)
  const commitRefs = content.matchAll(/`([0-9a-f]{7,})`/g);
  for (const match of commitRefs) {
    mentionedCommits.add(match[1]);
  }

  const missing = [...allCommits].filter((c) => !mentionedCommits.has(c));
  const extra = [...mentionedCommits].filter((c) => !allCommits.has(c));

  if (missing.length === 0 && extra.length === 0) {
    result.pass(`✅ 提交覆盖率 100% (${allCommits.size}/${allCommits.size})`);
  } else {
    if (missing.length > 0) {
      result.fail(
        `❌ 遗漏 ${missing.length} 个提交: ${missing.slice(0, 3).join(', ')}${
          missing.length > 3 ? '...' : ''
        }`,
      );
      result.fail(`   💡 提示: 在 JSON 中搜索这些 commit，确保它们出现在报告的"核心变更"或"提交明细"中`);
    }
    if (extra.length > 0) {
      result.warn(
        `⚠️  引用了 ${extra.length} 个不在 JSON 中的提交: ${extra.slice(0, 3).join(', ')}${
          extra.length > 3 ? '...' : ''
        }`,
      );
      result.warn(`   💡 提示: 这些可能是错误的 commit hash，请检查 JSON 文件`);
    }
  }
};

/**
 * Verify file references point to actual files in the repository (strict mode)
 * @param {string} content - Report markdown content
 * @param {CheckResult} result
 */
const checkFileExistence = async (content, result) => {
  const { execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const exec = promisify(execFile);

  // Extract all file paths from markdown links: [name](path/to/file.ts#L1-L10)
  const fileRefs = content.matchAll(/\[[^\]]+\]\(([^)#]+)#L\d+-L\d+\)/g);
  const uniquePaths = new Set();

  for (const match of fileRefs) {
    uniquePaths.add(match[1]);
  }

  if (uniquePaths.size === 0) {
    return;
  }

  try {
    // Use git ls-files to check if paths exist in repo
    const { stdout } = await exec('git', ['ls-files']);
    const repoFiles = new Set(stdout.split('\n').filter(Boolean));

    const missingFiles = [...uniquePaths].filter((path) => !repoFiles.has(path));

    if (missingFiles.length === 0) {
      result.pass(`✅ 所有 ${uniquePaths.size} 个文件引用均存在于仓库中`);
    } else {
      result.fail(`❌ ${missingFiles.length} 个文件引用不存在于仓库中:`);
      missingFiles.slice(0, 5).forEach((file) => {
        result.fail(`   - ${file}`);
      });
      if (missingFiles.length > 5) {
        result.fail(`   ...以及其他 ${missingFiles.length - 5} 个文件`);
      }
      result.fail(`   💡 提示: 使用 'git ls-files | grep <filename>' 查找正确的路径`);
    }
  } catch (error) {
    result.warn('⚠️  无法验证文件存在性（不在 git 仓库中或 git 不可用）');
  }
};

/**
 * Verify commit hashes exist in the git repository (strict mode)
 * @param {string} content - Report markdown content
 * @param {CheckResult} result
 */
const checkCommitExistence = async (content, result) => {
  const { execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const exec = promisify(execFile);

  // Extract all commit hashes from report
  const commitRefs = content.matchAll(/`([0-9a-f]{7,})`/g);
  const uniqueCommits = new Set();

  for (const match of commitRefs) {
    uniqueCommits.add(match[1]);
  }

  if (uniqueCommits.size === 0) {
    return;
  }

  const invalidCommits = [];

  for (const commit of uniqueCommits) {
    try {
      await exec('git', ['cat-file', '-t', commit]);
      // Commit exists
    } catch {
      invalidCommits.push(commit);
    }
  }

  if (invalidCommits.length === 0) {
    result.pass(`✅ 所有 ${uniqueCommits.size} 个 commit 引用均存在于仓库中`);
  } else {
    result.fail(`❌ ${invalidCommits.length} 个 commit 不存在于仓库中: ${invalidCommits.join(', ')}`);
    result.fail(`   💡 提示: 使用 'git log --oneline' 查找正确的 commit hash`);
  }
};

/**
 * Generate verification checklist for agent to review
 * @param {string} content - Report markdown content
 * @param {object} jsonData - JSON data
 */
const generateChecklist = (content, jsonData) => {
  console.info('\n' + '='.repeat(60));
  console.info('📋 Agent 二次确认清单');
  console.info('='.repeat(60));

  // 1. Commit coverage
  const allCommits = jsonData.commits.map((c) => c.short);
  console.info('\n1️⃣  提交覆盖检查：');
  console.info(`   JSON 中共有 ${allCommits.length} 个提交`);
  console.info(`   请确认报告中包含所有这些提交：`);
  allCommits.slice(0, 5).forEach((commit, i) => {
    const subject = jsonData.commits[i].subject;
    console.info(
      `      ${i + 1}. \`${commit}\` - ${subject.substring(0, 60)}${subject.length > 60 ? '...' : ''}`,
    );
  });
  if (allCommits.length > 5) {
    console.info(`      ...以及其他 ${allCommits.length - 5} 个提交`);
  }

  // 2. Code snippets
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  console.info(`\n2️⃣  代码片段检查（共 ${codeBlocks.length} 个）：`);
  console.info('   请确认每个代码片段：');
  console.info('   - 来源于实际文件（可通过 git show <commit>:<path> 验证）');
  console.info('   - 行号引用正确');
  console.info('   - 代码内容准确（未胡编乱造）');

  // 3. File references
  const fileRefs = content.matchAll(/\[([^\]]+:L\d+-L\d+)\]\(([^)]+)\)/g);
  const refs = [...fileRefs];
  console.info(`\n3️⃣  文件引用检查（共 ${refs.length} 个）：`);
  if (refs.length > 0) {
    console.info('   前 5 个引用：');
    refs.slice(0, 5).forEach((match) => {
      console.info(`   - ${match[1]} → ${match[2]}`);
    });
    if (refs.length > 5) {
      console.info(`   ...以及其他 ${refs.length - 5} 个引用`);
    }
  }

  console.info('\n✅ 请在提交报告前完成以上确认');
  console.info('='.repeat(60));
};

/**
 * Main function
 */
const main = async () => {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let markdownFile = null;
  let jsonFile = null;
  let basicMode = false;
  let showChecklist = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json' && i + 1 < args.length) {
      jsonFile = args[++i];
    } else if (args[i] === '--basic') {
      basicMode = true;
    } else if (args[i] === '--checklist') {
      showChecklist = true;
    } else if (!markdownFile && !args[i].startsWith('--')) {
      markdownFile = args[i];
    }
  }

  // Validate required arguments
  if (!markdownFile) {
    usage();
    process.exit(1);
  }

  if (showChecklist && !jsonFile) {
    console.error('❌ Error: --checklist requires --json parameter');
    process.exit(1);
  }

  // Strict mode is enabled by default when JSON is provided (unless --basic is specified)
  const strictMode = jsonFile && !basicMode;

  // Display validation mode
  console.info(`Validating report: ${markdownFile}`);
  if (strictMode) {
    console.info(`Mode: 🔍 Strict (with ${jsonFile})`);
  } else if (jsonFile && basicMode) {
    console.info(`Mode: 📝 Basic (--basic mode, JSON available but strict checks disabled)`);
  } else {
    console.info('Mode: 📝 Basic (format checks only)');
  }
  console.info('='.repeat(60));

  // Read markdown file
  let content;
  try {
    content = await readFile(markdownFile, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    process.exit(1);
  }

  // Read JSON file if provided
  let jsonData = null;
  if (jsonFile) {
    try {
      const jsonContent = await readFile(jsonFile, 'utf8');
      jsonData = JSON.parse(jsonContent);
    } catch (error) {
      console.error(`❌ Error reading JSON file: ${error.message}`);
      process.exit(1);
    }
  }

  const result = new CheckResult();

  // Run basic checks
  checkRequiredSections(content, result);
  checkOverview(content, result);
  checkCodeSnippets(content, result);
  checkTodoMarkers(content, result);
  checkFileReferences(content, result);
  checkCommitHashFormat(content, result);
  checkContributorTable(content, result);
  checkDesignIntent(content, result);
  checkRiskAssessment(content, result);
  checkCommitSummaries(content, result);

  // Run strict validation checks (async)
  if (strictMode && jsonData) {
    console.info('\n🔍 Running strict validation...');
    checkCommitCoverage(content, jsonData, result);
    await checkFileExistence(content, result);
    await checkCommitExistence(content, result);
  }

  // Print results
  result.print();

  // Generate checklist if requested
  if (showChecklist && jsonData && !result.hasFailures()) {
    generateChecklist(content, jsonData);
  }

  // Exit with appropriate code
  if (result.hasFailures()) {
    console.info('\n💡 Tip: 参考以下文件改进报告：');
    console.info('   - references/report-template.md（正确格式）');
    console.info('   - references/bad-examples.md（常见错误）');
    if (strictMode) {
      console.info('\n🔍 Strict mode tips:');
      console.info('   - 使用 jq 查询 JSON: jq \'.commits[] | select(.short == "abc123")\' changes.json');
      console.info('   - 验证文件存在: git ls-files | grep <filename>');
      console.info('   - 验证 commit: git cat-file -t <hash>');
    }
    process.exit(1);
  } else if (result.warnings.length > 0) {
    console.info('\n✨ 报告通过基本检查，但有一些建议可以改进质量');
    process.exit(0);
  } else {
    console.info('\n🎉 报告通过所有质量检查！');
    if (strictMode) {
      console.info('   ✅ 严格验证通过：commit 覆盖率 100%、所有引用真实有效');
    }
    process.exit(0);
  }
};

main().catch((err) => {
  console.error('❌ Error:', err?.stack || err?.message || err);
  process.exit(1);
});
