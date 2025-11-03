import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { resolveCacheDir } from './config/paths';
import { request } from 'https';

interface UpdateCache {
  lastChecked: number;
  latestVersion?: string;
  notifiedVersion?: string;
}

const PACKAGE_NAME = '@yuants/tool-yuanctl';
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const REQUEST_TIMEOUT_MS = 2_500;
const CACHE_FILENAME = 'update-check.json';

const isUpdateCheckDisabled = (env: NodeJS.ProcessEnv) =>
  env.YUANCTL_DISABLE_UPDATE_CHECK === '1' || env.YUANCTL_DISABLE_UPDATE_CHECK === 'true';

const parseCache = (raw: string | undefined): UpdateCache | undefined => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return undefined;
  }
};

const compareVersion = (a: string, b: string): number => {
  const normalize = (input: string) =>
    input
      .split('-')[0]
      .split('.')
      .map((part) => parseInt(part, 10))
      .slice(0, 3);
  const partsA = normalize(a);
  const partsB = normalize(b);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va !== vb) {
      return va - vb;
    }
  }
  return 0;
};

const fetchLatestVersion = (packageName: string): Promise<string | undefined> =>
  new Promise((resolve) => {
    const controller = request(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      { method: 'GET', timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        if (!res || res.statusCode !== 200) {
          res.resume();
          resolve(undefined);
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(typeof body.version === 'string' ? body.version : undefined);
          } catch {
            resolve(undefined);
          }
        });
      },
    );
    controller.on('error', () => resolve(undefined));
    controller.on('timeout', () => {
      controller.destroy();
      resolve(undefined);
    });
    controller.end();
  });

const loadCache = (cachePath: string): UpdateCache | undefined => {
  try {
    return parseCache(readFileSync(cachePath, 'utf-8'));
  } catch {
    return undefined;
  }
};

const saveCache = (cachePath: string, cache: UpdateCache) => {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');
};

const notifyIfNeeded = (currentVersion: string, cache: UpdateCache) => {
  if (!cache.latestVersion) return;
  if (compareVersion(cache.latestVersion, currentVersion) > 0) {
    if (cache.notifiedVersion === cache.latestVersion) {
      return;
    }
    const message = [
      `A new version of yuanctl is available: ${cache.latestVersion} (current ${currentVersion}).`,
      `Update with "npm install -g @yuants/tool-yuanctl".`,
    ].join(' ');
    console.error(message);
    cache.notifiedVersion = cache.latestVersion;
  }
};

export const maybeCheckForUpdates = async (currentVersion: string): Promise<void> => {
  if (!currentVersion || isUpdateCheckDisabled(process.env)) {
    return;
  }
  const cacheDir = resolveCacheDir(process.env);
  const cachePath = join(cacheDir, CACHE_FILENAME);
  const now = Date.now();
  const cache: UpdateCache = loadCache(cachePath) ?? { lastChecked: 0 };

  if (now - cache.lastChecked < UPDATE_INTERVAL_MS) {
    notifyIfNeeded(currentVersion, cache);
    return;
  }

  const latestVersion = await fetchLatestVersion(PACKAGE_NAME);
  cache.lastChecked = now;
  if (latestVersion) {
    cache.latestVersion = latestVersion;
  }
  notifyIfNeeded(currentVersion, cache);
  try {
    saveCache(cachePath, cache);
  } catch {
    // ignore file system errors silently
  }
};
