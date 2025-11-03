export type CommandName =
  | 'get'
  | 'describe'
  | 'logs'
  | 'enable'
  | 'disable'
  | 'restart'
  | 'delete'
  | 'config-init';

export interface CommandHelpEntry {
  name: CommandName;
  group: string;
  description: string;
  examples?: Array<[string, string]>;
}

export const COMMAND_HELP_ENTRIES: CommandHelpEntry[] = [
  {
    name: 'get',
    group: 'Basic Commands',
    description: 'Display deployments or node units.',
    examples: [
      ['List all deployments', '$0 get deployments'],
      ['Watch for deployment changes', '$0 get deployments --watch'],
      ['Show a deployment in JSON', '$0 get deployment/<id> -o json'],
    ],
  },
  {
    name: 'describe',
    group: 'Basic Commands',
    description: 'Show detailed information for deployments or node units.',
    examples: [
      ['Describe a deployment', '$0 describe deployment/<id>'],
      ['Describe matching deployments', '$0 describe deployments --selector package_name=@yuants/bot'],
    ],
  },
  {
    name: 'logs',
    group: 'Basic Commands',
    description: 'Print or follow deployment logs.',
    examples: [
      ['Tail logs for a deployment', '$0 logs deployment/<id> --tail=200'],
      ['Follow logs with timestamps', '$0 logs deployment/<id> -f --timestamps'],
    ],
  },
  {
    name: 'enable',
    group: 'Deployment Management',
    description: 'Enable one or more deployments.',
    examples: [
      ['Enable a deployment', '$0 enable deployment/<id>'],
      ['Enable all deployments for a package', '$0 enable deployments --selector package_name=@yuants/bot'],
    ],
  },
  {
    name: 'disable',
    group: 'Deployment Management',
    description: 'Disable one or more deployments.',
    examples: [
      ['Disable a deployment', '$0 disable deployment/<id>'],
      ['Disable enabled deployments', '$0 disable deployments --field-selector enabled=true'],
    ],
  },
  {
    name: 'restart',
    group: 'Deployment Management',
    description: 'Restart deployments using touch, graceful, or hard strategies.',
    examples: [
      ['Touch restart a deployment', '$0 restart deployment/<id> --strategy=touch'],
      [
        'Gracefully restart a package',
        '$0 restart deployments --selector package_name=@yuants/bot --strategy=graceful',
      ],
    ],
  },
  {
    name: 'delete',
    group: 'Deployment Management',
    description: 'Delete deployment records.',
    examples: [
      ['Delete a deployment', '$0 delete deployment/<id>'],
      ['Delete deployments by selector', '$0 delete deployments --selector package_version=legacy'],
    ],
  },
  {
    name: 'config-init',
    group: 'Configuration',
    description: 'Print a default yuanctl config template.',
    examples: [['Write a config file', '$0 config-init > ~/.config/yuan/config.toml']],
  },
];

const COMMAND_HELP_MAP = new Map<CommandName, CommandHelpEntry>(
  COMMAND_HELP_ENTRIES.map((entry) => [entry.name, entry]),
);

export const getCommandHelp = (name: CommandName): CommandHelpEntry => {
  const entry = COMMAND_HELP_MAP.get(name);
  if (!entry) {
    throw new Error(`Unknown command metadata for "${name}"`);
  }
  return entry;
};
