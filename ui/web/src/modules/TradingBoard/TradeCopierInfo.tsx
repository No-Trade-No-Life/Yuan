import { Divider, Space, Spin, Tag } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { IPosition } from '@yuants/data-account';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { memo, useEffect, useMemo } from 'react';
import { EMPTY, Observable, pipe, startWith, switchMap } from 'rxjs';
import { InlineAccountId, useAccountInfo } from '../AccountInfo';
import { schemaOfAccountComposerConfig } from '../AccountComposition';
import { IAccountComposerConfig } from '../AccountComposition/interface';
import { showForm } from '../Form';
import { Button, DataView, Switch, Toast } from '../Interactive';
import { terminal$ } from '../Network';
import { useTerminal } from '../Terminals';
import { ITradeCopierConfig } from '../TradeCopier/interface';
import { schemaOfTradeCopierConfig } from '../TradeCopier/schema';
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

type TradeCopierConfigState =
  | ITradeCopierConfig
  | {
      account_id: string;
      enabled?: boolean;
      strategy?: ITradeCopierConfig['strategy'];
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
  return `${direction} | ${volumeLabel} | ${priceLabel} | 浮盈:${floatingLabel}`;
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

  const tradeCopierConfigList = useSQLQuery<ITradeCopierConfig[]>(
    accountId ? `select * from trade_copier_config where account_id=${escapeSQL(accountId)}` : undefined,
    refresh$,
  );
  const tradeCopierConfig: TradeCopierConfigState | undefined = tradeCopierConfigList
    ? tradeCopierConfigList[0] || { account_id: accountId }
    : undefined;

  const terminal = useTerminal();

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

  const handleToggleEnabled = async (value: boolean) => {
    if (!terminal || !tradeCopierConfig) return;
    try {
      const nextConfig = {
        ...(tradeCopierConfig as Record<string, unknown>),
        account_id: accountId,
        enabled: value,
      };
      await requestSQL(
        terminal,
        buildInsertManyIntoTableSQL([nextConfig], 'trade_copier_config', {
          conflictKeys: ['account_id'],
        }),
      );
      Toast.success('更新成功');
      refresh$.next();
    } catch (err) {
      console.error(err);
      Toast.error('更新失败');
    }
  };

  const handleEditPreviewAccount = async () => {
    if (!terminal) return;
    try {
      const data = await requestSQL<IAccountComposerConfig[]>(
        terminal,
        `select * from account_composer_config where account_id=${escapeSQL(previewAccountId)}`,
      );
      const nextConfig = await showForm<IAccountComposerConfig>(
        schemaOfAccountComposerConfig,
        data[0] || { account_id: previewAccountId },
      );
      if (!nextConfig) return;
      await requestSQL(
        terminal,
        buildInsertManyIntoTableSQL([nextConfig], 'account_composer_config', {
          conflictKeys: ['account_id'],
        }),
      );
      Toast.success('编辑预览账户成功');
      refresh$.next();
    } catch (err) {
      console.error(err);
      Toast.error('编辑预览账户失败');
    }
  };

  const handleEditStrategy = async () => {
    if (!terminal || !tradeCopierConfig) return;
    try {
      const nextConfig = await showForm<ITradeCopierConfig>(
        schemaOfTradeCopierConfig,
        tradeCopierConfig as ITradeCopierConfig,
      );
      if (!nextConfig) return;
      await requestSQL(
        terminal,
        buildInsertManyIntoTableSQL([nextConfig], 'trade_copier_config', {
          conflictKeys: ['account_id'],
        }),
      );
      Toast.success('编辑跟单配置成功');
      refresh$.next();
    } catch (err) {
      console.error(err);
      Toast.error('编辑跟单配置失败');
    }
  };

  const handlePublish = async () => {
    if (!terminal) return;
    try {
      const data = await requestSQL<IAccountComposerConfig[]>(
        terminal,
        `select * from account_composer_config where account_id=${escapeSQL(previewAccountId)}`,
      );
      if (data.length === 0) {
        Toast.error('预览账户不存在，请先编辑预览账户');
        return;
      }
      const nextRecords = data.map((item) => ({ ...item, account_id: expectedAccountId }));
      await requestSQL(
        terminal,
        buildInsertManyIntoTableSQL(nextRecords, 'account_composer_config', {
          conflictKeys: ['account_id'],
        }),
      );
      Toast.success('发布成功');
      refresh$.next();
    } catch (err) {
      console.error(err);
      Toast.error('发布失败');
    }
  };

  const handleRefresh = () => {
    refresh$.next();
  };

  const actionsDisabled = tradeCopierConfigList === undefined || !terminal;
  const currentEnabled = !!(tradeCopierConfig && (tradeCopierConfig as { enabled?: boolean }).enabled);

  const actionTopSlot = (
    <Space wrap align="center">
      <Space align="center">
        <Switch checked={currentEnabled} disabled={actionsDisabled} onChange={handleToggleEnabled} />
        启用跟单
      </Space>
      <Button disabled={!terminal} onClick={handleEditPreviewAccount}>
        配置预览账户
      </Button>
      <Button disabled={actionsDisabled} onClick={handleEditStrategy}>
        修改跟单策略
      </Button>
      <Button
        type="danger"
        disabled={actionsDisabled}
        doubleCheck={{
          title: '发布上线: 将预览账户的数据覆盖预期账户',
          description:
            '交易跟单器会自动跟随预期账户进行跟单，请确保预览账户配置正确且可用。设置不当可能会导致错误的交易订单，造成资金损失。',
        }}
        onClick={handlePublish}
      >
        发布上线
      </Button>
      <Button onClick={handleRefresh}>刷新配置</Button>
      {composerConfigMatched === undefined ? (
        <Tag color="purple">配置数据缺失</Tag>
      ) : composerConfigMatched ? (
        <Tag color="green">预览配置已同步到预期账户</Tag>
      ) : (
        <Tag color="orange">预览与预期配置不一致</Tag>
      )}
    </Space>
  );

  const comparisonRows = useMemo(() => {
    const keySet = new Set<string>();
    [actualPositions, previewPositions, expectedPositions].forEach((map) => {
      map.forEach((value) => keySet.add(value.key));
    });
    const rows: ITradeCopierComparisonRow[] = [];
    keySet.forEach((key) => {
      //   if (!expected || Math.abs(expected.volume) <= EPSILON_VOLUME) return;
      const keyInfo = deserializeKey(key);
      const preview = previewPositions.get(key);
      const expected = expectedPositions.get(key);
      const actual = actualPositions.get(key);
      const strategyDesc = describeStrategyForProduct(
        tradeCopierConfig as ITradeCopierConfig | undefined,
        keyInfo,
      );
      rows.push({
        key: key,
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
    <Space vertical align="start" style={{ width: '100%', height: '100%' }}>
      {actionTopSlot}
      <Divider />
      {isLoading ? (
        <Space align="center" style={{ alignSelf: 'center' }}>
          <Spin />
        </Space>
      ) : (
        <DataView data={comparisonRows} columns={columns} />
      )}
    </Space>
  );
});
