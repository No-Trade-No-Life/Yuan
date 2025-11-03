import { generateDefaultToml } from '../../config/defaultConfig';

describe('generateDefaultToml', () => {
  it('includes expected sections', () => {
    const content = generateDefaultToml({ hostUrl: 'wss://demo/ws', terminalId: 'Yuanctl/demo' });
    expect(content).toContain('current_context = "default"');
    expect(content).toContain('[hosts.default]');
    expect(content).toContain('host_url = "wss://demo/ws"');
    expect(content).toContain('[contexts.default]');
  });
});
