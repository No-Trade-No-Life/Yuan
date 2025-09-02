import { Terminal } from '@yuants/protocol';
import { ExecuteMigrations, requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import fs from 'fs';
import path from 'path';
import { debounceTime, defer, groupBy, map, mergeMap, repeat, retry, Subject, tap, toArray } from 'rxjs';
import YAML from 'yaml';
import './migration';
import { IPrometheusRule, IRawPrometheusRuleGroup } from './models';

interface IPrometheusRuleGroup {
  name: string;
  rules: IPrometheusRule[];
}

const terminal = Terminal.fromNodeEnv();

ExecuteMigrations(terminal);

const makeRuleFileFormat = (group: IPrometheusRuleGroup): IRawPrometheusRuleGroup => {
  return {
    name: group.name,
    rules: group.rules.map((rule) => ({
      // alerting rule fields
      alert: rule.type === 'alerting' ? rule.name : undefined,
      expr: rule.expr,
      for: rule.alert_for,
      keep_firing_for: rule.alert_keep_firing_for,
      labels: rule.labels,
      annotations: rule.annotations,

      // recording rule fields
      record: rule.type === 'recording' ? rule.record : undefined,
    })),
  };
};

const reloadPrometheusAction$ = new Subject<string>();

reloadPrometheusAction$
  .pipe(
    //
    debounceTime(1000),
    mergeMap((url) =>
      defer(async () => {
        const response = await fetch(`${url}/-/reload`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`Failed to reload Prometheus: ${response.status} ${response.statusText}`);
        }
        return void 0;
      }).pipe(
        //
        tap({
          next: () => {
            console.info(formatTime(Date.now()), 'PrometheusReloaded');
          },
          error: (e) => {
            console.error(formatTime(Date.now()), 'PrometheusReloadFaild', e);
          },
        }),
        retry({ count: 3, delay: 1000 }),
      ),
    ),
  )
  .subscribe(() => {});

/**
 * 协调 Prometheus 规则：从数据库读取规则并同步到文件系统和 Prometheus
 *
 * 该函数会：
 * 1. 定期从数据库查询所有 Prometheus 规则
 * 2. 按规则组名称对规则进行分组
 * 3. 监控规则变化，当规则发生变化时自动更新对应的 YAML 文件
 * 4. 触发 Prometheus 重新加载配置
 *
 * @param configDirPath - Prometheus 规则文件的输出目录路径
 *                        函数会在此目录下为每个规则组创建对应的 .yml 文件
 * @param prometheusURL - Prometheus 服务器的 URL（包括协议和端口）
 *                        用于调用 /-/reload 端点重新加载配置
 * @returns - 返回一个 Observable，发出规则组数组
 *            每当数据库中的规则发生变化时会发出新的值
 *
 * @example
 * ```typescript
 * // 监控数据库中的规则变化，并同步到 /etc/prometheus/rules 目录
 * reconcile('/etc/prometheus/rules', 'http://localhost:9090')
 *   .subscribe(groups => {
 *     console.log(`同步了 ${groups.length} 个规则组`);
 *   });
 * ```
 *
 * @remarks
 * - 函数会每 10 秒查询一次数据库
 * - 使用 listWatch 模式，只有当规则内容发生实际变化时才会触发文件写入和 Prometheus 重载
 * - 如果数据库查询失败，会自动重试（延迟 10 秒）
 * - Prometheus 重载失败会重试最多 3 次（每次延迟 1 秒）
 * - 生成的 YAML 文件名格式为 `{规则组名称}.yml`
 *
 * @public
 */
export const reconcile = (configDirPath: string, prometheusURL: string) => {
  return defer(() => requestSQL<IPrometheusRule[]>(terminal, `select * from prometheus_rule`)).pipe(
    // pre processing data, group rules by rule group name
    mergeMap((rules) => rules),
    groupBy((rule) => rule.group_name),
    mergeMap((group) =>
      group.pipe(
        //
        toArray(),
        map((v) => ({
          name: group.key,
          rules: v.sort((a, b) => a.name.localeCompare(b.name)),
        })),
      ),
    ),
    toArray(),

    repeat({ delay: 10_000 }),
    retry({ delay: 10_000 }),

    // list watch group, overwrite if rules in db has changed
    listWatch(
      // to determin if rule has changed
      (group) => group.name + group.rules.map((v) => JSON.stringify(v)).join('\n'),
      (group) =>
        defer(async () => {
          // 1. make file content
          const ruleFileContent = makeRuleFileFormat(group);
          const yamlObject = {
            groups: [ruleFileContent],
          };
          const yamlContent = YAML.stringify(JSON.parse(JSON.stringify(yamlObject)));

          // 2. write to file according to it's rule name
          const filePath = path.join(configDirPath, `${group.name}.yml`);
          await fs.promises.writeFile(filePath, yamlContent, 'utf8');

          // 3. reload prometheus /-/reload endpoint
          reloadPrometheusAction$.next(prometheusURL);

          return void 0;
        }),
    ),
  );
};
