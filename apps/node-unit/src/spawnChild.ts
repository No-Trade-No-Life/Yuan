import { formatTime } from '@yuants/utils';
import { ChildProcess, spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { Observable } from 'rxjs';
import { Writable } from 'stream';
import treeKill from 'tree-kill';

export interface ISpawnChildContext {
  command: string;
  args: string[];
  env?: any;
  cwd?: string;
  stdoutFilename?: string;
  stderrFilename?: string;
  streamFactory?: (filename: string) => Writable | null;
  onSpawn?: (child: ChildProcess) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export const spawnChild = (ctx: ISpawnChildContext) => {
  return new Observable<void>((sub) => {
    // console.info(formatTime(Date.now()), 'Spawn', JSON.stringify(ctx));
    const child = spawn(ctx.command, ctx.args, {
      env: ctx.env,
      cwd: ctx.cwd,
    });

    const cleanupTargets = new Set<Writable>();
    const buildStream = (filename: string | undefined, fallback: NodeJS.WritableStream) => {
      if (filename && ctx.streamFactory) {
        const stream = ctx.streamFactory(filename) ?? null;
        if (stream && stream !== process.stdout && stream !== process.stderr) {
          cleanupTargets.add(stream);
          return stream;
        }
        if (stream) {
          return stream;
        }
      }
      if (filename) {
        const stream = createWriteStream(filename, { flags: 'a' });
        cleanupTargets.add(stream);
        return stream;
      }
      return fallback;
    };

    const stdout = buildStream(ctx.stdoutFilename, process.stdout);
    const stderr =
      ctx.stderrFilename === ctx.stdoutFilename ? stdout : buildStream(ctx.stderrFilename, process.stderr);
    if (stderr === stdout) {
      cleanupTargets.delete(stderr as Writable);
    }

    child.stdout?.pipe(stdout, { end: false });
    child.stderr?.pipe(stderr, { end: false });

    let cleanedUp = false;
    const cleanup = async () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;

      cleanupTargets.forEach((stream) => stream.end?.());
      cleanupTargets.clear();
    };

    child.on('spawn', () => {
      console.info(formatTime(Date.now()), 'Spawn', ctx.command, ctx.args, child.pid);
      ctx.onSpawn?.(child);
      sub.next(); // 只发出一次，用于表示启动成功
    });

    child.on('error', async (err) => {
      console.error(formatTime(Date.now()), 'Error', err);
      await cleanup();
      sub.error(err);
    });

    child.on('exit', async (code, signal) => {
      console.info(formatTime(Date.now()), 'Exit', ctx.command, ctx.args, child.pid);
      ctx.onExit?.(code, signal);
      await cleanup();
      sub.complete();
    });

    return () => {
      treeKill(child.pid!, 'SIGKILL');
    };
  });
};
