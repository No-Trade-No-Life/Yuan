import { useAccountInfo } from '@yuants/data-account';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { ITransferOrder } from '@yuants/transfer';
import { UUID, formatTime } from '@yuants/utils';
import {
  combineLatest,
  defer,
  delayWhen,
  filter,
  first,
  from,
  groupBy,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';
import { IAccountRiskInfo } from './models';
import { generateCandidateTransfer } from './utils/generateCandidateTransfer';
import { resolveRiskState } from './utils/resolveRiskState';
const terminal = Terminal.fromNodeEnv();
const MetricActiveDemand = GlobalPrometheusRegistry.gauge('risk_manager_active_demand', '');
const MetricPassiveDemand = GlobalPrometheusRegistry.gauge('risk_manager_passive_demand', '');
const MetricActiveSupply = GlobalPrometheusRegistry.gauge('risk_manager_active_supply', '');
const MetricPassiveSupply = GlobalPrometheusRegistry.gauge('risk_manager_passive_supply', '');

function mapRiskInfoToState$(riskInfo: IAccountRiskInfo) {
  const labels = {
    account_id: riskInfo.account_id,
    group_id: riskInfo.group_id,
    currency: riskInfo.currency,
  };
  return defer(() => useAccountInfo(terminal, riskInfo.account_id)).pipe(
    //
    map((x) => resolveRiskState(riskInfo, x)),
    tap((state) => {
      if (!Number.isNaN(state.active_supply)) {
        MetricActiveSupply.labels(labels).set(state.active_supply);
      } else {
        // NOTE: GlobalPrometheusRegistry doesn't have reset, so we set to 0 instead
        MetricActiveSupply.labels(labels).set(0);
      }
      if (!Number.isNaN(state.passive_supply)) {
        MetricPassiveSupply.labels(labels).set(state.passive_supply);
      } else {
        MetricPassiveSupply.labels(labels).set(0);
      }
      if (!Number.isNaN(state.active_demand)) {
        MetricActiveDemand.labels(labels).set(state.active_demand);
      } else {
        MetricActiveDemand.labels(labels).set(0);
      }
      if (!Number.isNaN(state.passive_demand)) {
        MetricPassiveDemand.labels(labels).set(state.passive_demand);
      } else {
        MetricPassiveDemand.labels(labels).set(0);
      }
    }),
  );
}

// const ajv = new Ajv({ strict: false });
// const validator = ajv.compile(getDataRecordSchema('account_risk_info')!);

const configs$ = defer(() =>
  requestSQL<IAccountRiskInfo[]>(terminal, `SELECT * FROM account_risk_info`),
).pipe(
  mergeMap((x) => x),
  filter((x) => !x.disabled),
  // filter((x) => validator(x)),
  toArray(),
  retry({ delay: 5000 }),
  shareReplay(1),
);

defer(() => configs$)
  .pipe(
    mergeMap((x) => x),
    tap((x) => {
      // Keep AccountInfo in subscription
      from(useAccountInfo(terminal, x.account_id)).subscribe();
    }),
    groupBy((x) => x.currency),
    mergeMap((groupByCurrency) =>
      groupByCurrency.pipe(
        groupBy((x) => x.group_id),
        mergeMap((groupByGroup) =>
          groupByGroup.pipe(
            toArray(),
            mergeMap((x) =>
              defer(() => combineLatest(x.map((riskInfo) => mapRiskInfoToState$(riskInfo)))).pipe(
                first(),
                tap((list) => {
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'decision stage',
                    list.length,
                  );
                  console.table(list);
                }),
                mergeMap(generateCandidateTransfer),
                filter((x): x is Exclude<typeof x, undefined> => !!x),
                first((x) => x.amount > 0),
                tap((x) =>
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'transfer',
                    JSON.stringify(x),
                  ),
                ),
                map(
                  (x): ITransferOrder => ({
                    order_id: UUID(),
                    created_at: formatTime(Date.now()),
                    updated_at: formatTime(Date.now()),
                    credit_account_id: x.credit,
                    debit_account_id: x.debit,
                    expected_amount: x.amount,
                    currency: x.currency,
                    status: 'INIT',
                  }),
                ),
                delayWhen((order) =>
                  from(
                    //
                    requestSQL(terminal, buildInsertManyIntoTableSQL([order], 'transfer_order')),
                  ),
                ),
                tap((x) =>
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'transfer order created',
                    JSON.stringify(x),
                  ),
                ),
                delayWhen((transfer_order) =>
                  defer(() =>
                    requestSQL<ITransferOrder[]>(
                      terminal,
                      `SELECT * FROM transfer_order WHERE order_id = ${escapeSQL(transfer_order.order_id)}`,
                    ),
                  ).pipe(
                    //
                    mergeMap((records) => {
                      if (records.length === 0) {
                        throw new Error(`Transfer Order ${transfer_order.order_id} not found`);
                      }
                      const record = records[0];
                      if (!['ERROR', 'COMPLETE'].includes(record.status)) {
                        throw new Error(`Transfer Order ${transfer_order.order_id} failed`);
                      }
                      return of(void 0);
                    }),
                    retry({ delay: 1000 }),
                  ),
                ),
                tap((x) =>
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'transfer order finished',
                    JSON.stringify(x),
                  ),
                ),
                repeat({ delay: 1000 }),
                retry({ delay: 1000 }),
              ),
            ),
          ),
        ),
      ),
    ),
  )
  .subscribe();
