import { createReadStream, createWriteStream } from 'fs';
import { FileHandle, open as fsOpen, mkdir, readdir, rename, stat, unlink } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

export interface ILogRotateOptions {
  maxSizeBytes: number;
  maxFiles: number;
  compress: boolean;
}

export const parseByteSize = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Byte size cannot be empty');
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const match = /^(\d+(?:\.\d+)?)([kmgt]?)(i?)$/i.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid byte size: ${value}`);
  }

  const num = Number(match[1]);
  const unit = match[2].toLowerCase();
  const hasI = !!match[3];

  if (!isFinite(num)) {
    throw new Error(`Invalid numeric value in byte size: ${value}`);
  }

  const multipliers: Record<string, number> = {
    '': 1,
    k: hasI ? 1024 : 1000,
    m: hasI ? 1024 ** 2 : 1000 ** 2,
    g: hasI ? 1024 ** 3 : 1000 ** 3,
    t: hasI ? 1024 ** 4 : 1000 ** 4,
  };

  if (!(unit in multipliers)) {
    throw new Error(`Unsupported unit in byte size: ${value}`);
  }

  return Math.floor(num * multipliers[unit]);
};

export const DEFAULT_LOG_ROTATE_OPTIONS: ILogRotateOptions = {
  maxSizeBytes: parseByteSize(process.env.NODE_UNIT_LOG_MAX_SIZE ?? '10Mi'),
  maxFiles: Math.max(1, Number(process.env.NODE_UNIT_LOG_MAX_FILES ?? '5') || 5),
  compress: (process.env.NODE_UNIT_LOG_ROTATE_COMPRESS ?? '').toLowerCase() !== 'false',
};

const safeStat = async (path: string) => {
  try {
    return await stat(path);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
};

const safeRename = async (from: string, to: string) => {
  try {
    await rename(from, to);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
};

const safeUnlink = async (path: string) => {
  try {
    await unlink(path);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
};

export class RotatingLogStream extends Writable {
  private activeHandle: FileHandle | null = null;
  private currentSize = 0;
  private sequence = Promise.resolve();
  private readonly dir: string;
  private readonly baseName: string;

  constructor(private readonly activePath: string, private readonly options: ILogRotateOptions) {
    super({ decodeStrings: true });
    this.dir = dirname(activePath);
    this.baseName = basename(activePath, '.log');
  }

  private get archiveLimit() {
    return Math.max(1, this.options.maxFiles);
  }

  override _construct(callback: (error?: Error | null) => void) {
    this.sequence = this.sequence.then(() => this.initialize());
    this.sequence.then(
      () => callback(),
      (err) => callback(err as Error),
    );
  }

  override _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    this.sequence = this.sequence.then(() => this.writeBuffer(buf));
    this.sequence.then(
      () => callback(),
      (err) => callback(err as Error),
    );
  }

  override _final(callback: (error?: Error | null) => void): void {
    this.sequence = this.sequence.then(() => this.closeHandle());
    this.sequence.then(
      () => callback(),
      (err) => callback(err as Error),
    );
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.sequence = this.sequence.then(() => this.closeHandle());
    this.sequence.then(
      () => callback(error || undefined),
      (err) => callback(err as Error),
    );
  }

  private async initialize() {
    await mkdir(this.dir, { recursive: true });
    await this.cleanupOverflowArchives();

    this.activeHandle = await fsOpen(this.activePath, 'a');
    const info = await this.activeHandle.stat();
    this.currentSize = info.size;

    if (this.currentSize >= this.options.maxSizeBytes) {
      await this.rotate();
    }
  }

  private async writeBuffer(buf: Buffer) {
    if (!this.activeHandle) {
      await this.openActiveFile('a');
    }

    if (this.currentSize + buf.length > this.options.maxSizeBytes) {
      await this.rotate();
    }

    if (!this.activeHandle) {
      await this.openActiveFile('w');
    }

    await this.activeHandle!.write(buf);
    this.currentSize += buf.length;
  }

  private async rotate() {
    await this.closeHandle();

    if (this.archiveLimit <= 1) {
      await safeUnlink(this.activePath);
      await this.openActiveFile('w');
      this.currentSize = 0;
      return;
    }

    const startIndex = this.options.compress ? 2 : 1;
    for (let index = this.archiveLimit - 1; index >= startIndex; index--) {
      const src = index === 1 ? this.getPlainArchivePath(1) : this.getArchivePath(index);
      const dst = this.getArchivePath(index + 1);
      const srcStat = await safeStat(src);
      if (!srcStat) {
        continue;
      }
      if (index + 1 > this.archiveLimit - 1) {
        await safeUnlink(src);
      } else {
        await safeRename(src, dst);
      }
    }

    if (this.options.compress && this.archiveLimit > 2) {
      await this.compressPlainArchiveIfExists();
    }

    if (this.archiveLimit > 1) {
      await safeRename(this.activePath, this.getPlainArchivePath(1));
    } else {
      await safeUnlink(this.activePath);
    }

    await this.openActiveFile('w');
    this.currentSize = 0;
  }

  private async compressPlainArchiveIfExists() {
    const plainArchive = this.getPlainArchivePath(1);
    const plainStat = await safeStat(plainArchive);
    if (!plainStat) {
      return;
    }

    const tmpPath = `${plainArchive}.tmp`;
    const target = this.getArchivePath(2);

    await safeRename(plainArchive, tmpPath);

    try {
      await pipeline(createReadStream(tmpPath), createGzip(), createWriteStream(target));
      await safeUnlink(tmpPath);
    } catch (err) {
      await safeRename(tmpPath, `${plainArchive}.failed`);
      console.warn('Log compression failed', err);
    }
  }

  private async cleanupOverflowArchives() {
    const files = await readdir(this.dir).catch(() => []);
    const prefix = `${this.baseName}.log`;
    for (const file of files) {
      if (!file.startsWith(prefix)) continue;
      const suffix = file.substring(prefix.length);
      if (!suffix) continue;
      const archiveIndex = parseArchiveIndex(suffix);
      if (archiveIndex === null) continue;
      if (archiveIndex >= this.archiveLimit) {
        await safeUnlink(join(this.dir, file));
      }
    }
  }

  private async openActiveFile(flag: 'a' | 'w') {
    await mkdir(this.dir, { recursive: true });
    this.activeHandle = await fsOpen(this.activePath, flag);
    const info = await this.activeHandle.stat();
    this.currentSize = info.size;
  }

  private async closeHandle() {
    if (!this.activeHandle) {
      return;
    }
    await this.activeHandle.close();
    this.activeHandle = null;
  }

  private getPlainArchivePath(index: number) {
    return join(this.dir, `${this.baseName}.log.${index}`);
  }

  private getArchivePath(index: number) {
    if (this.options.compress && index >= 2) {
      return `${this.getPlainArchivePath(index)}.gz`;
    }
    return this.getPlainArchivePath(index);
  }
}

const parseArchiveIndex = (suffix: string): number | null => {
  // suffix like ".1", ".2.gz"
  const match = /^\.(\d+)(?:\.gz)?$/.exec(suffix);
  if (!match) return null;
  return Number(match[1]);
};
