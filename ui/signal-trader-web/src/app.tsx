import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyState,
  fetchAppConfig,
  formatRelative,
  formatTime,
  signalTraderApi,
  summarizeJson,
} from './api';
import {
  buildFormalPriceInsight,
  buildNettingInsight,
  buildProfitTargetInsight,
  buildQuoteIssueInsight,
} from './insights';
import { assessRisk, riskTone } from './risk';
import {
  sanitizeAuditDetail,
  sanitizeEventPayload,
  sanitizeInvestorProjection,
  sanitizeProductProjection,
  sanitizeReconciliationProjection,
  sanitizeRuntimeConfig,
  sanitizeSignalProjection,
  sanitizeSubscriptionProjection,
} from './sanitize';
import type {
  AppConfig,
  LiveCapabilitySummary,
  ProjectionBundle,
  ProjectionErrors,
  ResourceState,
  RuntimeConfig,
  SubmitSignalFormState,
  MockAccountInfo,
  WorkspaceResources,
  WriteResponse,
} from './types';

const defaultForm: SubmitSignalFormState = {
  signal: 1,
  entryPrice: '',
  stopLossPrice: '',
  metadataText: '{\n  "source": "manual-console"\n}',
  runtimeConfirmation: '',
};

const emptyResources = (): WorkspaceResources => ({
  health: emptyState(),
  projections: emptyState(),
  events: emptyState(),
  audit: emptyState(),
  mockAccount: emptyState(),
});

const isPaperMockRuntime = (runtime?: RuntimeConfig) =>
  runtime?.execution_mode === 'paper' && runtime.observer_backend === 'paper_simulated';

const loadable = async <T,>(loader: () => Promise<T>): Promise<ResourceState<T>> => {
  try {
    return { data: await loader(), loading: false };
  } catch (error) {
    return { loading: false, error: error instanceof Error ? error.message : String(error) };
  }
};

const saveRuntimePreference = (runtimeId: string) =>
  localStorage.setItem('signal-trader:selected-runtime', runtimeId);
const readRuntimePreference = () => localStorage.getItem('signal-trader:selected-runtime') || undefined;

export const App = () => {
  const [appConfig, setAppConfig] = useState<AppConfig>();
  const [appError, setAppError] = useState<string>();
  const [runtimeConfigsState, setRuntimeConfigsState] = useState<ResourceState<RuntimeConfig[]>>(
    emptyState(),
  );
  const [capabilitiesState, setCapabilitiesState] = useState<ResourceState<LiveCapabilitySummary[]>>(
    emptyState(),
  );
  const [resources, setResources] = useState<WorkspaceResources>(emptyResources);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string>();
  const [search, setSearch] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState<number>();
  const [submitState, setSubmitState] = useState<{
    loading: boolean;
    error?: string;
    result?: WriteResponse;
  }>({
    loading: false,
  });
  const [formState, setFormState] = useState<SubmitSignalFormState>(defaultForm);
  const mountedRef = useRef(true);

  const runtimeConfigs = runtimeConfigsState.data || [];
  const capabilities = capabilitiesState.data || [];
  const selectedRuntime = runtimeConfigs.find((item) => item.runtime_id === selectedRuntimeId);
  const assessment = appConfig
    ? assessRisk(
        appConfig,
        selectedRuntime,
        resources.health.data,
        capabilities,
        formState.runtimeConfirmation,
      )
    : undefined;
  const projections = resources.projections.data;
  const subscription = projections?.subscription;
  const investor = projections?.investor;
  const signalProjection = projections?.signal;
  const reconciliation = projections?.reconciliation;
  const formalPriceInsight = useMemo(
    () => buildFormalPriceInsight(resources.events.data || []),
    [resources.events.data],
  );
  const nettingInsight = useMemo(
    () => buildNettingInsight(resources.events.data || []),
    [resources.events.data],
  );
  const profitTargetInsight = useMemo(
    () => buildProfitTargetInsight(resources.events.data || []),
    [resources.events.data],
  );
  const quoteIssueInsight = useMemo(
    () => buildQuoteIssueInsight(resources.audit.data?.items || []),
    [resources.audit.data],
  );
  const displayedProfile = appConfig ? humanizeModeLabel(assessment?.tier || appConfig.envProfile) : '-';
  const runtimeConfigView = useMemo(() => sanitizeRuntimeConfig(selectedRuntime), [selectedRuntime]);
  const productView = useMemo(() => sanitizeProductProjection(projections?.product), [projections?.product]);
  const subscriptionView = useMemo(() => sanitizeSubscriptionProjection(subscription), [subscription]);
  const investorView = useMemo(() => sanitizeInvestorProjection(investor), [investor]);
  const signalView = useMemo(() => sanitizeSignalProjection(signalProjection), [signalProjection]);
  const reconciliationView = useMemo(
    () => sanitizeReconciliationProjection(reconciliation),
    [reconciliation],
  );

  const filteredRuntimes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return runtimeConfigs;
    return runtimeConfigs.filter((item) => {
      const haystack = [item.runtime_id, item.product_id, item.signal_key, item.observer_backend]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [runtimeConfigs, search]);

  const refreshWorkspace = async (runtime: RuntimeConfig) => {
    setResources((prev) => ({
      health: { ...prev.health, loading: true, error: undefined },
      projections: { ...prev.projections, loading: true, error: undefined },
      events: { ...prev.events, loading: true, error: undefined },
      audit: { ...prev.audit, loading: true, error: undefined },
      mockAccount: isPaperMockRuntime(runtime)
        ? { ...prev.mockAccount, loading: true, error: undefined }
        : emptyState<MockAccountInfo>(),
    }));

    const [health, product, subscription, reconciliation, investor, signal, events, audit, mockAccount] =
      await Promise.all([
        loadable(() => signalTraderApi.getRuntimeHealth(runtime.runtime_id)),
        loadable(() =>
          signalTraderApi.queryProjection<ProjectionBundle['product']>(runtime.runtime_id, {
            type: 'product',
            product_id: runtime.product_id,
          }),
        ),
        loadable(() =>
          signalTraderApi.queryProjection<ProjectionBundle['subscription']>(runtime.runtime_id, {
            type: 'subscription',
            subscription_id: runtime.subscription_id,
          }),
        ),
        loadable(() =>
          signalTraderApi.queryProjection<ProjectionBundle['reconciliation']>(runtime.runtime_id, {
            type: 'reconciliation',
            account_id: runtime.account_id,
          }),
        ),
        loadable(() =>
          signalTraderApi.queryProjection<ProjectionBundle['investor']>(runtime.runtime_id, {
            type: 'investor',
            investor_id: runtime.investor_id,
          }),
        ),
        loadable(() =>
          signalTraderApi.queryProjection<ProjectionBundle['signal']>(runtime.runtime_id, {
            type: 'signal',
            signal_key: runtime.signal_key,
          }),
        ),
        loadable(() => signalTraderApi.queryEventStream(runtime.runtime_id, {})),
        loadable(() => signalTraderApi.queryRuntimeAuditLog(runtime.runtime_id)),
        isPaperMockRuntime(runtime)
          ? loadable(() => signalTraderApi.getMockAccountInfo(runtime.runtime_id))
          : Promise.resolve(emptyState<MockAccountInfo>()),
      ]);

    if (!mountedRef.current) return;

    const projectionErrors: ProjectionErrors = {
      product: product.error,
      subscription: subscription.error,
      reconciliation: reconciliation.error,
      investor: investor.error,
      signal: signal.error,
    };
    const projectionErrorText = Object.values(projectionErrors).filter(Boolean).join(' | ');

    setResources({
      health,
      projections: {
        loading: false,
        error: projectionErrorText || undefined,
        errors: projectionErrors,
        data: {
          product: product.data,
          subscription: subscription.data,
          reconciliation: reconciliation.data,
          investor: investor.data,
          signal: signal.data,
        },
      },
      events: {
        loading: false,
        error: events.error,
        data: (events.data || []).slice().sort((a, b) => b.event_offset - a.event_offset),
      },
      audit,
      mockAccount,
    });
    setLastRefreshAt(Date.now());
  };

  const refreshRuntimes = async (preserveCurrent = true) => {
    setRuntimeConfigsState((prev) => ({ ...prev, loading: true, error: undefined }));
    setCapabilitiesState((prev) => ({ ...prev, loading: true, error: undefined }));
    const [runtimeRes, capabilityRes] = await Promise.all([
      loadable(() => signalTraderApi.listRuntimeConfig()),
      loadable(() => signalTraderApi.listLiveCapabilities()),
    ]);
    if (!mountedRef.current) return;
    setRuntimeConfigsState(runtimeRes);
    setCapabilitiesState(capabilityRes);
    const runtimes = runtimeRes.data || [];
    if (!runtimes.length) return;
    const preferred = preserveCurrent
      ? selectedRuntimeId || readRuntimePreference() || appConfig?.defaultRuntimeId
      : readRuntimePreference() || appConfig?.defaultRuntimeId;
    const next = runtimes.find((item) => item.runtime_id === preferred)?.runtime_id || runtimes[0].runtime_id;
    setSelectedRuntimeId(next);
    saveRuntimePreference(next);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchAppConfig()
      .then((config) => {
        if (!mountedRef.current) return;
        setAppConfig(config);
      })
      .catch((error) => {
        if (!mountedRef.current) return;
        setAppError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!appConfig) return;
    refreshRuntimes(false);
  }, [appConfig]);

  useEffect(() => {
    if (!selectedRuntime) return;
    refreshWorkspace(selectedRuntime);
  }, [selectedRuntimeId, runtimeConfigsState.data]);

  useEffect(() => {
    if (!selectedRuntime) return;
    const healthTimer = window.setInterval(() => {
      signalTraderApi.getRuntimeHealth(selectedRuntime.runtime_id).then(
        (health) =>
          mountedRef.current &&
          setResources((prev) => ({ ...prev, health: { data: health, loading: false } })),
        (error) =>
          mountedRef.current &&
          setResources((prev) => ({
            ...prev,
            health: { loading: false, error: error instanceof Error ? error.message : String(error) },
          })),
      );
    }, 5000);
    const activityTimer = window.setInterval(() => {
      refreshWorkspace(selectedRuntime);
    }, 10000);
    return () => {
      window.clearInterval(healthTimer);
      window.clearInterval(activityTimer);
    };
  }, [selectedRuntimeId]);

  const submitSignal = async () => {
    if (!selectedRuntime || !assessment) return;
    setSubmitState({ loading: true });
    try {
      const refreshedHealth = await signalTraderApi.getRuntimeHealth(selectedRuntime.runtime_id);
      setResources((prev) => ({ ...prev, health: { data: refreshedHealth, loading: false } }));
      const refreshedAssessment = assessRisk(
        appConfig!,
        selectedRuntime,
        refreshedHealth,
        capabilities,
        formState.runtimeConfirmation,
      );
      if (!refreshedAssessment.canSubmit) {
        throw new Error(refreshedAssessment.reasons[0] || '写入 gate 未通过');
      }
      const result = await signalTraderApi.submitSignal(selectedRuntime, formState);
      setSubmitState({ loading: false, result });
      await refreshWorkspace(selectedRuntime);
    } catch (error) {
      setSubmitState({ loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  if (appError) {
    return <div className="screen-error">App config 加载失败: {appError}</div>;
  }

  if (!appConfig) {
    return <div className="screen-loading">Signal Trader control console booting...</div>;
  }

  const tone = assessment ? riskTone(assessment.tier) : 'var(--live)';

  return (
    <div className="app-shell" style={{ ['--accent' as string]: tone }}>
      <header className="topbar" data-risk-tier={assessment?.tier || appConfig.envProfile}>
        <div>
          <p className="eyebrow">Signal Trader Control Console</p>
          <h1>读写分区明确的高风险控制台</h1>
          <p className="subtle">
            profile <strong>{humanizeModeLabel(appConfig.envProfile)}</strong> · host{' '}
            <strong>{appConfig.hostLabel}</strong> · 最近刷新 <strong>{formatRelative(lastRefreshAt)}</strong>
          </p>
        </div>
        <div className="topbar-actions">
          <div className="risk-chip" data-testid="profile-chip">
            {displayedProfile}
          </div>
          <button className="ghost-button" onClick={() => refreshRuntimes(true)}>
            全局刷新
          </button>
        </div>
      </header>

      <main className="layout-grid">
        <aside className="rail card">
          <div className="rail-header">
            <div>
              <p className="eyebrow">Runtime Rail</p>
              <h2>{runtimeConfigs.length} runtimes</h2>
            </div>
            <button className="ghost-button" onClick={() => refreshRuntimes(true)}>
              刷新
            </button>
          </div>
          <input
            className="text-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索 runtime / product / signal_key"
          />
          <div className="stack-list">
            {filteredRuntimes.map((runtime) => {
              const active = runtime.runtime_id === selectedRuntimeId;
              return (
                <button
                  key={runtime.runtime_id}
                  className={`runtime-item ${active ? 'active' : ''}`}
                  data-testid={`runtime-item-${runtime.runtime_id}`}
                  onClick={() => {
                    setSelectedRuntimeId(runtime.runtime_id);
                    saveRuntimePreference(runtime.runtime_id);
                  }}
                >
                  <div className="runtime-title-row">
                    <strong>{runtime.runtime_id}</strong>
                    <span className={`pill ${runtime.execution_mode}`}>
                      {humanizeModeLabel(runtime.execution_mode)}
                    </span>
                  </div>
                  <div className="runtime-meta">{runtime.product_id}</div>
                  <div className="runtime-meta">observer: {runtime.observer_backend}</div>
                </button>
              );
            })}
            {!filteredRuntimes.length && <div className="empty-block">没有匹配 runtime</div>}
          </div>
        </aside>

        <section className="workspace">
          <div className="hero-grid">
            <article className="card summary-card">
              <p className="eyebrow">Capital Posture</p>
              <div className="summary-grid">
                <Metric label="released vc" value={formatNumber(subscription?.released_vc_total)} />
                <Metric label="funding" value={formatNumber(subscription?.funding_account)} />
                <Metric label="trading" value={formatNumber(subscription?.trading_account)} />
                <Metric label="precision lock" value={formatNumber(subscription?.precision_locked_amount)} />
              </div>
            </article>
            <article className="card summary-card">
              <p className="eyebrow">Health + Runtime Config</p>
              <div className="summary-grid">
                <Metric
                  label="health"
                  value={resources.health.data?.status || resources.health.error || '-'}
                />
                <Metric label="snapshot" value={resources.health.data?.last_account_snapshot_status || '-'} />
                <Metric label="target qty" value={formatNumber(subscription?.target_position_qty)} />
                <Metric label="settled qty" value={formatNumber(subscription?.settled_position_qty)} />
              </div>
            </article>
            <article className="card summary-card">
              <p className="eyebrow">Capability + Evidence</p>
              <div className="summary-grid">
                <Metric
                  label="supports submit"
                  value={assessment?.capability?.supports_submit ? 'yes' : 'no'}
                />
                <Metric label="observer" value={selectedRuntime?.observer_backend || '-'} />
                <Metric
                  label="quote source"
                  value={formalPriceInsight?.source || quoteIssueInsight?.note || '-'}
                />
                <Metric label="last refresh" value={formatTime(lastRefreshAt)} />
              </div>
            </article>
          </div>

          <div className="content-grid">
            <section className="write-column">
              <article className="card action-card" data-risk-tier={assessment?.tier || appConfig.envProfile}>
                <div className="action-header">
                  <div>
                    <p className="eyebrow">Write Zone</p>
                    <h2>SubmitSignal</h2>
                  </div>
                  <div className="risk-chip">{displayedProfile}</div>
                </div>
                <p className="subtle">
                  gate = mutation flag + capability + health/freshness + runtime_id confirm。缺失或冲突直接
                  fail-close。
                </p>
                <div className="signal-selector" role="radiogroup" aria-label="signal">
                  {([-1, 0, 1] as const).map((value) => (
                    <button
                      key={value}
                      className={`signal-button ${formState.signal === value ? 'active' : ''}`}
                      onClick={() => setFormState((prev) => ({ ...prev, signal: value }))}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <div className="form-grid">
                  <label>
                    <span>entry_price</span>
                    <input
                      className="text-input"
                      value={formState.entryPrice}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, entryPrice: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    <span>stop_loss_price</span>
                    <input
                      className="text-input"
                      value={formState.stopLossPrice}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, stopLossPrice: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>metadata JSON</span>
                  <textarea
                    className="text-area"
                    value={formState.metadataText}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, metadataText: event.target.value }))
                    }
                    rows={6}
                  />
                </label>
                {(assessment?.tier === 'dummy-live' || assessment?.tier === 'live') && (
                  <label>
                    <span>输入 runtime_id 确认写入</span>
                    <input
                      className="text-input"
                      data-testid="runtime-confirmation-input"
                      value={formState.runtimeConfirmation}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, runtimeConfirmation: event.target.value }))
                      }
                      placeholder={selectedRuntime?.runtime_id || 'runtime_id'}
                    />
                  </label>
                )}
                <div className="gate-list" data-testid="submit-guard-reasons">
                  {(assessment?.reasons.length ? assessment.reasons : ['写入 gate 已满足']).map((reason) => (
                    <div key={reason} className={`gate-item ${assessment?.reasons.length ? 'danger' : 'ok'}`}>
                      {reason}
                    </div>
                  ))}
                </div>
                <pre className="payload-preview">
                  {summarizeJson(
                    selectedRuntime
                      ? {
                          runtime_id: selectedRuntime.runtime_id,
                          signal_key: selectedRuntime.signal_key,
                          product_id: selectedRuntime.product_id,
                          signal: formState.signal,
                          entry_price: formState.entryPrice || undefined,
                          stop_loss_price: formState.stopLossPrice || undefined,
                        }
                      : { runtime_id: null },
                  )}
                </pre>
                <button
                  className="primary-button"
                  data-testid="submit-signal-button"
                  disabled={!assessment?.canSubmit || submitState.loading}
                  onClick={submitSignal}
                >
                  {submitState.loading ? '提交中...' : 'Submit Signal'}
                </button>
                {submitState.error && <div className="notice error">{submitState.error}</div>}
                {submitState.result && (
                  <div className="notice success" data-testid="submit-success-banner">
                    accepted={String(submitState.result.accepted)} · correlation_id=
                    {submitState.result.correlation_id}
                  </div>
                )}
              </article>

              <article className="card">
                <p className="eyebrow">Runtime Config</p>
                <pre className="json-block">{summarizeJson(runtimeConfigView || null)}</pre>
              </article>
            </section>

            <section className="read-column">
              <CapitalLedgerCard
                subscription={subscription}
                reconciliation={reconciliation}
                investor={investor}
                signalProjection={signalProjection}
              />
              {selectedRuntime && isPaperMockRuntime(selectedRuntime) && (
                <MockAccountCard runtime={selectedRuntime} state={resources.mockAccount} />
              )}
              <EvidenceCard
                formalPrice={formalPriceInsight}
                netting={nettingInsight}
                profitTarget={profitTargetInsight}
                quoteIssue={quoteIssueInsight}
              />
              <ProjectionCard
                title="Product Projection"
                value={productView}
                error={resources.projections.errors?.product}
              />
              <ProjectionCard
                title="Subscription Projection"
                value={subscriptionView}
                error={resources.projections.errors?.subscription}
              />
              <ProjectionCard
                title="Investor Projection"
                value={investorView}
                error={resources.projections.errors?.investor}
              />
              <ProjectionCard
                title="Signal Projection"
                value={signalView}
                error={resources.projections.errors?.signal}
              />
              <ProjectionCard
                title="Reconciliation Projection"
                value={reconciliationView}
                error={resources.projections.errors?.reconciliation}
              />

              <article className="card timeline-card">
                <div className="section-header">
                  <div>
                    <p className="eyebrow">Observe</p>
                    <h2>Event Stream</h2>
                  </div>
                  <span className="subtle">最近 {resources.events.data?.length || 0} 条</span>
                </div>
                {resources.events.error && <div className="notice error">{resources.events.error}</div>}
                <div className="timeline-list" data-testid="event-stream-list">
                  {(resources.events.data || []).slice(0, 20).map((event) => (
                    <div key={`${event.event_offset}-${event.event_type}`} className="timeline-item">
                      <div className="timeline-main">
                        <strong>{event.event_type}</strong>
                        <p className="subtle">
                          offset {event.event_offset} · {formatTime(event.event_created_at_ms)}
                        </p>
                        <pre className="timeline-detail">
                          {summarizeJson(sanitizeEventPayload(event) ?? {})}
                        </pre>
                      </div>
                      <code>{event.signal_id || event.runtime_id}</code>
                    </div>
                  ))}
                  {!resources.events.data?.length && <div className="empty-block">暂无事件</div>}
                </div>
              </article>

              <article className="card timeline-card">
                <div className="section-header">
                  <div>
                    <p className="eyebrow">Observe</p>
                    <h2>Audit Log</h2>
                  </div>
                  <span className="subtle">只读审计面</span>
                </div>
                {resources.audit.error && <div className="notice error">{resources.audit.error}</div>}
                <div className="timeline-list" data-testid="audit-log-list">
                  {(resources.audit.data?.items || []).slice(0, 20).map((item) => (
                    <div key={`${item.seq || item.created_at}-${item.action}`} className="timeline-item">
                      <div className="timeline-main">
                        <strong>{item.action}</strong>
                        <p className="subtle">
                          {item.operator || 'system'} · {formatTime(item.created_at)}
                        </p>
                        <pre className="timeline-detail">
                          {summarizeJson(sanitizeAuditDetail(item) ?? {})}
                        </pre>
                      </div>
                      <code>{item.runtime_id}</code>
                    </div>
                  ))}
                  {!resources.audit.data?.items?.length && <div className="empty-block">暂无审计记录</div>}
                </div>
              </article>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
};

const formatNumber = (value?: number) => (value === undefined ? '-' : value.toFixed(2).replace(/\.00$/, ''));
const humanizeModeLabel = (value?: string) => (value === 'paper' ? 'mock' : value || '-');

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="metric-card">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const CapitalLedgerCard = ({
  subscription,
  reconciliation,
  investor,
  signalProjection,
}: {
  subscription?: ProjectionBundle['subscription'];
  reconciliation?: ProjectionBundle['reconciliation'];
  investor?: ProjectionBundle['investor'];
  signalProjection?: ProjectionBundle['signal'];
}) => (
  <article className="card projection-card capital-card">
    <div className="section-header">
      <div>
        <p className="eyebrow">Capital Ledger</p>
        <h2>资金分层与聚合</h2>
      </div>
      <div className="pill live">capital</div>
    </div>
    <div className="capital-grid">
      <Metric label="projected funding" value={formatNumber(subscription?.funding_account)} />
      <Metric label="projected trading" value={formatNumber(subscription?.trading_account)} />
      <Metric label="available vc" value={formatNumber(subscription?.available_vc)} />
      <Metric label="precision lock" value={formatNumber(subscription?.precision_locked_amount)} />
    </div>
    <div className="insight-grid">
      <article className="insight-card">
        <p className="eyebrow">Investor Lens</p>
        <DetailRow label="investor" value={investor?.investor_id || '-'} />
        <DetailRow label="active subscriptions" value={String(investor?.active_subscription_count ?? 0)} />
        <DetailRow label="funding total" value={formatNumber(investor?.total_funding_account)} />
        <DetailRow label="locked total" value={formatNumber(investor?.total_precision_locked_amount)} />
      </article>
      <article className="insight-card">
        <p className="eyebrow">Signal Lens</p>
        <DetailRow label="signal" value={signalProjection?.signal_key || '-'} />
        <DetailRow label="products" value={signalProjection?.product_ids.join(', ') || '-'} />
        <DetailRow label="target net" value={formatNumber(signalProjection?.total_target_position_qty)} />
        <DetailRow label="settled net" value={formatNumber(signalProjection?.total_settled_position_qty)} />
      </article>
      <article className="insight-card">
        <p className="eyebrow">Reconciliation</p>
        <DetailRow label="status" value={reconciliation?.status || '-'} />
        <DetailRow label="difference" value={formatNumber(reconciliation?.difference)} />
        <DetailRow label="tolerance" value={formatNumber(reconciliation?.tolerance)} />
        <DetailRow label="explanation" value={reconciliation?.explanation || '-'} />
      </article>
    </div>
  </article>
);

const EvidenceCard = ({
  formalPrice,
  netting,
  profitTarget,
  quoteIssue,
}: {
  formalPrice?: ReturnType<typeof buildFormalPriceInsight>;
  netting?: ReturnType<typeof buildNettingInsight>;
  profitTarget?: ReturnType<typeof buildProfitTargetInsight>;
  quoteIssue?: ReturnType<typeof buildQuoteIssueInsight>;
}) => (
  <article className="card projection-card evidence-card">
    <div className="section-header">
      <div>
        <p className="eyebrow">Formal Price Evidence</p>
        <h2>quote、netting 与 advisory</h2>
        <p className="subtle">这些证据只读展示，不参与前端提交 gate；正式判断仍以后端 worker 为准。</p>
      </div>
    </div>
    <div className="insight-grid">
      <article className="insight-card">
        <p className="eyebrow">Quote Truth</p>
        <DetailRow label="price" value={formatNumber(formalPrice?.price)} />
        <DetailRow label="source" value={formalPrice?.source || '-'} />
        <DetailRow label="datasource" value={formalPrice?.datasourceId || '-'} />
        <DetailRow label="quote updated" value={formatTime(formalPrice?.quoteUpdatedAt)} />
      </article>
      <article className="insight-card">
        <p className="eyebrow">Internal Netting</p>
        <DetailRow label="signal" value={netting?.signalId || '-'} />
        <DetailRow label="settled qty" value={formatNumber(netting?.settledQty)} />
        <DetailRow label="attribution count" value={String(netting?.attributionCount ?? 0)} />
        <DetailRow label="captured at" value={formatTime(netting?.createdAt)} />
      </article>
      <article className="insight-card">
        <p className="eyebrow">Advisory + Fail-Close</p>
        <DetailRow label="profit target" value={profitTarget?.message || '-'} />
        <DetailRow label="latest alert" value={formatTime(profitTarget?.createdAt)} />
        <DetailRow label="quote issue" value={quoteIssue?.note || '-'} />
        <DetailRow label="issue at" value={formatTime(quoteIssue?.createdAt)} />
      </article>
    </div>
  </article>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="detail-row">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const ProjectionCard = ({ title, value, error }: { title: string; value: unknown; error?: string }) => (
  <article className="card projection-card">
    <div className="section-header">
      <div>
        <p className="eyebrow">Projection</p>
        <h2>{title}</h2>
      </div>
    </div>
    {error ? (
      <div className="notice error">{error}</div>
    ) : (
      <pre className="json-block">{summarizeJson(value ?? {})}</pre>
    )}
  </article>
);

const MockAccountCard = ({
  runtime,
  state,
}: {
  runtime: RuntimeConfig;
  state: ResourceState<MockAccountInfo>;
}) => (
  <article className="card projection-card" data-testid="mock-account-card">
    <div className="section-header">
      <div>
        <p className="eyebrow">Mock Account</p>
        <h2>paper runtime account snapshot</h2>
      </div>
      <div className="pill paper">mock</div>
    </div>
    {state.error ? (
      <div className="notice error">{state.error}</div>
    ) : (
      <>
        <div className="capital-grid">
          <Metric label="balance" value={formatNumber(state.data?.money.balance)} />
          <Metric label="equity" value={formatNumber(state.data?.money.equity)} />
          <Metric label="profit" value={formatNumber(state.data?.money.profit)} />
          <Metric label="free" value={formatNumber(state.data?.money.free)} />
          <Metric label="used" value={formatNumber(state.data?.money.used)} />
          <Metric label="updated" value={formatTime(state.data?.updated_at)} />
        </div>
        <div className="insight-grid">
          <article className="insight-card">
            <p className="eyebrow">Identifiers</p>
            <DetailRow label="runtime account_id" value={runtime.account_id} />
            <DetailRow label="mock account_id" value={state.data?.account_id || '-'} />
            <DetailRow label="currency" value={state.data?.money.currency || '-'} />
          </article>
          <article className="insight-card" data-testid="mock-account-positions">
            <p className="eyebrow">Positions</p>
            {(state.data?.positions || []).map((position) => (
              <div key={position.position_id} style={{ marginBottom: '0.75rem' }}>
                <DetailRow label="product" value={position.product_id} />
                <DetailRow label="direction" value={position.direction || '-'} />
                <DetailRow label="volume" value={formatNumber(position.volume)} />
                <DetailRow label="position_price" value={formatNumber(position.position_price)} />
                <DetailRow label="current_price" value={position.current_price || '-'} />
                <DetailRow label="floating_profit" value={formatNumber(position.floating_profit)} />
              </div>
            ))}
            {!state.data?.positions?.length && <div className="empty-block">暂无持仓</div>}
          </article>
        </div>
      </>
    )}
  </article>
);
