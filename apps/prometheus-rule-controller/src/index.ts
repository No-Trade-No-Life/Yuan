import * as k8s from '@kubernetes/client-node';
import { Terminal } from '@yuants/protocol';
import { ExecuteMigrations, requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import fs from 'fs';
import path from 'path';
import {
  catchError,
  debounceTime,
  defer,
  EMPTY,
  groupBy,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  Subject,
  tap,
  toArray,
} from 'rxjs';
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

interface PrometheusRule extends k8s.KubernetesObject {
  spec: {
    groups: Array<{
      name: string;
      rules: Array<{
        alert?: string;
        expr: string;
        for?: string;
        keep_firing_for?: string;
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
        record?: string;
      }>;
    }>;
  };
}

const makeRulePrometheusK8sOperatorFormat = (group: IPrometheusRuleGroup): PrometheusRule => {
  return {
    apiVersion: 'monitoring.coreos.com/v1',
    kind: 'PrometheusRule',
    metadata: {
      name: group.name,
      namespace: 'yuan',
      labels: {
        'y.ntnl.io/owner': 'prometheus-rule-controller',
      },
    },
    spec: {
      groups: [
        {
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
        },
      ],
    },
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
        catchError((e) => {
          return EMPTY;
        }),
      ),
    ),
  )
  .subscribe(() => {});

const prometheusRuleGroup$ = defer(() =>
  requestSQL<IPrometheusRule[]>(terminal, `select * from prometheus_rule`),
).pipe(
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
  shareReplay(1),
);

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
  return prometheusRuleGroup$.pipe(
    // list watch group, overwrite if rules in db has changed
    listWatch(
      // to determin if rule has changed
      (group) => group.name,
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
      (a, b) =>
        a.name + a.rules.map((v) => JSON.stringify(v)).join('\n') ===
        b.name + b.rules.map((v) => JSON.stringify(v)).join('\n'),
    ),
  );
};

/**
 * 协调 Prometheus 规则到 Kubernetes 集群：从数据库读取规则并同步到 K8s PrometheusRule 资源
 *
 * 该函数会：
 * 1. 定期从数据库查询所有 Prometheus 规则
 * 2. 按规则组名称对规则进行分组
 * 3. 监控规则变化，当规则发生变化时自动创建或更新对应的 PrometheusRule 资源
 * 4. 通过 Prometheus Operator 自动管理规则的生效
 *
 * @param kubeConfigPath - 可选的 kubeconfig 文件路径
 *                         如果提供，将使用指定的 kubeconfig 文件连接集群
 *                         如果不提供，将尝试使用集群内服务账户或默认的 ~/.kube/config
 * @returns - 返回一个 Observable，发出规则组数组
 *            每当数据库中的规则发生变化时会发出新的值
 *
 * @example
 * ```typescript
 * // 使用默认 kubeconfig（fromCluster 或 ~/.kube/config）
 * reconcileK8s()
 *   .subscribe(groups => {
 *     console.log(`同步了 ${groups.length} 个规则组到 K8s 集群`);
 *   });
 *
 * // 使用指定的 kubeconfig 文件
 * reconcileK8s('/path/to/custom/kubeconfig')
 *   .subscribe(groups => {
 *     console.log(`使用自定义配置同步了 ${groups.length} 个规则组`);
 *   });
 * ```
 *
 * @remarks
 * - 函数会每 10 秒查询一次数据库
 * - 使用 listWatch 模式，只有当规则内容发生实际变化时才会触发 K8s 资源的创建/更新
 * - 如果数据库查询失败，会自动重试（延迟 10 秒）
 * - 创建的 PrometheusRule 资源位于 monitoring 命名空间
 * - 资源名称与规则组名称相同
 * - 通过 Prometheus Operator 自动发现和应用规则，无需手动重载 Prometheus
 * - 如果 kubeconfig 加载失败，函数会抛出错误
 *
 * @public
 */
export const reconcileK8s = (kubeConfigPath?: string) => {
  const kubeConfig = new k8s.KubeConfig();

  if (kubeConfigPath) {
    kubeConfig.loadFromFile(kubeConfigPath);
    console.info(formatTime(Date.now()), `使用 kubeconfig: ${kubeConfigPath}`);
  } else {
    kubeConfig.loadFromCluster();
    console.info(formatTime(Date.now()), `使用默认 kubeconfig (fromCluster 或 ~/.kube/config)`);
  }
  const genericApi = k8s.KubernetesObjectApi.makeApiClient(kubeConfig);

  return prometheusRuleGroup$.pipe(
    listWatch(
      // to determin if rule has changed
      (group) => group.name,
      (group) =>
        defer(async () => {
          const k8sObject = makeRulePrometheusK8sOperatorFormat(group);
          try {
            await genericApi.create(k8sObject);
          } catch (e) {
            if (e instanceof k8s.ApiException && e.code === 409) {
              const obj = await genericApi.read({
                apiVersion: k8sObject.apiVersion,
                kind: k8sObject.kind,
                metadata: {
                  name: k8sObject.metadata!.name!,
                  namespace: k8sObject.metadata!.namespace!,
                },
              });
              k8sObject.metadata = obj.metadata;
              await genericApi.replace(k8sObject);
            }
          }
          return void 0;
        }).pipe(
          catchError((e) => {
            console.error(formatTime(Date.now()), 'ReconcileK8sError', e);
            return EMPTY;
          }),
        ),
      (a, b) =>
        a.name + a.rules.map((v) => JSON.stringify(v)).join('\n') ===
        b.name + b.rules.map((v) => JSON.stringify(v)).join('\n'),
    ),
  );
};
