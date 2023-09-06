import { catchError, defer, filter, map, of, retry, throwIfEmpty, timeout } from 'rxjs';
import { requestZMQ } from '../exchange';
import { createZMQConnection } from '../bridge';

process.env.ZMQ_PULL_URL = 'tcp://localhost:5700';
process.env.ZMQ_PUSH_URL = 'tcp://*:5702';
const conn = createZMQConnection(process.env.ZMQ_PUSH_URL!, process.env.ZMQ_PULL_URL!);

const liveness$ = defer(() => requestZMQ(conn, { method: 'Ping', params: {} })).pipe(
  //
  map((v) => v.res?.error_code),
  timeout(3000),
  filter((v) => v === 0),
  throwIfEmpty(),
  retry({ delay: 1000, count: 2 }),
  catchError(() => of(10086)),
);

liveness$.subscribe((code) => {
  if (code === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});
