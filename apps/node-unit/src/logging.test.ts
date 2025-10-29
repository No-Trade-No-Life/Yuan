import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { once } from 'events';
import { gunzip } from 'zlib';
import { RotatingLogStream, parseByteSize } from './logging';

const writeChunk = (stream: RotatingLogStream, content: string) =>
  new Promise<void>((resolve, reject) => {
    stream.write(content, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

const finishStream = async (stream: RotatingLogStream) => {
  stream.end();
  await once(stream, 'finish');
};

describe('RotatingLogStream', () => {
  const createTempDir = () => mkdtemp(join(tmpdir(), 'node-unit-log-'));

  afterAll(async () => {
    // ensure tmp dirs cleaned up by tests individually
  });

  it('rotates without compression and caps number of archives', async () => {
    const dir = await createTempDir();
    try {
      const logPath = join(dir, 'demo.log');
      const stream = new RotatingLogStream(logPath, {
        maxSizeBytes: 10,
        maxFiles: 3,
        compress: false,
      });

      await writeChunk(stream, 'AAAAAA'); // 6
      await writeChunk(stream, 'BBBBBB'); // rotate -> .log.1
      await writeChunk(stream, 'CCCCCC'); // rotate -> .log.2

      await finishStream(stream);

      const files = await readdir(dir);
      expect(files.sort()).toEqual(['demo.log', 'demo.log.1', 'demo.log.2']);

      const active = await readFile(join(dir, 'demo.log'), 'utf-8');
      const archive1 = await readFile(join(dir, 'demo.log.1'), 'utf-8');
      const archive2 = await readFile(join(dir, 'demo.log.2'), 'utf-8');

      expect(active).toBe('CCCCCC');
      expect(archive1).toBe('BBBBBB');
      expect(archive2).toBe('AAAAAA');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rotates with compression and keeps gz archives beyond the latest', async () => {
    const dir = await createTempDir();
    try {
      const logPath = join(dir, 'demo.log');
      const stream = new RotatingLogStream(logPath, {
        maxSizeBytes: 10,
        maxFiles: 4,
        compress: true,
      });

      await writeChunk(stream, 'AAAAAA'); // stays in .log
      await writeChunk(stream, 'BBBBBB'); // becomes .log.1
      await writeChunk(stream, 'CCCCCC'); // compress AAA into .log.2.gz
      await writeChunk(stream, 'DDDDDD'); // compress BBB into .log.3.gz

      await finishStream(stream);

      const files = await readdir(dir);
      expect(files.sort()).toEqual(['demo.log', 'demo.log.1', 'demo.log.2.gz', 'demo.log.3.gz']);

      const active = await readFile(join(dir, 'demo.log'), 'utf-8');
      const latest = await readFile(join(dir, 'demo.log.1'), 'utf-8');
      const gz2 = await readFile(join(dir, 'demo.log.2.gz'));
      const gz3 = await readFile(join(dir, 'demo.log.3.gz'));

      expect(active).toBe('DDDDDD');
      expect(latest).toBe('CCCCCC');
      const decompressed2 = await new Promise<string>((resolve, reject) => {
        gunzip(gz2, (err, buf) => {
          if (err) reject(err);
          else resolve(buf.toString('utf-8'));
        });
      });
      const decompressed3 = await new Promise<string>((resolve, reject) => {
        gunzip(gz3, (err, buf) => {
          if (err) reject(err);
          else resolve(buf.toString('utf-8'));
        });
      });
      expect(decompressed2).toBe('BBBBBB');
      expect(decompressed3).toBe('AAAAAA');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rotates with a single archive slot by truncating the active log', async () => {
    const dir = await createTempDir();
    try {
      const logPath = join(dir, 'demo.log');
      const stream = new RotatingLogStream(logPath, {
        maxSizeBytes: 10,
        maxFiles: 1,
        compress: false,
      });

      await writeChunk(stream, 'AAAAAA');
      await writeChunk(stream, 'BBBBBB');
      await writeChunk(stream, 'CCCCCC');

      await finishStream(stream);

      const files = await readdir(dir);
      expect(files.sort()).toEqual(['demo.log']);

      const active = await readFile(join(dir, 'demo.log'), 'utf-8');
      expect(active).toBe('CCCCCC');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('cleans up overflow archives on initialization', async () => {
    const dir = await createTempDir();
    try {
      const logPath = join(dir, 'demo.log');
      await writeFile(join(dir, 'demo.log.1'), 'legacy-1');
      await writeFile(join(dir, 'demo.log.2.gz'), 'legacy-2');
      await writeFile(join(dir, 'demo.log.3'), 'stale-3');
      await writeFile(join(dir, 'demo.log.50.gz'), 'stale-50');
      await writeFile(join(dir, 'demo.log.notanumber'), 'ignored');

      const stream = new RotatingLogStream(logPath, {
        maxSizeBytes: 10,
        maxFiles: 3,
        compress: true,
      });

      await writeChunk(stream, 'AAAA');
      await finishStream(stream);

      const files = await readdir(dir);
      expect(files.sort()).toEqual(['demo.log', 'demo.log.1', 'demo.log.2.gz', 'demo.log.notanumber']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('parseByteSize', () => {
  it('parses numeric strings and units', () => {
    expect(parseByteSize('1024')).toBe(1024);
    expect(parseByteSize('10Mi')).toBe(10 * 1024 * 1024);
    expect(parseByteSize('5M')).toBe(5_000_000);
    expect(parseByteSize('2Gi')).toBe(2 * 1024 * 1024 * 1024);
  });

  it('trims whitespace and accepts lowercase units', () => {
    expect(parseByteSize('  1k  ')).toBe(1_000);
    expect(parseByteSize('\n2mi\t')).toBe(2 * 1024 * 1024);
  });

  it('floors decimal inputs', () => {
    expect(parseByteSize('1.75K')).toBe(1_750);
    expect(parseByteSize('3.9Mi')).toBe(Math.floor(3.9 * 1024 * 1024));
  });

  it('throws for empty or invalid strings', () => {
    expect(() => parseByteSize('')).toThrow('Byte size cannot be empty');
    expect(() => parseByteSize('   ')).toThrow('Byte size cannot be empty');
    expect(() => parseByteSize('abc')).toThrow('Invalid byte size: abc');
  });

  it('throws for unsupported units', () => {
    expect(() => parseByteSize('10X')).toThrow('Invalid byte size: 10X');
    expect(() => parseByteSize('1Zi')).toThrow('Invalid byte size: 1Zi');
  });
});
