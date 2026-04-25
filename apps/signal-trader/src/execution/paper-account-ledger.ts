import { IAccountInfo, IPosition, createEmptyAccountInfo } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { SignalTraderRuntimeConfig, SignalTraderTransferDirection } from '../types';

type PaperMockPositionState = {
  product_id: string;
  direction: 'LONG' | 'SHORT';
  volume: number;
  position_price: number;
  current_price: number;
  updated_at: number;
};

type PaperMockAccountState = {
  runtime_id: string;
  mock_account_id: string;
  currency: string;
  leverage: number;
  balance: number;
  positions: Map<string, PaperMockPositionState>;
  last_prices: Map<string, number>;
  updated_at: number;
};

const DEFAULT_CURRENCY = 'MOCK';
const round = (value: number) => Number(value.toFixed(8));

const signedVolume = (position: PaperMockPositionState) =>
  position.direction === 'LONG' ? position.volume : -position.volume;

const toDirection = (signedSize: number): 'LONG' | 'SHORT' => (signedSize >= 0 ? 'LONG' : 'SHORT');

const resolveCurrency = (runtime: SignalTraderRuntimeConfig) => {
  const transfer = runtime.metadata?.signal_trader_transfer as Record<string, unknown> | undefined;
  return typeof transfer?.currency === 'string' ? transfer.currency : DEFAULT_CURRENCY;
};

export const buildPaperMockAccountId = (runtime: SignalTraderRuntimeConfig) =>
  encodePath('signal-trader-mock', runtime.runtime_id, runtime.account_id);

export class PaperAccountLedger {
  private readonly stateByRuntimeId = new Map<string, PaperMockAccountState>();

  private ensureState(runtime: SignalTraderRuntimeConfig): PaperMockAccountState {
    const current = this.stateByRuntimeId.get(runtime.runtime_id);
    const nextMockAccountId = buildPaperMockAccountId(runtime);
    if (current && current.mock_account_id === nextMockAccountId) {
      current.currency = resolveCurrency(runtime);
      return current;
    }
    const next: PaperMockAccountState = {
      runtime_id: runtime.runtime_id,
      mock_account_id: nextMockAccountId,
      currency: resolveCurrency(runtime),
      leverage: 1,
      balance: 0,
      positions: new Map(),
      last_prices: new Map(),
      updated_at: Date.now(),
    };
    this.stateByRuntimeId.set(runtime.runtime_id, next);
    return next;
  }

  applyTransfer(
    runtime: SignalTraderRuntimeConfig,
    direction: SignalTraderTransferDirection,
    amount: number,
  ): { actual_amount: number; account_info: IAccountInfo } {
    const state = this.ensureState(runtime);
    const snapshot = this.getAccountInfo(runtime);
    const normalizedAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    const actualAmount =
      direction === 'funding_to_trading'
        ? normalizedAmount
        : Math.min(normalizedAmount, Math.max(snapshot.money.free, 0));
    state.balance = round(
      state.balance + (direction === 'funding_to_trading' ? actualAmount : -actualAmount),
    );
    state.updated_at = Date.now();
    return { actual_amount: actualAmount, account_info: this.getAccountInfo(runtime) };
  }

  applyFill(
    runtime: SignalTraderRuntimeConfig,
    input: { product_id: string; size: number; fill_price: number },
  ) {
    const state = this.ensureState(runtime);
    const now = Date.now();
    const fillSize = round(input.size);
    const fillPrice = round(input.fill_price);
    if (!Number.isFinite(fillSize) || fillSize === 0 || !Number.isFinite(fillPrice) || fillPrice <= 0) {
      return this.getAccountInfo(runtime);
    }
    state.last_prices.set(input.product_id, fillPrice);

    const current = state.positions.get(input.product_id);
    if (!current) {
      state.positions.set(input.product_id, {
        product_id: input.product_id,
        direction: toDirection(fillSize),
        volume: Math.abs(fillSize),
        position_price: fillPrice,
        current_price: fillPrice,
        updated_at: now,
      });
      state.updated_at = now;
      return this.getAccountInfo(runtime);
    }

    const currentSigned = signedVolume(current);
    const nextSigned = round(currentSigned + fillSize);
    current.current_price = fillPrice;
    current.updated_at = now;

    if (Math.sign(currentSigned) === Math.sign(fillSize)) {
      const nextVolume = Math.abs(nextSigned);
      current.position_price = round(
        (current.position_price * current.volume + fillPrice * Math.abs(fillSize)) / nextVolume,
      );
      current.volume = nextVolume;
      current.direction = toDirection(nextSigned);
      state.updated_at = now;
      return this.getAccountInfo(runtime);
    }

    const closingVolume = Math.min(Math.abs(currentSigned), Math.abs(fillSize));
    const realized =
      current.direction === 'LONG'
        ? round((fillPrice - current.position_price) * closingVolume)
        : round((current.position_price - fillPrice) * closingVolume);
    state.balance = round(state.balance + realized);

    if (nextSigned === 0) {
      state.positions.delete(input.product_id);
      state.updated_at = now;
      return this.getAccountInfo(runtime);
    }

    if (Math.sign(nextSigned) === Math.sign(currentSigned)) {
      current.volume = Math.abs(nextSigned);
      state.updated_at = now;
      return this.getAccountInfo(runtime);
    }

    state.positions.set(input.product_id, {
      product_id: input.product_id,
      direction: toDirection(nextSigned),
      volume: Math.abs(nextSigned),
      position_price: fillPrice,
      current_price: fillPrice,
      updated_at: now,
    });
    state.updated_at = now;
    return this.getAccountInfo(runtime);
  }

  getAccountInfo(runtime: SignalTraderRuntimeConfig): IAccountInfo {
    const state = this.ensureState(runtime);
    return this.toAccountInfo(state);
  }

  getAccountInfoByAccountId(account_id: string) {
    const state = [...this.stateByRuntimeId.values()].find((item) => item.mock_account_id === account_id);
    return state ? this.toAccountInfo(state) : undefined;
  }

  private toAccountInfo(state: PaperMockAccountState): IAccountInfo {
    const positions = [...state.positions.values()].map((position) =>
      this.toPosition(state.mock_account_id, position),
    );
    const profit = round(positions.reduce((sum, position) => sum + position.floating_profit, 0));
    const used = round(positions.reduce((sum, position) => sum + Math.abs(position.valuation), 0));
    const equity = round(state.balance + profit);
    const account = createEmptyAccountInfo(
      state.mock_account_id,
      state.currency,
      state.leverage,
      state.balance,
    );
    account.updated_at = state.updated_at;
    account.money.balance = round(state.balance);
    account.money.profit = profit;
    account.money.used = used;
    account.money.equity = equity;
    account.money.free = round(equity - used);
    account.positions = positions;
    return account;
  }

  getLastPrice(runtime: SignalTraderRuntimeConfig, product_id: string) {
    return this.ensureState(runtime).last_prices.get(product_id);
  }

  private toPosition(account_id: string, position: PaperMockPositionState): IPosition {
    const sign = position.direction === 'LONG' ? 1 : -1;
    const floatingProfit =
      position.direction === 'LONG'
        ? round((position.current_price - position.position_price) * position.volume)
        : round((position.position_price - position.current_price) * position.volume);
    const valuation = round(position.volume * position.current_price);
    return {
      position_id: encodePath(account_id, position.product_id, position.direction),
      account_id,
      product_id: position.product_id,
      direction: position.direction,
      volume: position.volume,
      free_volume: position.volume,
      position_price: position.position_price,
      closable_price: position.current_price,
      current_price: String(position.current_price),
      floating_profit: floatingProfit,
      valuation,
      size: String(sign * position.volume),
      free_size: String(sign * position.volume),
      notional: String(sign * valuation),
      updated_at: position.updated_at,
    };
  }
}
