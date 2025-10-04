import { useObservable, useObservableState } from 'observable-hooks';
import {
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  mergeAll,
  mergeWith,
  Observable,
  of,
  switchMap,
  tap,
} from 'rxjs';

/**
 * Legend 的挂载容器的管理
 * @param dom$ 图表的根 DOM 元素 Observable
 * @return legend 容器列表
 */
export const useLegendContainers = (dom$: Observable<HTMLDivElement | null>): HTMLDivElement[] | undefined =>
  useObservableState(
    useObservable(() =>
      dom$.pipe(
        switchMap((dom) => {
          // 监控 dom 内部的 mutations
          if (!dom) return EMPTY;
          return new Observable<MutationRecord[]>((sub) => {
            const obs = new MutationObserver((mutations) => {
              sub.next(mutations);
            });
            obs.observe(dom, { childList: true, subtree: true });
            return () => {
              obs.disconnect();
            };
          }).pipe(
            mergeAll(), // 扁平化
            // 只关注 table 的直接子节点变化的情况
            filter((m) => m.type === 'childList' && m.target instanceof HTMLTableElement),
            mergeWith(of(0)), // 初始化时也触发一次
            map(() => dom),
          );
        }),
        debounceTime(10),
        map((dom) => dom.querySelectorAll('table')[0]),
        // 读取 td 列表作为定位容器
        // ISSUE: tr 容器作为绝对定位，在 Safari 下会有问题，需要找到 td 元素作为相对定位的参考 (第2个 td 是具有相对定位的)
        map((table) => Array.from(table.querySelectorAll('tr td:nth-child(2)'))),
        // ListWatch 并管理 legend dom 的副作用
        distinctUntilChanged((a, b) => a.length === b.length && a.every((v, i) => v === b[i])), // 比较引用相等
        // 检测到发生变化
        switchMap(
          (tds) =>
            new Observable<HTMLDivElement[]>((sub) => {
              const doms = tds.map((td) => {
                const dom = document.createElement('div');
                dom.classList.add('TimeSeriesChart_legend-container');
                td.appendChild(dom);
                return dom;
              });
              sub.next(doms);
              return () => {
                tds.forEach((td, i) => {
                  td.removeChild(doms[i]);
                });
              };
            }),
        ),
        // tap((doms) => console.info('## legend dom changed', doms)),
      ),
    ),
  );
