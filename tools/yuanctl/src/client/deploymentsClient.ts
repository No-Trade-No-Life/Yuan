import type { TerminalGateway } from './terminalGateway';
import type { FilterClause } from '../utils/filters';
import { buildWhereClause } from '../utils/filters';
import { DEFAULT_WATCH_POLL_INTERVAL_MS, DEFAULT_WATCH_RETRY_MS, DEPLOYMENT_TABLE } from '../constants';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { defer, map, Observable, repeat, retry, shareReplay } from 'rxjs';
import type { IDeployment } from '@yuants/deploy';

export interface ListOptions {
  filters?: FilterClause[];
  identifier?: { field: 'id' | 'address'; value: string };
  limit?: number;
}

export type RestartStrategy = 'touch' | 'graceful' | 'hard';

export class DeploymentsClient {
  constructor(private readonly gateway: TerminalGateway) {}

  async list(options: ListOptions = {}): Promise<IDeployment[]> {
    const where = buildWhereClause({
      include: options.filters,
      identifierField: options.identifier?.field,
      identifierValue: options.identifier?.value,
    });
    const limitSql = options.limit ? ` LIMIT ${options.limit}` : '';
    const sql = `select * from ${DEPLOYMENT_TABLE} ${where} order by updated_at desc${limitSql}`;
    return requestSQL<IDeployment[]>(this.gateway.terminal, sql);
  }

  async getById(id: string): Promise<IDeployment | undefined> {
    const [deployment] = await this.list({ identifier: { field: 'id', value: id }, limit: 1 });
    return deployment;
  }

  async setEnabled(filters: ListOptions, enabled: boolean): Promise<number> {
    const where = buildWhereClause({
      include: filters.filters,
      identifierField: filters.identifier?.field,
      identifierValue: filters.identifier?.value,
    });
    const sql = `update ${DEPLOYMENT_TABLE} set enabled = ${enabled ? 'true' : 'false'} ${where} returning *`;
    const result = await requestSQL<IDeployment[]>(this.gateway.terminal, sql);
    return result.length;
  }

  async delete(filters: ListOptions): Promise<number> {
    const where = buildWhereClause({
      include: filters.filters,
      identifierField: filters.identifier?.field,
      identifierValue: filters.identifier?.value,
    });
    const sql = `delete from ${DEPLOYMENT_TABLE} ${where} returning id`;
    const result = await requestSQL<Array<{ id: string }>>(this.gateway.terminal, sql);
    return result.length;
  }

  async restart(
    filters: ListOptions,
    strategy: RestartStrategy,
    gracePeriodMs: number = 5_000,
  ): Promise<number> {
    const deployments = await this.list(filters);
    if (deployments.length === 0) {
      return 0;
    }
    if (strategy === 'touch') {
      const ids = deployments.map((d) => escapeSQL(d.id)).join(',');
      const touchSql = `update ${DEPLOYMENT_TABLE} set updated_at = now() where id in (${ids})`;
      await requestSQL(this.gateway.terminal, touchSql);
      return deployments.length;
    }
    const ids = deployments.map((d) => escapeSQL(d.id)).join(',');
    const disableSql = `update ${DEPLOYMENT_TABLE} set enabled = false, updated_at = now() where id in (${ids})`;
    await requestSQL(this.gateway.terminal, disableSql);
    if (strategy === 'graceful' && gracePeriodMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, gracePeriodMs));
    }
    const enableSql = `update ${DEPLOYMENT_TABLE} set enabled = true, updated_at = now() where id in (${ids})`;
    await requestSQL(this.gateway.terminal, enableSql);
    return deployments.length;
  }

  async upsert(deployment: IDeployment): Promise<void> {
    const sql = buildInsertManyIntoTableSQL([deployment], DEPLOYMENT_TABLE, {
      conflictKeys: ['id'],
      columns: ['id', 'package_name', 'package_version', 'command', 'args', 'env', 'address', 'enabled'],
      returningAll: false,
    });
    await requestSQL(this.gateway.terminal, sql);
  }

  watch(options: ListOptions = {}): Observable<IDeployment[]> {
    return defer(() => this.list(options)).pipe(
      repeat({ delay: DEFAULT_WATCH_POLL_INTERVAL_MS }),
      retry({ delay: DEFAULT_WATCH_RETRY_MS }),
      shareReplay(1),
      map((items) => items),
    );
  }
}
