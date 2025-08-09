import { Terminal } from '@yuants/protocol';
import cluster from 'cluster';

// 如果没有制定主机地址，则创建一个默认的主机管理器
// 如果设置了数据库地址，则创建一个数据库连接服务
// 不能既不设置主机地址又不设置数据库地址

if (cluster.isPrimary) {
  if (!process.env.POSTGRES_URL && !process.env.HOST_URL) {
    throw new Error('Either POSTGRES_URL or HOST_URL must be set');
  }

  if (!process.env.HOST_URL) {
    const worker = cluster.fork({ PACKAGE_NAME: '@yuants/app-host' });
  } else {
    const terminal = Terminal.fromNodeEnv();
  }

  if (process.env.POSTGRES_URI) {
    cluster.fork({
      PACKAGE_NAME: '@yuants/app-postgres-storage',
      POSTGRES_URI: process.env.POSTGRES_URI,
      HOST_URL: process.env.HOST_URL || 'ws://localhost:8888',
    });
  }
} else {
  require(process.env.PACKAGE_NAME!);
}
