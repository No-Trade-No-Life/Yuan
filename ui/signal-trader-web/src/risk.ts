import type { AppConfig, LiveCapabilitySummary, RuntimeConfig, RuntimeHealth, RiskTier } from './types';

export interface RiskAssessment {
  tier: RiskTier;
  profile: AppConfig['envProfile'];
  capability?: LiveCapabilitySummary;
  reasons: string[];
  canSubmit: boolean;
  healthOk: boolean;
  freshnessOk: boolean;
  capabilityOk: boolean;
  runtimeConfirmationOk: boolean;
  profileAllowsMutation: boolean;
}

const isPaperRuntime = (runtime: RuntimeConfig) =>
  runtime.execution_mode === 'paper' && runtime.observer_backend === 'paper_simulated';

const resolveCapability = (runtime: RuntimeConfig, capabilities: LiveCapabilitySummary[]) =>
  capabilities.find(
    (item) => item.observer_backend === runtime.observer_backend || item.key === runtime.observer_backend,
  );

export const assessRisk = (
  appConfig: AppConfig,
  runtime: RuntimeConfig | undefined,
  health: RuntimeHealth | undefined,
  capabilities: LiveCapabilitySummary[],
  runtimeConfirmation: string,
): RiskAssessment => {
  const reasons: string[] = [];
  if (!runtime) {
    return {
      tier: 'live',
      profile: appConfig.envProfile,
      reasons: ['runtime 未选中'],
      canSubmit: false,
      healthOk: false,
      freshnessOk: false,
      capabilityOk: false,
      runtimeConfirmationOk: false,
      profileAllowsMutation: appConfig.enableMutation,
    };
  }

  const capability = resolveCapability(runtime, capabilities);
  let tier: RiskTier = 'live';
  if (appConfig.envProfile === 'paper' && isPaperRuntime(runtime)) {
    tier = 'paper';
  } else if (appConfig.envProfile === 'dummy-live' && runtime.execution_mode === 'live' && capability) {
    tier = 'dummy-live';
  } else if (appConfig.envProfile === 'live' && runtime.execution_mode === 'live' && capability) {
    tier = 'live';
  } else {
    reasons.push('env profile / runtime config / capability summary 存在缺失或冲突，按 live fail-close');
  }

  if (appConfig.envProfile === 'paper' && !isPaperRuntime(runtime)) {
    reasons.push('mock profile 只能操作 mock runtime');
  }
  if (appConfig.envProfile !== 'paper' && runtime.execution_mode !== 'live') {
    reasons.push('当前 profile 需要 live execution_mode');
  }

  const profileAllowsMutation = appConfig.enableMutation;
  if (!profileAllowsMutation) reasons.push('SIGNAL_TRADER_ENABLE_MUTATION 未开启');

  const capabilityOk = tier === 'paper' ? true : Boolean(capability?.supports_submit);
  if (!capabilityOk) reasons.push('capability 不支持 SubmitSignal');

  const healthOk = Boolean(health && health.status === 'normal' && !health.lock_reason);
  if (!healthOk) reasons.push(`health 未就绪: ${health?.status ?? 'missing'}`);

  const reconciliationThreshold = Math.max(runtime.reconciliation_interval_ms * 3, 30_000);
  const hasFreshSnapshot = tier === 'paper' ? true : health?.last_account_snapshot_status === 'fresh';
  const hasFreshReconciliation =
    tier === 'paper'
      ? true
      : Boolean(
          health?.last_matched_reconciliation_at_ms &&
            Date.now() - health.last_matched_reconciliation_at_ms <= reconciliationThreshold,
        );
  const freshnessOk = Boolean(hasFreshSnapshot && hasFreshReconciliation);
  if (!freshnessOk)
    reasons.push('freshness 未满足：高风险 profile 需要 fresh snapshot 与 matched reconciliation');

  const runtimeConfirmationOk = tier === 'paper' ? true : runtimeConfirmation.trim() === runtime.runtime_id;
  if (!runtimeConfirmationOk) reasons.push('需要输入 runtime_id 做最终确认');

  return {
    tier,
    profile: appConfig.envProfile,
    capability,
    reasons,
    canSubmit:
      profileAllowsMutation &&
      capabilityOk &&
      healthOk &&
      freshnessOk &&
      runtimeConfirmationOk &&
      reasons.length === 0,
    healthOk,
    freshnessOk,
    capabilityOk,
    runtimeConfirmationOk,
    profileAllowsMutation,
  };
};

export const riskTone = (tier: RiskTier) => {
  switch (tier) {
    case 'paper':
      return 'var(--paper)';
    case 'dummy-live':
      return 'var(--dummy)';
    case 'live':
      return 'var(--live)';
  }
};
