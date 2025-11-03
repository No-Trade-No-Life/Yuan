import type { Cli } from 'clipanion';
import { COMMAND_HELP_ENTRIES } from './commandMetadata';

interface FlagHelpEntry {
  flag: string;
  description: string;
}

const GLOBAL_FLAGS: FlagHelpEntry[] = [
  { flag: '-c, --context string', description: 'Use a specific context from config.' },
  { flag: '--host-url string', description: 'Override host URL from the active context.' },
  { flag: '--selector string', description: 'Label selector in field=value form.' },
  { flag: '--field-selector string', description: 'Field selector applied to resource fields.' },
  { flag: '-o, --output string', description: 'Default output format (table|wide|json|yaml).' },
  { flag: '--force-confirm', description: 'Always prompt before mutating operations.' },
  { flag: '--no-headers', description: 'Omit headers in table output.' },
  { flag: '--wide', description: 'Use wide table output.' },
  { flag: '-h, --help', description: 'Show help for yuanctl.' },
];

const GROUP_ORDER = ['Basic Commands', 'Deployment Management', 'Configuration'];

const buildAvailableCommandsSection = (): string[] => {
  const maxNameLength = COMMAND_HELP_ENTRIES.reduce((max, entry) => Math.max(max, entry.name.length), 0);
  const grouped = new Map<string, typeof COMMAND_HELP_ENTRIES>();
  for (const entry of COMMAND_HELP_ENTRIES) {
    const list = grouped.get(entry.group);
    if (list) {
      list.push(entry);
    } else {
      grouped.set(entry.group, [entry]);
    }
  }

  const lines: string[] = ['Available Commands:'];
  const groupNames = [
    ...GROUP_ORDER.filter((name) => grouped.has(name)),
    ...Array.from(grouped.keys()).filter((name) => !GROUP_ORDER.includes(name)),
  ];

  for (const groupName of groupNames) {
    const entries = grouped.get(groupName);
    if (!entries) continue;
    lines.push(`  ${groupName}:`);
    entries
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const paddedName = entry.name.padEnd(maxNameLength + 2);
        lines.push(`    ${paddedName}${entry.description}`);
      });
    lines.push('');
  }
  if (lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
};

const buildFlagsSection = (): string[] => {
  const maxLength = GLOBAL_FLAGS.reduce((max, flag) => Math.max(max, flag.flag.length), 0);
  const lines: string[] = ['Flags:'];
  for (const flag of GLOBAL_FLAGS) {
    const padded = flag.flag.padEnd(maxLength + 2);
    lines.push(`  ${padded}${flag.description}`);
  }
  return lines;
};

const renderRootHelp = (): string => {
  const lines: string[] = [];
  lines.push('yuanctl manages Yuants deployments and node units.');
  lines.push('');
  lines.push('Usage:');
  lines.push('  yuanctl [flags]');
  lines.push('  yuanctl [command]');
  lines.push('');
  lines.push(...buildAvailableCommandsSection());
  lines.push('');
  lines.push(...buildFlagsSection());
  lines.push('');
  lines.push('Use "yuanctl [command] --help" for more information about a command.');
  return lines.join('\n');
};

export const configureRootHelp = (cli: Cli): void => {
  const originalUsage = cli.usage.bind(cli);
  cli.usage = (command: any = null, options?: any) => {
    if ((command === null || typeof command === 'undefined') && (!options || options.detailed !== true)) {
      return renderRootHelp();
    }
    return originalUsage(command, options);
  };
};
