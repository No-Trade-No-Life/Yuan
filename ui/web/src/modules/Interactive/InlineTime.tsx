import { Tooltip } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import { useEffect, useState } from 'react';

/**
 * 将时间戳解析成人类易读的格式
 * @param t 时间戳
 */
export const formatDurationFromNow = (t: number | string | Date): { text: string; updatingAfter: number } => {
  const time = new Date(t).getTime();
  const now = Date.now();
  const duration = now - time;

  if (duration > 86400_000) {
    return {
      text: `${Math.floor(duration / 86400_000)}d`,
      updatingAfter: 86400_000,
    };
  }
  if (duration > 3600_000) {
    return {
      text: `${Math.floor(duration / 3600_000)}h`,
      updatingAfter: 3600_000,
    };
  }
  if (duration > 60_000) {
    return {
      text: `${Math.floor(duration / 60_000)}m`,
      updatingAfter: 60_000,
    };
  }
  return {
    text: `${Math.ceil(duration / 1000)}s`,
    updatingAfter: 1000,
  };
};

/**
 * 显示某个时间点距离现在的大约时间间隔
 *
 * 悬浮显示完整时间
 *
 * @remarks
 * 人类普遍习惯使用相对时间来表示时间点，例如 "5分钟前"、"2小时前"、"3天前" 等等。
 * 这种表示方式更符合人类的时间感知，有助于用户快速理解时间点的相对位置。
 * 此外，悬浮显示完整时间可以在用户需要时提供精确的时间信息，满足不同场景下的需求。
 *
 */
export const InlineTime = (props: { time: number | string | Date }) => {
  const [text, setText] = useState(formatDurationFromNow(props.time).text);
  const [refreshCnt, setRefreshCnt] = useState(0);
  useEffect(() => {
    const { text, updatingAfter } = formatDurationFromNow(props.time);
    setText(text);
    const timer = setTimeout(() => {
      setRefreshCnt((v) => v + 1);
    }, updatingAfter);
    return () => {
      clearTimeout(timer);
    };
  }, [props.time, refreshCnt]);

  return (
    <Tooltip content={formatTime(props.time)}>
      <span>{text}</span>
    </Tooltip>
  );
};
