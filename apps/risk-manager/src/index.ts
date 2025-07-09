import { IDataRecordTypes, UUID, formatTime, getDataRecordSchema } from '@yuants/data-model';
import { PromRegistry } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import { buildInsertManyIntoTableSQL, escape, requestSQL } from '@yuants/sql';
import { ITransferOrder } from '@yuants/transfer';
import '@yuants/transfer/lib/services';
import Ajv from 'ajv';
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
import { terminal } from './terminal';
import { generateCandidateTransfer } from './utils/generateCandidateTransfer';
import { resolveRiskState } from './utils/resolveRiskState';
import { useAccountInfo } from '@yuants/data-account';

const MetricActiveDemand = PromRegistry.create('gauge', 'risk_manager_active_demand');
const MetricPassiveDemand = PromRegistry.create('gauge', 'risk_manager_passive_demand');
const MetricActiveSupply = PromRegistry.create('gauge', 'risk_manager_active_supply');
const MetricPassiveSupply = PromRegistry.create('gauge', 'risk_manager_passive_supply');

function mapRiskInfoToState$(riskInfo: IDataRecordTypes['account_risk_info']) {
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
        MetricActiveSupply.set(state.active_supply, labels);
      } else {
        MetricActiveSupply.reset(labels);
      }
      if (!Number.isNaN(state.passive_supply)) {
        MetricPassiveSupply.set(state.passive_supply, labels);
      } else {
        MetricPassiveSupply.reset(labels);
      }
      if (!Number.isNaN(state.active_demand)) {
        MetricActiveDemand.set(state.active_demand, labels);
      } else {
        MetricActiveDemand.reset(labels);
      }
      if (!Number.isNaN(state.passive_demand)) {
        MetricPassiveDemand.set(state.passive_demand, labels);
      } else {
        MetricPassiveDemand.reset(labels);
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
                      `SELECT * FROM transfer_order WHERE order_id = ${escape(transfer_order.order_id)}`,
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
