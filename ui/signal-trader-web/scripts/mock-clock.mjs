const hostOrigin = process.env.SIGNAL_TRADER_HOST_ORIGIN || 'http://127.0.0.1:8888';
const command = process.argv[2] || 'status';
const value = process.argv[3];

const parseDuration = (input) => {
  if (!input) throw new Error('DURATION_REQUIRED');
  const match = /^(-?\d+)(ms|s|m|h|d)?$/.exec(input);
  if (!match) throw new Error('INVALID_DURATION');
  const amount = Number(match[1]);
  const unit = match[2] || 'ms';
  const multiplier =
    unit === 'ms' ? 1 : unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * multiplier;
};

const request = async (method, req = {}) => {
  const response = await fetch(new URL('/request', hostOrigin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, req }),
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const raw = await response.text();
  const line = raw
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .pop();
  if (!line) throw new Error('EMPTY_RESPONSE');
  const payload = JSON.parse(line);
  if (payload?.res?.code !== 0) throw new Error(payload?.res?.message || 'REQUEST_FAILED');
  return payload.res.data;
};

const formatState = (state) => {
  const toIso = (value) => new Date(value).toISOString();
  return {
    real_now_ms: state.real_now_ms,
    real_now_iso: toIso(state.real_now_ms),
    offset_ms: state.offset_ms,
    effective_now_ms: state.effective_now_ms,
    effective_now_iso: toIso(state.effective_now_ms),
  };
};

const run = async () => {
  if (command === 'status') {
    console.log(JSON.stringify(formatState(await request('SignalTrader/GetPaperClock')), null, 2));
    return;
  }
  if (command === 'advance') {
    console.log(
      JSON.stringify(
        formatState(await request('SignalTrader/AdvancePaperClock', { delta_ms: parseDuration(value) })),
        null,
        2,
      ),
    );
    return;
  }
  if (command === 'set' || command === 'set-offset') {
    console.log(
      JSON.stringify(
        formatState(await request('SignalTrader/SetPaperClockOffset', { offset_ms: parseDuration(value) })),
        null,
        2,
      ),
    );
    return;
  }
  if (command === 'reset') {
    console.log(JSON.stringify(formatState(await request('SignalTrader/ResetPaperClock')), null, 2));
    return;
  }
  throw new Error('USAGE: node scripts/mock-clock.mjs [status|advance <1d>|set-offset <1d>|reset]');
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
