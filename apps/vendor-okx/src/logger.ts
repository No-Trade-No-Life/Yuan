import cluster from 'cluster';
import { formatTime } from '@yuants/utils';

/**
 * 日志级别
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * 集群模式下的日志管理器
 * 在worker进程中将日志发送到主进程，在主进程中直接使用console
 */
class ClusterLogger {
  private isWorker = !cluster.isPrimary;

  private sendToMaster(level: LogLevel, message: string, ...args: any[]) {
    if (this.isWorker && process.send) {
      const formattedMessage =
        args.length > 0
          ? `${message} ${args
              .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
              .join(' ')}`
          : message;

      process.send({
        type: 'log',
        level,
        message: `[${formatTime(Date.now())}] [PID:${process.pid}] ${formattedMessage}`,
        pid: process.pid,
        timestamp: Date.now(),
      });
    } else {
      // 在主进程中直接输出
      const formattedMessage =
        args.length > 0
          ? `${message} ${args
              .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
              .join(' ')}`
          : message;

      const logMessage = `[${formatTime(Date.now())}] [PID:${process.pid}] ${formattedMessage}`;

      // 控制台输出
      switch (level) {
        case 'error':
          console.error(logMessage);
          break;
        case 'warn':
          console.warn(logMessage);
          break;
        case 'debug':
          console.debug(logMessage);
          break;
        default:
          console.log(logMessage);
      }
    }
  }

  info(message: string, ...args: any[]) {
    this.sendToMaster('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.sendToMaster('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.sendToMaster('error', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.sendToMaster('debug', message, ...args);
  }

  log(message: string, ...args: any[]) {
    this.info(message, ...args);
  }
}

// 默认配置的logger实例
export const logger = new ClusterLogger();

// 猛踩油门
export const overrideConsole = () => {
  if (!cluster.isPrimary) {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    console.log = (...args: any[]) => logger.info(args.join(' '));
    console.info = (...args: any[]) => logger.info(args.join(' '));
    console.warn = (...args: any[]) => logger.warn(args.join(' '));
    console.error = (...args: any[]) => logger.error(args.join(' '));

    // 提供恢复方法
    return () => {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }
  return () => {}; // 主进程中返回空函数
};
