import { loadClientConfig } from '../../config/clientConfig';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';

type Overrides = Parameters<typeof loadClientConfig>[0]['overrides'];

const writeTempConfig = (content: string): string => {
  const filePath = join(
    tmpdir(),
    `yuanctl-config-${process.pid}-${Math.random().toString(36).slice(2)}.toml`,
  );
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
};

describe('loadClientConfig', () => {
  const load = (configPath: string, overrides: Overrides = {}) =>
    loadClientConfig({ configPath, env: {}, overrides });

  it('loads config and resolves context/host', () => {
    const content = `current_context = "prod"\n\n[hosts.prod]\nhost_url = "wss://prod/ws"\n\n[contexts.prod]\nhost = "prod"\n`;
    const path = writeTempConfig(content);
    const result = load(path);
    unlinkSync(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.host.hostUrl).toBe('wss://prod/ws');
      expect(result.value.contextName).toBe('prod');
    }
  });

  it('overrides host url from CLI', () => {
    const content = `current_context = "prod"\n\n[hosts.prod]\nhost_url = "wss://prod/ws"\nterminal_id = "Yuanctl/test"\n\n[contexts.prod]\nhost = "prod"\nterminal_id = "Yuanctl/test"\n`;
    const path = writeTempConfig(content);
    const result = load(path, { hostUrl: 'wss://override/ws' });
    unlinkSync(path);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.host.hostUrl).toBe('wss://override/ws');
    }
  });
});
