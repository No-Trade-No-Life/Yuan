import { Series } from '@yuants/kernel';
import { useAgent, useMemo } from './basic-set';

/**
 * 使用序列，序列是一个与时间轴对齐的数组
 * @param name - 序列名
 * @param parent - 父序列
 * @param tags - tags
 * @returns 序列
 * @public
 */
export const useSeries = (
  name: string,
  parent: Series | undefined,
  tags: Record<string, any> = {},
): Series => {
  const agent = useAgent();
  const seriesIdx = useMemo(() => agent.seriesDataUnit.series.length, []);
  if (agent.seriesDataUnit.series.length <= seriesIdx) {
    const series = new Series();
    series.name = name;
    series.tags = tags;
    series.parent = parent;
    agent.seriesDataUnit.series.push(series);
  }
  return agent.seriesDataUnit.series[seriesIdx];
};

/**
 * 使用记录表，记录表不必与时间轴对齐，用于记录样本
 * @param name - 记录表名
 * @returns 记录表
 * @public
 */
export const useRecordTable = (name: string) => (useAgent().record_table[name] ??= []);

/**
 * 使用日志，日志可以自由输出
 * @returns 日志函数
 * @public
 */
export const useLog = () => {
  const shell = useAgent();
  const kernel = shell.kernel;
  return kernel.log || (() => {});
};
