import { SignalTraderPaperClockState } from '../types';

const MAX_OFFSET_MS = 86_400_000 * 3650;

const assertFinite = (value: number, field: string) => {
  if (!Number.isFinite(value)) throw new Error(`${field.toUpperCase()}_INVALID`);
  if (Math.abs(value) > MAX_OFFSET_MS) throw new Error('PAPER_CLOCK_OFFSET_OUT_OF_RANGE');
};

export class PaperClockController {
  private offsetMs = 0;

  private realNow() {
    return Date.now();
  }

  now(executionMode: 'paper' | 'live') {
    return executionMode === 'paper' ? this.realNow() + this.offsetMs : this.realNow();
  }

  getState(): SignalTraderPaperClockState {
    const real_now_ms = this.realNow();
    return {
      real_now_ms,
      offset_ms: this.offsetMs,
      effective_now_ms: real_now_ms + this.offsetMs,
    };
  }

  advance(deltaMs: number): SignalTraderPaperClockState {
    assertFinite(deltaMs, 'delta_ms');
    this.offsetMs = Math.trunc(this.offsetMs + deltaMs);
    return this.getState();
  }

  setOffset(offsetMs: number): SignalTraderPaperClockState {
    assertFinite(offsetMs, 'offset_ms');
    this.offsetMs = Math.trunc(offsetMs);
    return this.getState();
  }

  reset(): SignalTraderPaperClockState {
    this.offsetMs = 0;
    return this.getState();
  }
}
