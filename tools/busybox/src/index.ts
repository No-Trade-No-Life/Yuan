import { Terminal } from '@yuants/protocol';
import { defer, first } from 'rxjs';
import { formatTime } from '../../../libraries/data-model/lib';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || 'TheBusybox',
  enable_WebRTC: process.env.ENABLE_WEBRTC === 'true',
  name: 'Busybox',
});

terminal.provideService('Echo', {}, async (req) => {
  return { res: { data: req.req, message: 'OK', code: 0 } };
});

defer(() => terminal.terminalInfos$)
  .pipe(
    //
    first((v) => v.some((v) => v.terminal_id === terminal.terminal_id && v.serviceInfo?.Echo !== undefined)),
  )
  .subscribe((v) => {
    const req = { req: 'Hello, World!' };
    console.info(formatTime(Date.now()), JSON.stringify(req));
    defer(() => terminal.requestService('Echo', req)).subscribe((v) => {
      console.info(formatTime(Date.now()), JSON.stringify(v));
    });
  });
