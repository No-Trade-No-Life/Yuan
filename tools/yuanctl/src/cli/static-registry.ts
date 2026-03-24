import { createError } from './error';
import type { YuanctlCommandResult, YuanctlOutputFormat } from './output';
import type { YuanctlRuntimeContext } from './runtime-context';

export type YuanctlCapabilityClass =
  | 'read-safe'
  | 'read-sensitive'
  | 'write'
  | 'destructive'
  | 'remote-proxy';

export interface YuanctlGlobalFlags {
  context?: string;
  hostUrl?: string;
  output?: YuanctlOutputFormat;
  yes?: boolean;
  help?: boolean;
}

export interface YuanctlOptionSpec {
  name: string;
  long: string;
  short?: string;
  type: 'string' | 'boolean';
  description: string;
}

export interface YuanctlCommandRegistration {
  path: string[];
  summary: string;
  capabilityClass: YuanctlCapabilityClass;
  sourcePackage: string;
  runtime: 'none' | 'config' | 'clients';
  args?: string[];
  options?: YuanctlOptionSpec[];
  supportsFormats?: Array<'table' | 'json'>;
  handler: (context: YuanctlRuntimeContext, command: YuanctlResolvedCommand) => Promise<YuanctlCommandResult>;
}

export interface YuanctlStaticRegistryModule {
  commands: YuanctlCommandRegistration[];
}

export interface YuanctlResolvedCommand {
  argv: string[];
  path: string[];
  positionals: string[];
  flags: Record<string, string | boolean | undefined>;
  globalFlags: YuanctlGlobalFlags;
  registration: YuanctlCommandRegistration;
}

export const GLOBAL_OPTIONS: YuanctlOptionSpec[] = [
  { name: 'context', long: '--context', short: '-c', type: 'string', description: 'Use a specific context.' },
  { name: 'hostUrl', long: '--host-url', type: 'string', description: 'Override host URL.' },
  {
    name: 'output',
    long: '--output',
    short: '-o',
    type: 'string',
    description: 'Output format: table|json.',
  },
  { name: 'yes', long: '--yes', short: '-y', type: 'boolean', description: 'Skip confirmation prompt.' },
  { name: 'help', long: '--help', short: '-h', type: 'boolean', description: 'Show help.' },
];

const parseTokens = (
  tokens: string[],
  specs: YuanctlOptionSpec[],
): { flags: Record<string, string | boolean | undefined>; positionals: string[] } => {
  const byLong = new Map(specs.map((spec) => [spec.long, spec]));
  const byShort = new Map(specs.filter((spec) => spec.short).map((spec) => [spec.short as string, spec]));
  const flags: Record<string, string | boolean | undefined> = {};
  const positionals: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }
    const separatorIndex = token.indexOf('=');
    const flagName = separatorIndex >= 0 ? token.slice(0, separatorIndex) : token;
    const inlineValue = separatorIndex >= 0 ? token.slice(separatorIndex + 1) : undefined;
    const spec = byLong.get(flagName) ?? byShort.get(flagName);
    if (!spec) {
      throw createError('E_USAGE_INVALID_ARGS', 'usage', `Unknown option "${flagName}"`);
    }
    if (spec.type === 'boolean') {
      flags[spec.name] = true;
      continue;
    }
    const value = inlineValue ?? tokens[index + 1];
    if (!value || value.startsWith('-')) {
      throw createError('E_USAGE_INVALID_ARGS', 'usage', `Option "${flagName}" requires a value`);
    }
    flags[spec.name] = value;
    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return { flags, positionals };
};

export const buildStaticRegistry = (modules: YuanctlStaticRegistryModule[]): YuanctlCommandRegistration[] => {
  const registrations = modules.flatMap((module) => module.commands);
  const seen = new Map<string, string>();
  for (const command of registrations) {
    const key = command.path.join(' ');
    const previous = seen.get(key);
    if (previous) {
      throw createError('E_REGISTRY_CONFLICT', 'internal', `Command path conflict for "${key}"`, {
        sourcePackage: command.sourcePackage,
        previousSourcePackage: previous,
      });
    }
    seen.set(key, command.sourcePackage);
  }
  return registrations;
};

export const resolveCommand = (
  argv: string[],
  commands: YuanctlCommandRegistration[],
):
  | { kind: 'root-help'; text: string }
  | { kind: 'namespace-help'; text: string }
  | { kind: 'command-help'; text: string }
  | { kind: 'command'; command: YuanctlResolvedCommand } => {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return { kind: 'root-help', text: renderRootHelp(commands) };
  }

  const [namespace, subcommand, ...rest] = argv;
  if (!namespace || namespace.startsWith('-')) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'Missing namespace');
  }
  if (subcommand === '--help' || subcommand === '-h') {
    return { kind: 'namespace-help', text: renderNamespaceHelp(namespace, commands) };
  }
  if (!subcommand || subcommand.startsWith('-')) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Missing subcommand for namespace "${namespace}"`);
  }

  const registration = commands.find((item) => item.path[0] === namespace && item.path[1] === subcommand);
  if (!registration) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Unknown command "${namespace} ${subcommand}"`);
  }

  const parsed = parseTokens(rest, [...GLOBAL_OPTIONS, ...(registration.options ?? [])]);
  if (parsed.flags.help) {
    return { kind: 'command-help', text: renderCommandHelp(registration) };
  }

  const expectedArgs = registration.args ?? [];
  if (parsed.positionals.length < expectedArgs.length) {
    throw createError(
      'E_USAGE_INVALID_ARGS',
      'usage',
      `Missing arguments for "${namespace} ${subcommand}": ${expectedArgs
        .slice(parsed.positionals.length)
        .join(', ')}`,
    );
  }
  if (parsed.positionals.length > expectedArgs.length) {
    throw createError(
      'E_USAGE_INVALID_ARGS',
      'usage',
      `Too many positional arguments for "${namespace} ${subcommand}"`,
    );
  }

  const output = parsed.flags.output;
  if (output && output !== 'table' && output !== 'json') {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Unsupported output format "${output}"`);
  }
  if (
    output &&
    registration.supportsFormats &&
    !registration.supportsFormats.includes(output as YuanctlOutputFormat)
  ) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Command does not support output format "${output}"`);
  }

  return {
    kind: 'command',
    command: {
      argv,
      path: [namespace, subcommand],
      positionals: parsed.positionals,
      flags: parsed.flags,
      globalFlags: {
        context: parsed.flags.context as string | undefined,
        hostUrl: parsed.flags.hostUrl as string | undefined,
        output: parsed.flags.output as YuanctlOutputFormat | undefined,
        yes: Boolean(parsed.flags.yes),
        help: Boolean(parsed.flags.help),
      },
      registration,
    },
  };
};

const renderRootHelp = (commands: YuanctlCommandRegistration[]): string => {
  const namespaces = new Map<string, YuanctlCommandRegistration[]>();
  for (const command of commands) {
    const list = namespaces.get(command.path[0]) ?? [];
    list.push(command);
    namespaces.set(command.path[0], list);
  }
  const lines = [
    'yuanctl',
    '',
    'Usage:',
    '  yuanctl <namespace> <subcommand> [args] [flags]',
    '',
    'Namespaces:',
  ];
  for (const [namespace, entries] of Array.from(namespaces.entries()).sort()) {
    lines.push(`  ${namespace}`);
    for (const entry of entries.sort((a, b) => a.path[1].localeCompare(b.path[1]))) {
      lines.push(`    ${entry.path[1]}  ${entry.summary}`);
    }
  }
  lines.push('', 'Global Flags:');
  for (const option of GLOBAL_OPTIONS) {
    const aliases = [option.short, option.long].filter(Boolean).join(', ');
    lines.push(`  ${aliases}  ${option.description}`);
  }
  return lines.join('\n');
};

const renderCommandHelp = (command: YuanctlCommandRegistration): string => {
  const usageParts = ['yuanctl', ...command.path, ...(command.args ?? []).map((arg) => `<${arg}>`)];
  const lines = [usageParts.join(' '), '', command.summary];
  if (command.options?.length) {
    lines.push('', 'Flags:');
    for (const option of command.options) {
      const aliases = [option.short, option.long].filter(Boolean).join(', ');
      lines.push(`  ${aliases}  ${option.description}`);
    }
  }
  return lines.join('\n');
};

const renderNamespaceHelp = (namespace: string, commands: YuanctlCommandRegistration[]): string => {
  const entries = commands
    .filter((command) => command.path[0] === namespace)
    .sort((a, b) => a.path[1].localeCompare(b.path[1]));
  if (entries.length === 0) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Unknown namespace "${namespace}"`);
  }
  const lines = [`yuanctl ${namespace} <subcommand> [args] [flags]`, '', 'Subcommands:'];
  for (const entry of entries) {
    lines.push(`  ${entry.path[1]}  ${entry.summary}`);
  }
  return lines.join('\n');
};
