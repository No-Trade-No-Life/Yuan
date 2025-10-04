import { formatTime } from '@yuants/utils';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { Observable } from 'rxjs';
import treeKill from 'tree-kill';

export const spawnChild = (ctx: {
  command: string;
  args: string[];
  env?: any;
  cwd?: string;
  stdoutFilename?: string;
  stderrFilename?: string;
}) => {
  return new Observable<void>((sub) => {
    // console.info(formatTime(Date.now()), 'Spawn', JSON.stringify(ctx));
    const child = spawn(ctx.command, ctx.args, {
      env: ctx.env,
      cwd: ctx.cwd,
    });

    const stdout = ctx.stdoutFilename
      ? createWriteStream(ctx.stdoutFilename, { flags: 'a' })
      : process.stdout;

    const stderr =
      ctx.stderrFilename === ctx.stdoutFilename
        ? stdout
        : ctx.stderrFilename
        ? createWriteStream(ctx.stderrFilename, { flags: 'a' })
        : process.stderr;

    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);

    child.on('spawn', () => {
      console.info(formatTime(Date.now()), 'Spawn', ctx.command, ctx.args, child.pid);
      sub.next(); // 只发出一次，用于表示启动成功
    });

    child.on('error', (err) => {
      console.error(formatTime(Date.now()), 'Error', err);
      sub.error(err);
    });

    child.on('exit', () => {
      console.info(formatTime(Date.now()), 'Exit', ctx.command, ctx.args, child.pid);
      sub.complete();
    });

    return () => {
      treeKill(child.pid!, 'SIGKILL');
    };
  });
};
