import { createError } from './error';
import type { YuanctlResolvedCommand } from './static-registry';
import type { YuanctlRuntimeContext } from './runtime-context';

export const checkCapabilityGate = async (
  command: YuanctlResolvedCommand,
  context: YuanctlRuntimeContext,
): Promise<void> => {
  if (command.registration.capabilityClass === 'read-safe') {
    return;
  }

  if (command.registration.capabilityClass === 'write') {
    if (!context.stdoutIsTTY || !context.stderrIsTTY) {
      if (!command.globalFlags.yes) {
        throw createError(
          'E_CONFIRMATION_REQUIRED',
          'unsafe',
          `${command.path.join(' ')} requires --yes in non-interactive mode`,
        );
      }
    }
    return;
  }

  if (command.registration.capabilityClass === 'read-sensitive') {
    if (!command.globalFlags.yes && (!context.stdoutIsTTY || !context.stderrIsTTY)) {
      throw createError(
        'E_CONFIRMATION_REQUIRED',
        'unsafe',
        `${command.path.join(' ')} requires --yes in non-interactive mode`,
      );
    }
    return;
  }

  if (command.registration.capabilityClass !== 'destructive') {
    throw createError(
      'E_CAPABILITY_BLOCKED',
      'unsafe',
      `${command.path.join(' ')} is not enabled in this phase`,
    );
  }

  if (command.globalFlags.yes) {
    return;
  }
  if (!context.stdoutIsTTY || !context.stderrIsTTY) {
    throw createError(
      'E_CONFIRMATION_REQUIRED',
      'unsafe',
      `${command.path.join(' ')} requires confirmation; re-run with --yes`,
    );
  }
  const confirmed = await context.confirm({
    message: `Confirm ${command.path.join(' ')} ${command.positionals.join(' ')}`.trim(),
  });
  if (!confirmed) {
    throw createError('E_CONFIRMATION_REQUIRED', 'unsafe', 'Operation aborted by user');
  }
};
