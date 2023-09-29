import { Point } from '@influxdata/influxdb-client-browser';
import { formatTime } from '@yuants/data-model';
import Axios from 'axios';
import { isNode } from 'browser-or-node';
import { bufferTime, filter, Subject } from 'rxjs';
import { format, parse } from 'url';

const httpsAgent = isNode
  ? new (require('https').Agent)({
      rejectUnauthorized: false,
    })
  : undefined;

/**
 * Influx Point 格式
 *
 * 概念参考 {@link https://docs.influxdata.com/influxdb/v2.4/reference/key-concepts/data-elements/ | 数据元素}
 *
 * @public
 */
export interface IInfluxPoint {
  measurement: string;
  timestamp?: Date | string | number;
  tags?: Record<string, string>;
  fields?: Record<string, string | number>;
}

/**
 * InfluxDB Client
 *
 * @public
 */
export class InfluxClient {
  /**
   * @param dsn - 数据库名称, 格式为 `https://<token>@<url>/<org>/<bucket>`
   */
  constructor(public dsn: string) {
    const urlObj = parse(dsn);
    const [, org, bucket] = urlObj.pathname!.split('/');
    this.org = org;
    this.bucket = bucket;
    this.auth = urlObj.auth || '';
    this.url = format({
      protocol: urlObj.protocol,
      host: urlObj.host,
      pathname: '/api/v2/write',
      search: `?org=${this.org}&bucket=${this.bucket}&precision=ns`,
    });
    // Setup Auto Buffer Post
    this.line$
      .pipe(
        //
        filter((v): v is Exclude<typeof v, undefined | null> => !!v),
        bufferTime(1000), // POST every second
        filter((v) => v.length > 0),
      )
      .forEach((lines) => {
        this.post(lines);
      });
  }

  /**
   * Line Protocol 接口
   *
   * 概念参考 {@link https://docs.influxdata.com/influxdb/v2.4/reference/syntax/line-protocol/ | Line Protocol}
   */
  private line$ = new Subject<string>();

  private url: string;
  private org: string;
  private bucket: string;
  private auth: string;

  /**
   * Client 会缓存输入的点，定期向 Remote Server 写入数据
   *
   * 这个 API 应当没有性能问题，但不保证发送写入数据的请求不会失败
   *
   * @public
   */
  writePoint(point: IInfluxPoint): void {
    this.line$.next(this.toLineProtocol(point));
  }

  private toLineProtocol(point: IInfluxPoint): string {
    const p = new Point(point.measurement);
    p.timestamp(point.timestamp);
    for (const [name, value] of Object.entries(point.tags || {})) {
      p.tag(name, value);
    }
    for (const [name, value] of Object.entries(point.fields || {})) {
      if (typeof value === 'number') {
        p.floatField(name, value);
      } else {
        p.stringField(name, `${value}`);
      }
    }
    return p.toLineProtocol() || '';
  }

  private post(lines: string[]) {
    return Axios.post(this.url, lines.join('\n'), {
      headers: {
        'Content-Type': 'text/plain',
        Authorization: `Token ${this.auth}`,
      },
      httpsAgent,
    })
      .then(() => {
        console.debug(formatTime(Date.now()), `post influx succeed for ${lines.length} points`);
      })
      .catch((e) => {
        console.debug(formatTime(Date.now()), `post influx failed for ${lines.length} points: ${e}`);
      });
  }
}
