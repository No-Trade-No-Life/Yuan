import { homedir } from 'os';
import { join } from 'path';

const CONFIG_FILENAME = 'config.toml';
const CONFIG_DIRNAME = 'yuan';
const CACHE_DIRNAME = 'yuan';

export const resolveConfigPath = (env: NodeJS.ProcessEnv): string => {
  if (env.YUANCTL_CONFIG) {
    return env.YUANCTL_CONFIG;
  }
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg && xdg.trim().length > 0) {
    return join(xdg, CONFIG_DIRNAME, CONFIG_FILENAME);
  }
  const home = homedir();
  if (home) {
    return join(home, '.config', CONFIG_DIRNAME, CONFIG_FILENAME);
  }
  // Fallback - homedir may be empty on some restricted environments
  return join(process.cwd(), CONFIG_FILENAME);
};

export const resolveCacheDir = (env: NodeJS.ProcessEnv): string => {
  if (env.YUANCTL_CACHE_DIR) {
    return env.YUANCTL_CACHE_DIR;
  }
  const xdgCache = env.XDG_CACHE_HOME;
  if (xdgCache && xdgCache.trim().length > 0) {
    return join(xdgCache, CACHE_DIRNAME);
  }
  const home = homedir();
  if (home) {
    return join(home, '.cache', CACHE_DIRNAME);
  }
  return join(process.cwd(), '.yuan-cache');
};
