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
          const yamlContent = YAML.stringify(yamlObject);

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
