# Vendor Implementation Checklist

Every vendor process must expose the same set of services, channels, and configuration hooks so `trade-copier` and the transfer stack can interoperate without venue-specific patches. Use this checklist whenever you onboard, audit, or extend a vendor.

## 0. Runtime & API Layering

- **Why:** Keeps CLI vs. daemon behavior aligned, prevents hidden global state, and makes multi-account extensions trivial.
- **Requirements:**
  - `src/index.ts` must only aggregate modules (`import './account'; import './order-actions'; …`). Business logic lives inside the imported files.
  - Inject credentials via environment variables (`ACCESS_KEY`, `SECRET_KEY`, `PASSPHRASE`, …) and split REST helpers:
    - `src/api/public-api.ts`: pure functions for unauthenticated endpoints—**never** accept credentials.
    - `src/api/private-api.ts`: every function explicitly receives a `credential`, making credential rotation obvious.
  - Cache UID/parent info via `@yuants/cache`, generate account IDs as `vendor/<uid>/<scope>`, and reuse the cache across accounts, transfers, and credential-aware RPCs.

## 1. Account Snapshot Service

- **API:** `provideAccountInfoService` (`@yuants/data-account`)
- **Why:** Maker strategies (`apps/trade-copier/src/BBO_MAKER.ts`), the Web UI (`ui/web/src/modules/TradingBoard/AccountInfo.tsx`), and CLI inspections subscribe to the same stream.
- **Requirements:**
  - Publish every copier-controlled account with live balances and per-product positions (direction, volume, free volume, average price, mark price, floating PnL, equity/free funds).
  - Refresh automatically (≈1 s for derivatives). Handle reconnects and throttle according to venue limits.
  - Call `addAccountMarket` so downstream tooling knows which market the account belongs to.

## 2. Pending Order Service

- **API:** `providePendingOrdersService` (`@yuants/data-order`)
- **Why:** `queryPendingOrders` feeds both maker loops and manual troubleshooting; stale data causes runaway exposure.
- **Requirements:**
  - Always call the venue’s _official_ “open orders” REST (e.g., `/mix/order/orders-pending`, `/spot/trade/orders-pending`). Do **not** reconstruct from submissions.
  - Map `product_id` using `encodePath(instType, instId)` (or `encodePath('SPOT', symbol)`), convert `side/posSide/tradeSide` to Yuan’s `OPEN_*` / `CLOSE_*` directions, surface `submit_at`, `price`, and `traded_volume`.
  - Register one service per account (futures, spot, funding, etc.) and refresh every ≤5 s within rate limits.

## 3. Product Catalog

- **API:** `provideQueryProductsService` / SQL writer (`@yuants/data-product`)
- **Why:** Copier clamps price/volume steps, calculates margin, and populates UI selectors from this feed.
- **Implementation:** Fetch products in `src/public-data/product.ts`, map them to `IProduct`, and write to the `product` table via `createSQLWriter`. Refresh at least hourly (`repeat({ delay: 3600_000 })`) and keep `datasource_id` consistent.

## 4. Public Market Data & Quote Channel

- **Directory:** `src/public-data/*`
- **Why:** Prevents duplicated quote writers and keeps SQL/channel publishers consistent for every vendor.
- **Expectations:**
  - Group quote, funding-rate, OHLC, market-order scripts under this folder and import them from `src/index.ts`.
  - Quote publishers must write to SQL via `@yuants/sql`’s `writeToSQL` when `WRITE_QUOTE_TO_SQL` equals `1` or `true`, otherwise only publish Channels. Channels must include `last/bid/ask/open_interest/updated_at` and follow the `@yuants/data-quote` schema.
  - Always expose `quote/{datasource_id}/{product_id}` through `terminal.channel.publishChannel('quote', { pattern: '^DATASOURCE/' }, …)` to avoid ad-hoc Subjects.
  - When WebSocket feeds fail, fall back to REST polling with monotonic timestamps.

## 5. Trading RPCs

### 5.1 Default Account RPCs (`order-actions.ts`)

- **Why:** Copier/CLI rely on a predictable account ID; logging and schema validation keep audits simple.

- Provide `SubmitOrder` and `CancelOrder` services bound to the cached default credential/account ID. Schema must pin `account_id`.
- Translate `IOrder` to venue parameters via helper functions (e.g., `order-utils.ts`). Log both the Yuan payload and translated request for audits.
- Return `{ res: { code: 0, message: 'OK', data?: { order_id } } }` and propagate venue errors verbatim.

### 5.2 Credential-Aware RPCs (`order-actions-with-credential.ts`)

- **Why:** Enables arbitrary accounts without redeploying, removing environment-variable scaling limits.

- Expose alternate `SubmitOrder` / `CancelOrder` (and `ModifyOrder` when needed) that validate `account_id` with a regex (e.g., `^vendor/`) and require a `credential` object containing `access_key`, `secret_key`, and `passphrase`.
- Use the provided credential per request to support arbitrary accounts without redeploying.

## 6. Transfer Interface (`src/transfer.ts`)

- **Why:** `@yuants/app-transfer-controller` needs vendors to execute on-chain/internal moves and report status for every route.

- Register every (`account_id`, `network_id`, `currency`, `address`) tuple via `addAccountTransferAddress` so `@yuants/app-transfer-controller` can plan multi-hop routes.
- Implement long-running withdrawals as state machines (`INIT → PENDING → COMPLETE`), storing context in `current_tx_context` and returning `transaction_id` / `received_amount` via `onEval`.
- Cover on-chain withdrawals, internal spot↔derivatives transfers, and parent/child account shuffles using the same cached credential.

## 7. CLI & Operational Alignment

- **Why:** Uniform entrypoints and feature flags avoid deployment drift and reduce debugging friction.

- `src/cli.ts` should only import `./index`.
- All modules must instantiate `Terminal` via `Terminal.fromNodeEnv()` so tags (host/namespace/instance) remain consistent.
- Mirror existing feature flags (`WRITE_QUOTE_TO_SQL`, `DISABLE_TRANSFER`, …) to keep operational controls uniform.

## 8. Validation Steps

- **Why:** Until automated smoke tests exist, manual verification is the only way to guarantee production readiness.

`yuanctl`-based smoke tests are still TBD. Until then, verify each vendor manually:

1. **Compile:** `npx tsc --noEmit --project apps/vendor-<vendor>/tsconfig.json`.
2. **Interface checks:**
   - `QueryAccountInfo` or `useAccountInfo` script → compare with the venue portal.
   - `queryPendingOrders(terminal, account_id, true)` → ensure it matches the venue’s open-order page.
   - `QueryProducts` (`force_update: true`) → validate step sizes/margin fields against docs.
   - Subscribe to `quote/{datasource_id}/{product_id}` → confirm 1 Hz updates and monotonic timestamps.
   - Run `apps/vendor-*/src/e2e/submit-order.e2e.test.ts` (or equivalent) → submit & cancel a small order; expect `code = 0` and consistent pending orders.
3. **Transfer checks:** For every (`account_id`, `network_id`, `currency`, `address`), run a dry `TransferApply` via the transfer controller and follow up with `TransferEval` to confirm `received_amount` or `transaction_id`.

## 9. Recommended Layout

```
src/
├── account.ts                      # UID cache + account/pending services
├── api/
│   ├── public-api.ts               # Unauthenticated REST helpers
│   └── private-api.ts              # Authenticated REST helpers (function-based)
├── order-actions.ts                # Default Submit/Cancel RPCs
├── order-actions-with-credential.ts# Credential-aware RPCs
├── order-utils.ts                  # Order direction/param helpers
├── public-data/
│   ├── product.ts
│   ├── quote.ts
│   ├── interest-rate.ts
│   └── utils/…
└── transfer.ts                     # On-chain + internal transfers
```

## 10. Reference Implementations

- **`apps/vendor-okx`** – fully modular architecture with credential-aware RPCs, cache usage, and comprehensive public-data workers.
- **`apps/vendor-bitget`** – recent refactor showcasing how to migrate to the public/private API split, `public-data/*` layout, and multi-account order services.

Use these projects as blueprints when adding new vendors; mirroring their structure greatly simplifies reviews and reduces back-and-forth.
