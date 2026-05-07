import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';

const profile = process.env.PLAYWRIGHT_PROFILE || 'mock';

const withEnv = () => ({
  ...process.env,
  CI: '1',
});

const runStack = (command: string) => {
  const script =
    profile === 'dummy-live' ? 'scripts/run-dummy-fixture-stack.mjs' : 'scripts/run-mock-stack.mjs';
  const result = spawnSync('node', [script, command], { stdio: 'inherit', env: withEnv() });
  if (result.status !== 0) throw new Error(`${script} ${command} failed`);
};

test.beforeAll(() => {
  runStack('start');
});

test.afterAll(() => {
  runStack('stop');
});

test('@mock loads runtime health and mock account card', async ({ page }) => {
  test.skip(profile !== 'mock', 'mock only');
  await page.goto('/');
  await expect(page.getByText('Signal Trader Control Console')).toBeVisible();
  await expect(page.getByTestId('runtime-item-runtime-mock')).toBeVisible();
  await expect(page.getByTestId('profile-chip')).toContainText('mock');
  await expect(page.getByText('资金分层与聚合')).toBeVisible();
  await expect(page.getByTestId('mock-account-card')).toBeVisible();
  await expect(page.getByTestId('mock-account-card')).toContainText('acct-mock');
  await expect(page.getByTestId('mock-account-card')).toContainText('signal-trader-mock');
  await expect(page.getByTestId('mock-account-card')).toContainText('balance');
  await expect(page.getByTestId('mock-account-positions')).toContainText('暂无持仓');
  await expect(page.getByText('quote、netting 与 advisory')).toBeVisible();
});

test('@dummy-live fail closes submit without runtime confirmation', async ({ page }) => {
  test.skip(profile !== 'dummy-live', 'dummy-live only');
  await page.goto('/');
  await expect(page.getByTestId('runtime-item-runtime-live')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('profile-chip')).toContainText('dummy-live');
  await expect(page.getByTestId('runtime-confirmation-input')).toBeVisible();
  await expect(page.getByTestId('submit-signal-button')).toBeDisabled();
  await expect(page.getByTestId('submit-guard-reasons')).toContainText('需要输入 runtime_id 做最终确认');
});
