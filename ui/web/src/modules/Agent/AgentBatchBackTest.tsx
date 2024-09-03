import { IconCloud, IconCode, IconExport, IconImport, IconPlay, IconSearch } from '@douyinfe/semi-icons';
import {
  Button,
  Descriptions,
  Input,
  InputNumber,
  Progress,
  Space,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { formatDuration, intervalToDuration } from 'date-fns';
import ExcelJS from 'exceljs';
import { t } from 'i18next';
import { useObservable, useObservableState } from 'observable-hooks';
import path from 'path-browserify';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPTY,
  catchError,
  defer,
  filter,
  first,
  firstValueFrom,
  from,
  fromEvent,
  map,
  mergeMap,
  pipe,
  retry,
  switchMap,
  tap,
} from 'rxjs';
import { agentConf$, runAgent } from '../Agent/AgentConfForm';
import { executeCommand } from '../CommandCenter';
import { useValue } from '../Data';
import { fs } from '../FileSystem/api';
import { showForm } from '../Form';
import { shareHosts$ } from '../Host/model';
import { registerPage, usePageParams } from '../Pages';
import { authState$ } from '../SupaBase';
import { clearLogAction$ } from '../Workbench/Program';
import { currentHostConfig$ } from '../Workbench/model';
import { registerAssociationRule } from '../Workspace';
import {
  IBatchAgentResultItem,
  loadBatchTasks,
  makeManifestsFromAgentConfList,
  runBatchBackTestWorkItem,
  writeManifestsFromBatchTasks,
} from './utils';
import Worker from './webworker?worker';

registerAssociationRule({
  id: 'AgentBatchBackTest',
  match: ({ path, isFile }) => isFile && !!path.match(/\.batch\.ts$/),
  action: ({ path }) => {
    executeCommand('AgentBatchBackTest', { filename: path });
  },
});

registerAssociationRule({
  id: 'AgentBatchBackTest_generate',
  match: ({ path, isFile }) => isFile && !!path.match(/\.batch\.ts$/) && !!currentHostConfig$.value,
  action: async ({ path }) => {
    await writeManifestsFromBatchTasks(path, currentHostConfig$.value?.host_url!);
    Toast.success(t('common:succeed'));
  },
});

registerPage('AgentBatchBackTest', () => {
  const { t } = useTranslation('AgentBatchBackTest');
  const { filename } = usePageParams() as { filename: string };
  const [results, setResults] = useState([] as Array<IBatchAgentResultItem>);
  const [progress, setProgress] = useState({ current: 0, startTime: 0, endTime: 0 });

  const [isStartLoading, setStartLoading] = useState(false);
  const [isExportLoading, setExportLoading] = useState(false);
  const [isExportJSONLoading, setExportJSONLoading] = useState(false);
  const [isImportJSONLoading, setImportJSONLoading] = useState(false);
  const [isRetrieveLoading, setRetrieveLoading] = useState(false);

  const [retrieveConditionInput, setRetrieveConditionInput] = useState('');

  const [retrievedResults, setRetrievedResults] = useState<IBatchAgentResultItem[]>([]);
  const dataId = `AgentBatchBackTest.Results/${filename}`;
  const [analysisData, setAnalysisData] = useValue<Array<{ x: number; y: number; z: number }>>(dataId, []);

  const [jobs, setJobs] = useState(window.navigator.hardwareConcurrency || 1);

  const currentHost = useObservableState(currentHostConfig$);
  const [selectedRows, setSelectedRows] = useState<IBatchAgentResultItem[]>([]);

  const tasks = useObservableState(
    useObservable(
      pipe(
        map((x) => x[0]),
        filter((x) => !!x),
        switchMap((filename) =>
          defer(() => loadBatchTasks(filename)).pipe(
            //
            retry({ delay: 1000 }),
          ),
        ),
      ),
      [filename],
    ),
    [],
  );

  const handleStart = () => {
    from(tasks)
      .pipe(
        mergeMap((task, i) => {
          if (currentHostConfig$.value !== null) {
            return from(runBatchBackTestWorkItem(task)).pipe(
              tap({
                next: (result) => {
                  setResults((results) => results.concat(result));
                },
                subscribe: () => {
                  console.info(formatTime(Date.now()), `批量回测子任务开始: ${i}/${tasks.length}`);
                },
                error: (err) => {
                  console.info(formatTime(Date.now()), `批量回测子任务异常: ${i}/${tasks.length}: ${err}`);
                },
                complete: () => {
                  console.info(formatTime(Date.now()), `批量回测子任务完成: ${i}/${tasks.length}`);
                  setProgress((x) => ({
                    ...x,
                    current: x.current + 1,
                    endTime: Math.max(x.endTime, Date.now()),
                  }));
                },
                finalize: () => {
                  setProgress((x) => ({
                    ...x,
                    endTime: Math.max(x.endTime, Date.now()),
                  }));
                },
              }),
              retry({ delay: 10000, count: 3 }),
              catchError(() => EMPTY), // 忽略错误，跳过该任务
            );
          }
          const worker = new Worker();
          worker.postMessage({ agentConf: task });
          return fromEvent(worker, 'message').pipe(
            //
            first(),
            map((msg: any) => msg.data),
            tap({
              next: (result) => {
                setResults((results) => results.concat(result));
              },
              subscribe: () => {
                console.info(formatTime(Date.now()), `批量回测子任务开始: ${i}/${tasks.length}`);
              },
              error: (err) => {
                console.info(formatTime(Date.now()), `批量回测子任务异常: ${i}/${tasks.length}: ${err}`);
              },
              complete: () => {
                console.info(formatTime(Date.now()), `批量回测子任务完成: ${i}/${tasks.length}`);
                setProgress((x) => ({
                  ...x,
                  current: x.current + 1,
                  endTime: Math.max(x.endTime, Date.now()),
                }));
              },
              finalize: () => {
                setProgress((x) => ({
                  ...x,
                  endTime: Math.max(x.endTime, Date.now()),
                }));
                worker.terminate();
              },
            }),
          );
        }, jobs),
        tap({
          subscribe: () => {
            Toast.info('开始批量回测');
            clearLogAction$.next();
            setResults([]);
            setProgress({
              current: 0,
              startTime: Date.now(),
              endTime: Date.now(),
            });
            setStartLoading(true);
          },
          finalize: () => {
            Toast.success(`批量回放结束`);
            setStartLoading(false);
          },
        }),
      )
      .subscribe();
  };
  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      const data: Record<string, string | number>[] = [];
      for (const result of results) {
        data.push({
          净值曲线缩略图: result.equityImageSrc,
          配置: JSON.stringify(result.agentConf),
          回溯历史: result.performance.total_days,
          周收益率: result.performance.weekly_return_ratio,
          最大维持保证金: result.performance.max_maintenance_margin,
          收益回撤比: result.performance.profit_drawdown_ratio,
          资本回报期: result.performance.payback_period_in_days,
          周夏普比率: result.performance.weekly_sharpe_ratio,
          资金占用率: result.performance.capital_occupancy_rate,
          持仓次数: result.performance.total_positions,
        });
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sheet1');
      sheet.columns = Object.keys(data[0]).map((key) => ({ header: key, key, width: 28 }));

      const processedData = data.map((x) => {
        const imageId = workbook.addImage({
          base64: x['净值曲线缩略图'] as string,
          extension: 'png',
        });
        return {
          ...x,
          净值曲线缩略图: imageId,
        };
      });

      for (let i = 0; i < processedData.length; i++) {
        const rowData = processedData[i];
        sheet.addRow(rowData);
        const row = sheet.getRow(i + 2);
        row.height = 120;
        sheet.addImage(rowData['净值曲线缩略图'] as number, {
          tl: { col: 0, row: i + 1 },
          ext: { width: 200, height: 100 },
          editAs: 'undefined',
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      await fs.writeFile(`${filename}.xlsx`, buffer);
      Toast.success(`导出 Excel 到 ${filename}.xlsx 成功`);
    } catch (e) {}
    setExportLoading(false);
  };

  const handleRetrieve = () => {
    const retrieveConditionFn: (x: IBatchAgentResultItem) => boolean = (() => {
      try {
        return new Function('x', `return (${retrieveConditionInput})`);
      } catch (e) {
        return () => true;
      }
    })() as any;
    setRetrievedResults(
      results.filter((x) => {
        try {
          return retrieveConditionFn(x);
        } catch (e) {
          return false;
        }
      }),
    );
  };

  const authState = useObservableState(authState$);

  return (
    <Space vertical align="start" style={{ width: '100%', flexWrap: 'wrap' }}>
      <Space>
        <Button onClick={handleStart} icon={<IconPlay />} loading={isStartLoading}>
          启动
        </Button>
        <Button
          icon={<IconCode />}
          onClick={() => {
            executeCommand('FileEditor', { filename });
          }}
        >
          查看源码
        </Button>
        <Typography.Text>共 {tasks.length} 个任务</Typography.Text>
        <InputNumber prefix="并发数" value={jobs} onChange={(e) => setJobs(+e)} />

        <Button onClick={handleExportExcel} icon={<IconExport />} loading={isExportLoading}>
          导出 Excel
        </Button>
        <Button
          onClick={async (e) => {
            setExportJSONLoading(true);
            try {
              const data = JSON.stringify(
                results,
                (key, value) => {
                  // for keeping secret
                  if (key === 'bundled_code') {
                    return;
                  }
                  // remove private fields
                  if (key.startsWith('_')) {
                    return;
                  }
                  return value;
                },
                2,
              );
              await fs.writeFile(`${filename}.json`, data);
              Toast.success(`导出 JSON 到 ${filename}.json 成功`);
            } catch (e) {}
            setExportJSONLoading(false);
          }}
          icon={<IconExport />}
          loading={isExportJSONLoading}
        >
          导出 JSON
        </Button>
        <Button
          disabled={isStartLoading}
          onClick={async (e) => {
            setImportJSONLoading(true);
            try {
              const data = await fs.readFile(`${filename}.json`);
              const results = JSON.parse(data) as Array<IBatchAgentResultItem>;
              setResults(results);
              Toast.success(`导入 JSON 到 ${filename}.json 成功`);
            } catch (e) {
              Toast.success(`导入失败: ${e}`);
              console.error(e);
            }
            setImportJSONLoading(false);
          }}
          icon={<IconImport />}
          loading={isImportJSONLoading}
        >
          导入 JSON
        </Button>
        <Button
          disabled={selectedRows.length === 0 || !currentHost}
          icon={<IconExport />}
          onClick={async (e) => {
            await fs.ensureDir(path.join(path.dirname(filename), `agentConfs`));
            const agentConfList = selectedRows.map((v) => v.agentConf);
            const manifests = await makeManifestsFromAgentConfList(agentConfList, currentHost?.host_url!);
            await fs.writeFile(`${filename}.manifest.json`, JSON.stringify(manifests, null, 2));
            Toast.success(`导出部署配置成功`);
          }}
        >
          导出部署配置
        </Button>
        <Button
          disabled={!authState || !currentHost}
          icon={<IconCloud />}
          onClick={async (e) => {
            const sharedHosts = await firstValueFrom(shareHosts$);
            const host_url = await showForm<string>({
              title: t('AgentConfForm:select_host'),
              type: 'string',
              examples: sharedHosts.map((host) => host.host_url),
            });
            for (const agentConf of tasks) {
              await executeCommand('Agent.DeployToCloud', {
                agentConf,
                host_url,
              });
            }
          }}
        >
          全部部署到云
        </Button>
        <Button
          onClick={async (e) => {
            const res = await showForm<{ x?: string; y?: string; z?: string }>({
              type: 'object',
              properties: {
                x: {
                  type: 'string',
                  title: 'X轴映射函数',
                  default: 'x.performance.profit_drawdown_ratio',
                },
                y: {
                  type: 'string',
                  title: 'Y轴映射函数',
                  default: 'x.performance.weekly_return_ratio',
                },
                z: {
                  type: 'string',
                  title: 'Z轴映射函数',
                  default: 'x.performance.max_maintenance_margin',
                },
              },
            });
            const fx = new Function('x', `return (${res.x || 'undefined'})`);
            const fy = new Function('x', `return (${res.y || 'undefined'})`);
            const fz = new Function('x', `return (${res.z || 'undefined'})`);
            const data = retrievedResults.map((item) => ({ x: fx(item), y: fy(item), z: fz(item) }));
            setAnalysisData(data);
            executeCommand('SampleScatter', { id: dataId });
          }}
        >
          散点图
        </Button>
      </Space>
      {isStartLoading && (
        <Space>
          <Progress
            type="circle"
            percent={tasks.length ? Math.round((progress.current / tasks.length) * 100) : 0}
            showInfo
          />
          <Descriptions
            row
            data={[
              //
              { key: '已完成 / 总量', value: `${progress.current} / ${tasks.length}` },
              {
                key: '已进行时长 / 预计总时长',
                value: `${formatDuration({
                  ...intervalToDuration({ start: progress.startTime || 0, end: progress.endTime || 0 }),
                  seconds: 0,
                })} / ${formatDuration({
                  ...intervalToDuration({
                    start: 0,
                    end:
                      progress.current === 0
                        ? 0
                        : ((progress.endTime - progress.startTime) / progress.current) * tasks.length || 0,
                  }),
                  seconds: 0,
                })}`,
              },
              {
                key: '预计结束时间',
                value: formatTime(
                  progress.startTime +
                    (((progress.endTime - progress.startTime) / progress.current) * tasks.length || 0) || 0,
                ),
              },
              {
                key: '预计剩余时长',
                value: formatDuration({
                  ...intervalToDuration({
                    start: progress.endTime - progress.startTime || 0,
                    end:
                      progress.current === 0
                        ? 0
                        : ((progress.endTime - progress.startTime) / progress.current) * tasks.length || 0,
                  }),
                  seconds: 0,
                }),
              },
            ]}
          ></Descriptions>
        </Space>
      )}

      <Input
        value={retrieveConditionInput}
        onChange={setRetrieveConditionInput}
        prefix="检索条件 f(x)"
        onEnterPress={handleRetrieve}
        suffix={
          <Button icon={<IconSearch />} loading={isRetrieveLoading} onClick={handleRetrieve}>
            检索
          </Button>
        }
      ></Input>
      <Descriptions
        row
        data={[
          //
          {
            key: '结果召回 / 总量',
            value: `${retrievedResults.length} / ${results.length} (${(
              retrievedResults.length / results.length
            ).toLocaleString(undefined, {
              style: 'percent',
              minimumFractionDigits: 2,
            })})`,
          },
        ]}
      ></Descriptions>
      <Table
        dataSource={retrievedResults}
        rowKey={(e) => e?.accountInfo.account_id ?? ''}
        rowSelection={{
          onChange: (selectedRowKeys, selectedRows) => {
            if (selectedRows) {
              setSelectedRows(selectedRows);
            }
          },
        }}
        columns={[
          {
            title: '净值曲线缩略图',
            width: 200,
            render: (_, x) => (
              <img style={{ margin: -16, height: 80, width: '100%' }} src={x.equityImageSrc}></img>
            ),
          },
          {
            title: '账户',
            render: (_, x) => x.accountInfo.account_id,
          },
          {
            title: '回溯历史',
            dataIndex: 'duration_of_trades_in_day',
            sorter: (a, b) => (a?.performance.total_days || 0) - (b?.performance.total_days || 0),
            // ISSUE: NaN 转 JSON 会变成 null，再转回来调用 toFixed 会报错，所以这里需要先转成数字
            render: (_, x) => (+x.performance.total_days).toFixed(1) + '天',
          },
          {
            title: '周收益率',
            dataIndex: 'weekly_return_ratio',
            sorter: (a, b) =>
              (a?.performance.weekly_return_ratio ?? 0) - (b?.performance.weekly_return_ratio ?? 0),
            render: (_, x) => `${(+x.performance.weekly_return_ratio * 100).toFixed(2)}%`,
          },
          {
            title: '最大维持保证金',
            dataIndex: 'max_margin',
            sorter: (a, b) =>
              (a?.performance.max_maintenance_margin || 0) - (b?.performance.max_maintenance_margin || 0),
            render: (_, x) => (+x.performance.max_maintenance_margin).toFixed(2),
          },

          {
            title: '收益回撤比',
            dataIndex: 'net_profit_max_drawdown_profit_ratio',
            sorter: (a, b) =>
              (a?.performance.profit_drawdown_ratio || 0) - (b?.performance.profit_drawdown_ratio || 0),
            render: (_, x) => (+x.performance.profit_drawdown_ratio).toFixed(5),
          },
          {
            title: '资本回报期',
            dataIndex: 'pp',
            sorter: (a, b) =>
              (a?.performance.payback_period_in_days || 0) - (b?.performance.payback_period_in_days || 0),
            render: (_, x) => `${(+x.performance.payback_period_in_days).toFixed(1)}天`,
          },
          {
            title: '周夏普比率',
            dataIndex: 'weekly_sharpe_ratio',
            sorter: (a, b) =>
              (a?.performance.weekly_sharpe_ratio || 0) - (b?.performance.weekly_sharpe_ratio || 0),
            render: (_, x) =>
              (+x.performance.weekly_sharpe_ratio).toLocaleString(undefined, {
                style: 'percent',
                minimumFractionDigits: 2,
              }),
          },
          {
            title: '资金占用率',
            dataIndex: 'capital_occupancy_rate',
            sorter: (a, b) =>
              (a?.performance.capital_occupancy_rate || 0) - (b?.performance.capital_occupancy_rate || 0),
            render: (_, x) =>
              (+x.performance.capital_occupancy_rate).toLocaleString(undefined, {
                style: 'percent',
                minimumFractionDigits: 2,
              }),
          },
          {
            title: '净值',
            dataIndex: 'equity',
            sorter: (a, b) => (a?.performance.equity || 0) - (b?.performance.equity || 0),
            render: (_, x) => (+x.performance.equity).toFixed(2),
          },
          {
            title: '持仓次数',
            dataIndex: 'total_positions',
            sorter: (a, b) => (a?.performance.total_positions || 0) - (b?.performance.total_positions || 0),
            render: (_, x) => +x.performance.total_positions,
          },
          // TODO: 一系列的性能指标
          {
            title: '操作',
            render: (_, x) => (
              <Space>
                <Button
                  onClick={() => {
                    agentConf$.next(x.agentConf);
                    runAgent();
                  }}
                >
                  详情
                </Button>
                <Button
                  onClick={async () => {
                    executeCommand('Agent.DeployToCloud', { agentConf: x.agentConf });
                  }}
                >
                  部署到云
                </Button>
              </Space>
            ),
          },
        ]}
      ></Table>
    </Space>
  );
});
