import { createRequire } from 'module';
import { maybeCheckForUpdates } from '../updateChecker';
import { checkCapabilityGate } from './safety';
import { createPreflightContext, createRuntimeContext, type YuanctlIo } from './runtime-context';
import { buildStaticRegistry, resolveCommand } from './static-registry';
import { configRegistryModule } from '../namespaces/config';
import { deployRegistryModule } from '../namespaces/deploy';
import { exitCodeForError, toErrorResult } from './error';
import { renderError, renderResult } from './output';

const requireForVersion = createRequire(__dirname);

const resolvePackageVersion = (): string => {
  try {
    const pkg = requireForVersion('../../package.json');
    if (pkg && typeof pkg.version === 'string') {
      return pkg.version;
    }
  } catch {
    // ignore
  }
  return '0.0.0';
};

const YUANCTL_VERSION = resolvePackageVersion();

export const registry = buildStaticRegistry([deployRegistryModule, configRegistryModule]);

export const run = async (
  argv: string[],
  io: YuanctlIo = {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
  },
): Promise<number> => {
  await maybeCheckForUpdates(YUANCTL_VERSION);
  const args = argv.slice(2);
  let context: undefined | Awaited<ReturnType<typeof createRuntimeContext>>;

  try {
    const resolved = resolveCommand(args, registry);
    if (
      resolved.kind === 'root-help' ||
      resolved.kind === 'namespace-help' ||
      resolved.kind === 'command-help'
    ) {
      io.stdout.write(`${resolved.text}\n`);
      return 0;
    }
    await checkCapabilityGate(resolved.command, createPreflightContext(resolved.command, io));
    context = await createRuntimeContext(resolved.command, io);
    const result = await resolved.command.registration.handler(context, resolved.command);
    renderResult(context.printer, result, context.outputFormat);
    return 0;
  } catch (error) {
    const mapped = toErrorResult(error);
    const output =
      args.includes('--output') || args.some((item) => item.startsWith('--output=')) || args.includes('-o')
        ? ((): 'table' | 'json' => {
            const flagIndex = args.findIndex((item) => item === '--output' || item === '-o');
            if (flagIndex >= 0 && args[flagIndex + 1] === 'json') {
              return 'json';
            }
            const inline = args.find((item) => item.startsWith('--output='));
            return inline === '--output=json' ? 'json' : 'table';
          })()
        : 'table';
    renderError(
      {
        stdout: (text) => io.stdout.write(text),
        stderr: (text) => io.stderr.write(text),
      },
      mapped,
      output,
    );
    return exitCodeForError(mapped);
  } finally {
    context?.close?.();
  }
};
