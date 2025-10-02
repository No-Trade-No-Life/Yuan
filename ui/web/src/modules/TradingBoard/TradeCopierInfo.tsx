import { Space, Spin, Tag } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { IPosition } from '@yuants/data-account';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { memo, useEffect, useMemo } from 'react';
import { EMPTY, Observable, pipe, startWith, switchMap } from 'rxjs';
import { InlineAccountId, useAccountInfo } from '../AccountInfo';
import { IAccountComposerConfig } from '../AccountComposition/interface';
import { Button, DataView } from '../Interactive';
import { terminal$ } from '../Network';
import { ITradeCopierConfig } from '../TradeCopier/interface';
import { InlineProductId } from '../Products/InlineProductId';

const columnHelper = createColumnHelper<ITradeCopierComparisonRow>();

const EPSILON_VOLUME = 1e-6;
const EPSILON_PRICE = 1e-6;

const trimTrailingZeros = (input: string) => input.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
const formatVolume = (value: number, digits = 4) => trimTrailingZeros(value.toFixed(digits));
const formatPrice = (value: number, digits = 6) => trimTrailingZeros(value.toFixed(digits));
const formatAmount = (value: number, digits = 2) => trimTrailingZeros(value.toFixed(digits));
const formatSigned = (value: number, digits = 4, epsilon = EPSILON_VOLUME) => {
  if (Math.abs(value) < epsilon) return '0';
  const prefix = value > 0 ? '+' : '-';
  return `${prefix}${trimTrailingZeros(Math.abs(value).toFixed(digits))}`;
};

const useSQLQuery = function <T>(query: string | undefined, refresh$: Observable<void>): T | undefined {
  return useObservableState(
    useObservable(
      pipe(
        switchMap(([sql]) => {
          if (!sql) return EMPTY;
          return refresh$.pipe(
            startWith(void 0),
            switchMap(() =>
              terminal$.pipe(
                switchMap((terminal) => {
                  if (!terminal) return EMPTY;
                  return requestSQL<T>(terminal, sql);
                }),
              ),
            ),
          );
        }),
      ),
      [query],
    ),
  );
};

type PositionKey = {
  datasourceId?: string;
  productId: string;
};

type PositionSummary = PositionKey & {
  key: string;
  volume: number;
  avgPrice?: number;
  floatingProfit: number;
};

type PositionSummaryInternal = PositionSummary & {
  priceVolumeSum: number;
  totalAbsVolume: number;
};

const serializeKey = (key: PositionKey) => JSON.stringify(key);
const deserializeKey = (key: string): PositionKey => JSON.parse(key) as PositionKey;

const createPositionSummaryMap = (positions?: IPosition[]) => {
  const map = new Map<string, PositionSummaryInternal>();
  positions?.forEach((position) => {
    const keyObj: PositionKey = {
      datasourceId: position.datasource_id ?? undefined,
      productId: position.product_id,
    };
    const key = serializeKey(keyObj);
    const floating = position.floating_profit ?? 0;
    const price = typeof position.position_price === 'number' ? position.position_price : undefined;
    const rawVolume = typeof position.volume === 'number' ? position.volume : 0;
    const signedVolume = (position.direction === 'SHORT' ? -1 : 1) * rawVolume;
    const absVolume = Math.abs(signedVolume);

    const prev = map.get(key);
    const nextVolume = (prev?.volume ?? 0) + signedVolume;
    const nextFloating = (prev?.floatingProfit ?? 0) + floating;
    const prevPriceVolumeSum = prev?.priceVolumeSum ?? 0;
    const prevTotalAbsVolume = prev?.totalAbsVolume ?? 0;
    const priceVolumeSum = prevPriceVolumeSum + (price !== undefined ? price * absVolume : 0);
    const totalAbsVolume = prevTotalAbsVolume + absVolume;
    const avgPrice = totalAbsVolume > EPSILON_VOLUME ? priceVolumeSum / totalAbsVolume : undefined;
    map.set(key, {
      key,
      volume: nextVolume,
      floatingProfit: nextFloating,
      avgPrice,
      priceVolumeSum,
      totalAbsVolume,
      ...keyObj,
    });
  });
  return map;
};

const getDirectionLabel = (volume: number) => {
  if (volume > EPSILON_VOLUME) return 'LONG';
  if (volume < -EPSILON_VOLUME) return 'SHORT';
  return 'FLAT';
};

const formatPositionSummary = (summary?: PositionSummary) => {
  if (!summary || summary.volume === undefined) return '-';
  const direction = getDirectionLabel(summary.volume);
  const volumeLabel = formatVolume(Math.abs(summary.volume));
  const priceLabel = summary.avgPrice !== undefined ? formatPrice(summary.avgPrice) : '-';
  const floatingLabel = formatAmount(summary.floatingProfit ?? 0);
  return `${direction} ${volumeLabel} @ ${priceLabel} | 浮盈 ${floatingLabel}`;
};

type DiffResult = {
  text: string;
  matched: boolean;
};

type StrategyBaseWithSlippage =
  | (ITradeCopierConfig['strategy']['global'] & { open_slippage?: number })
  | undefined;

type StrategyDescription = {
  text: string;
  openSlippage?: number;
};

const describeStrategyForProduct = (config?: ITradeCopierConfig, key?: PositionKey): StrategyDescription => {
  if (!config || !config.strategy || !key) return { text: '-' };
  const overrides = (config.strategy.product_overrides || {}) as Record<string, StrategyBaseWithSlippage>;
  const base = overrides[key.productId] ?? (config.strategy.global as StrategyBaseWithSlippage);
  if (!base) return { text: '-' };
  const parts: string[] = [];
  if (base.type) parts.push(`策略:${base.type}`);
  if (typeof base.max_volume === 'number') parts.push(`MaxVol:${formatPrice(base.max_volume, 2)}`);
  if (typeof base.open_slippage === 'number')
    parts.push(`滑点:${trimTrailingZeros((base.open_slippage * 100).toFixed(2))}%`);
  return {
    text: parts.join(' '),
    openSlippage: base.open_slippage,
  };
};

const buildPreviewDiff = (expected?: PositionSummary, preview?: PositionSummary): DiffResult => {
  if (!expected && !preview) return { text: '-', matched: true };
  const notes: string[] = [];
  let matched = true;
  if (!expected) {
    notes.push('缺少预期持仓');
    matched = false;
  }
  if (!preview) {
    notes.push('缺少预览持仓');
    matched = false;
  }
  if (expected && preview) {
    const volumeDiff = preview.volume - expected.volume;
    if (Math.abs(volumeDiff) > EPSILON_VOLUME) {
      notes.push(`数量偏差 ${formatSigned(volumeDiff)}`);
      matched = false;
    } else {
      notes.push('数量匹配');
    }
    if (expected.avgPrice !== undefined && preview.avgPrice !== undefined) {
      const priceDiff = preview.avgPrice - expected.avgPrice;
      if (Math.abs(priceDiff) > EPSILON_PRICE) {
        notes.push(`价格差 ${formatSigned(priceDiff, 4, EPSILON_PRICE)}`);
        matched = false;
      } else {
        notes.push('价格匹配');
      }
    } else {
      notes.push('价格信息缺失');
      matched = false;
    }
  }
  return { text: notes.join('；'), matched };
};

const buildActualDiff = (
  preview?: PositionSummary,
  actual?: PositionSummary,
  openSlippage?: number,
): DiffResult => {
  if (!preview && !actual) return { text: '-', matched: true };
  const notes: string[] = [];
  let matched = true;
  if (!preview) {
    notes.push('缺少预览持仓');
    matched = false;
  }
  if (!actual) {
    notes.push('实际未持仓');
    matched = false;
  }
  if (preview && actual) {
    const volumeDiff = actual.volume - preview.volume;
    if (Math.abs(volumeDiff) > EPSILON_VOLUME) {
      notes.push(`数量偏差 ${formatSigned(volumeDiff)}`);
      matched = false;
    } else {
      notes.push('数量匹配');
    }
    if (preview.avgPrice !== undefined && actual.avgPrice !== undefined) {
      const priceDiff = actual.avgPrice - preview.avgPrice;
      if (typeof openSlippage === 'number' && preview.avgPrice !== 0) {
        const tolerance = Math.abs(preview.avgPrice * openSlippage);
        if (Math.abs(priceDiff) > tolerance + EPSILON_PRICE) {
          notes.push(
            `价格偏差 ${formatSigned(priceDiff, 4, EPSILON_PRICE)} 超出 ±${formatPrice(tolerance, 4)}`,
          );
          matched = false;
        } else {
          notes.push(`价格在滑点 ±${trimTrailingZeros((openSlippage * 100).toFixed(2))}% 内`);
        }
      } else if (Math.abs(priceDiff) > EPSILON_PRICE) {
        notes.push(`价格差 ${formatSigned(priceDiff, 4, EPSILON_PRICE)}`);
        matched = false;
      } else {
        notes.push('价格匹配');
      }
    } else {
      notes.push('价格信息缺失');
      matched = false;
    }
  }
  return { text: notes.join('；'), matched };
};

interface ITradeCopierComparisonRow {
  key: string;
  datasourceId?: string;
  productId: string;
  expected?: PositionSummary;
  preview?: PositionSummary;
  actual?: PositionSummary;
  tradeConfigText: string;
  previewDiff: DiffResult;
  actualDiff: DiffResult;
}

const columns = [
  columnHelper.accessor('productId', {
    header: () => '品种',
    cell: (ctx) => {
      const row = ctx.row.original;
      const directionSummary = row.preview ?? row.expected ?? row.actual;
      const direction = directionSummary ? getDirectionLabel(directionSummary.volume) : 'FLAT';
      return (
        <Space>
          {row.datasourceId ? (
            <InlineProductId datasource_id={row.datasourceId} product_id={ctx.getValue()} />
          ) : (
            ctx.getValue()
          )}
          <Tag size="small">{direction}</Tag>
        </Space>
      );
    },
  }),
  columnHelper.display({
    id: 'expected',
    header: () => '预期账户',
    cell: (ctx) => formatPositionSummary(ctx.row.original.expected),
  }),
  columnHelper.display({
    id: 'preview',
    header: () => '预览账户',
    cell: (ctx) => formatPositionSummary(ctx.row.original.preview),
  }),
  columnHelper.accessor('previewDiff', {
    header: () => '预览差异',
    cell: (ctx) => (
      <span style={{ color: ctx.getValue().matched ? undefined : 'var(--semi-color-danger)' }}>
        {ctx.getValue().text}
      </span>
    ),
  }),
  columnHelper.display({
    id: 'actual',
    header: () => '实际账户',
    cell: (ctx) => formatPositionSummary(ctx.row.original.actual),
  }),
  columnHelper.accessor('tradeConfigText', {
    header: () => '跟单配置',
    cell: (ctx) => ctx.getValue(),
  }),
  columnHelper.accessor('actualDiff', {
    header: () => '实际差异',
    cell: (ctx) => (
      <span style={{ color: ctx.getValue().matched ? undefined : 'var(--semi-color-danger)' }}>
        {ctx.getValue().text}
      </span>
    ),
  }),
];

export const TradeCopierInfo = memo((props: { accountId: string }) => {
  const { accountId } = props;
  const previewAccountId = useMemo(() => `TradeCopier/Preview/${accountId}`, [accountId]);
  const expectedAccountId = useMemo(() => `TradeCopier/Expected/${accountId}`, [accountId]);

  const [, refresh$] = useObservableRef<void>();

  useEffect(() => {
    refresh$.next();
  }, [accountId, refresh$]);

  const tradeCopierConfigList = useSQLQuery<ITradeCopierConfig[]>(
    accountId ? `select * from trade_copier_config where account_id=${escapeSQL(accountId)}` : undefined,
    refresh$,
  );
  const tradeCopierConfig = tradeCopierConfigList?.[0];

  const previewComposerConfigList = useSQLQuery<IAccountComposerConfig[]>(
    previewAccountId
      ? `select * from account_composer_config where account_id=${escapeSQL(previewAccountId)}`
      : undefined,
    refresh$,
  );
  const previewComposerConfig = previewComposerConfigList?.[0];

  const expectedComposerConfigList = useSQLQuery<IAccountComposerConfig[]>(
    expectedAccountId
      ? `select * from account_composer_config where account_id=${escapeSQL(expectedAccountId)}`
      : undefined,
    refresh$,
  );
  const expectedComposerConfig = expectedComposerConfigList?.[0];

  const composerConfigMatched = useMemo(() => {
    if (!previewComposerConfig || !expectedComposerConfig) return undefined;
    const pickComparable = (config: IAccountComposerConfig) => ({
      enabled: config.enabled,
      sources: config.sources,
    });
    return (
      JSON.stringify(pickComparable(previewComposerConfig)) ===
      JSON.stringify(pickComparable(expectedComposerConfig))
    );
  }, [previewComposerConfig, expectedComposerConfig]);

  const actualAccount$ = useMemo(() => useAccountInfo(accountId), [accountId]);
  const previewAccount$ = useMemo(() => useAccountInfo(previewAccountId), [previewAccountId]);
  const expectedAccount$ = useMemo(() => useAccountInfo(expectedAccountId), [expectedAccountId]);

  const actualAccountInfo = useObservableState(actualAccount$);
  const previewAccountInfo = useObservableState(previewAccount$);
  const expectedAccountInfo = useObservableState(expectedAccount$);

  const actualPositions = useMemo(
    () => createPositionSummaryMap(actualAccountInfo?.positions),
    [actualAccountInfo?.positions],
  );
  const previewPositions = useMemo(
    () => createPositionSummaryMap(previewAccountInfo?.positions),
    [previewAccountInfo?.positions],
  );
  const expectedPositions = useMemo(
    () => createPositionSummaryMap(expectedAccountInfo?.positions),
    [expectedAccountInfo?.positions],
  );

  const comparisonRows = useMemo(() => {
    const rows: ITradeCopierComparisonRow[] = [];
    expectedPositions.forEach((expected) => {
      if (!expected || Math.abs(expected.volume) <= EPSILON_VOLUME) return;
      const keyInfo = deserializeKey(expected.key);
      const preview = previewPositions.get(expected.key);
      const actual = actualPositions.get(expected.key);
      const strategyDesc = describeStrategyForProduct(tradeCopierConfig, keyInfo);
      rows.push({
        key: expected.key,
        productId: keyInfo.productId,
        datasourceId: keyInfo.datasourceId,
        expected,
        preview,
        actual,
        previewDiff: buildPreviewDiff(expected, preview),
        tradeConfigText: strategyDesc.text,
        actualDiff: buildActualDiff(preview, actual, strategyDesc.openSlippage),
      });
    });

    return rows.sort((a, b) => {
      if (a.datasourceId && b.datasourceId && a.datasourceId !== b.datasourceId) {
        return a.datasourceId.localeCompare(b.datasourceId);
      }
      if (a.productId !== b.productId) return a.productId.localeCompare(b.productId);
      const directionA = getDirectionLabel((a.preview ?? a.expected ?? a.actual)?.volume ?? 0);
      const directionB = getDirectionLabel((b.preview ?? b.expected ?? b.actual)?.volume ?? 0);
      return directionA.localeCompare(directionB);
    });
  }, [actualPositions, expectedPositions, previewPositions, tradeCopierConfig]);

  const isLoading =
    tradeCopierConfigList === undefined ||
    previewComposerConfigList === undefined ||
    expectedComposerConfigList === undefined ||
    actualAccountInfo === undefined ||
    previewAccountInfo === undefined ||
    expectedAccountInfo === undefined;

  if (!accountId) {
    return null;
  }

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space align="center">
        <span>
          主账户: <InlineAccountId account_id={accountId} />
        </span>
        <span>
          预览账户: <InlineAccountId account_id={previewAccountId} />
        </span>
        <span>
          预期账户: <InlineAccountId account_id={expectedAccountId} />
        </span>
        {composerConfigMatched === undefined ? (
          <Tag color="purple">配置数据缺失</Tag>
        ) : composerConfigMatched ? (
          <Tag color="green">预览配置已同步到预期账户</Tag>
        ) : (
          <Tag color="orange">预览与预期配置不一致</Tag>
        )}
        <Button onClick={() => refresh$.next()}>刷新配置</Button>
      </Space>
      {isLoading ? <Spin tip="加载中..." /> : <DataView data={comparisonRows} columns={columns} />}
    </Space>
  );
});
