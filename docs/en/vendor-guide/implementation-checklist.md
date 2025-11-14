# Vendor Implementation Checklist

Every vendor process must implement the same infrastructure so that both `trade-copier` and the transfer stack can reuse it. Missing any interface breaks order execution, reconciliation, or fund transfers. Use this checklist whenever you onboard, audit, or extend a vendor.

## 1. Account Snapshot Service

- **API:** `provideAccountInfoService` (`@yuants/data-account`)
- **Why:** `runStrategyBboMaker*` (see `apps/trade-copier/src/BBO_MAKER.ts`) uses `useAccountInfo` to compare expected vs. actual exposure, while the Web UI (`ui/web/src/modules/TradingBoard/AccountInfo.tsx`) and `yuanctl` inspections rely on the same stream.
- **Dependents:** `trade-copier`, GUI account dashboards, CLI tooling, any strategy that calls `useAccountInfo`.
- **Requirements:**
  - Expose every copier-driven trading account with up-to-date balances and per-product positions.
  - Include direction, volume, average price, equity, available balance, and credit lines when available.
  - Refresh automatically (≈1 s for derivatives) via polling or push channels; handle reconnect logic.

## 2. Pending Order Service

- **API:** `providePendingOrdersService` (`@yuants/data-order`)
- **Why:** `queryPendingOrders` feeds both maker strategies (`apps/trade-copier/src/BBO_MAKER_BY_DIRECTION.ts`) and manual troubleshooting to decide when to cancel or adjust in-flight orders.
- **Dependents:** `trade-copier`, `yuanctl query pending-orders`, Web TradingBoard overlays.
- **Requirements:**
  - Return all live orders for each account with `order_id`, `product_id`, `order_type`, `order_direction`, `volume`, `price`, `submit_at`, and venue-specific metadata if needed.
  - Refresh at a cadence allowed by the venue (prefer ≤3 s); deduplicate updates to avoid flapping.
  - Keep `order_id` consistent with what Submit/Cancel RPCs return.

## 3. Product Catalog

- **API:** `provideQueryProductsService` (`@yuants/data-product`)
- **Why:** The copier reads product specs from SQL to clamp price/volume steps, calculate margin, and populate UI selectors.
- **Dependents:** `trade-copier`, `apps/vendor-*/src/e2e/submit-order.e2e.test.ts`, GUI product pickers, risk monitors.
- **Requirements:**
  - Provide `product_id`, `datasource_id`, `volume_step`, `price_step`, `margin_rate`, contract size, allowed directions, etc.; follow existing refs such as `apps/vendor-okx/src/product.ts` and `apps/vendor-hyperliquid/src/product.ts`.
  - Auto-refresh at least hourly (swap listings change quickly); use `auto_refresh_interval` like other vendors.
  - Keep `datasource_id` identical across services (`ASTER`, `HYPERLIQUID`, `OKX`, …) so downstream joins work.

## 4. Quote Channel (mandatory for BBO strategies)

- **API:** Publish `quote` channel via `terminal.channel.publishChannel('quote', { pattern: '^VENDOR/' }, …)`
- **Why:** `runStrategyBboMaker` subscribes to `quote/{datasource_id}/{product_id}` for bid/ask spreads, while analytics jobs reuse the same feed.
- **Dependents:** `trade-copier`, discretionary agents, monitoring dashboards, SQL snapshots (`quote` table).
- **Requirements:**
  - Stream `last_price`, `bid_price`, `ask_price`, `open_interest`/depth if available, and `updated_at`.
  - Follow the gating pattern from `apps/vendor-hyperliquid/src/quote.ts` using `WRITE_QUOTE_TO_SQL` to avoid dual publishing.
  - Respect venue throttling—fall back to REST polling when WebSocket is unavailable, but keep timestamps monotonic.

## 5. Trading RPCs

### SubmitOrder

- **API:** `terminal.server.provideService<IOrder>('SubmitOrder', …)`
- **Why:** All automated strategies and ops scripts send their orders through this RPC to keep auditing centralized.
- **Dependents:** `trade-copier`, `yuanctl submit-order`, integration tests such as `apps/vendor-aster/src/e2e/submit-order.e2e.test.ts`.
- **Requirements:**
  - Support `OPEN_LONG`, `CLOSE_LONG`, `OPEN_SHORT`, `CLOSE_SHORT` with `MARKET`, `LIMIT`, `MAKER` at minimum.
  - Return `{ res: { code: 0, message: 'OK', data?: { order_id } } }`; propagate venue-side error codes verbatim.
  - Log both the Yuan order payload and translated venue request for incident triage.
  - If you must support multiple or dynamic accounts, mirror `apps/vendor-okx/src/order-actions-with-credential.ts`: provide an alternate RPC that validates `account_id` via regex and requires `credential` objects (`access_key` / `secret_key` / `passphrase`) per request, so you are not limited by environment variables while keeping parity with the legacy single-account service.

### CancelOrder

- **API:** `terminal.server.provideService<IOrder>('CancelOrder', …)`
- **Why:** Maker loops continuously cancel/repost; without reliable cancels, the copier cannot converge to target exposure.
- **Dependents:** `trade-copier`, `yuanctl cancel-order`, manual kill-switch tooling.
- **Requirements:**
  - Accept `order_id`, `product_id`, `account_id`; reject unknown orders explicitly.
  - Return `code = 0` on success; include venue error payload for observability on failure.

## 6. Transfer Interface

- **API:** `addAccountTransferAddress` helper or the underlying `TransferApply` / `TransferEval` services (`@yuants/transfer`).
- **Why:** `@yuants/app-transfer-controller` (`apps/transfer-controller/src/index.ts`) orchestrates multi-hop fund flows and needs each vendor to execute and reconcile steps for the routes it plans.
- **Dependents:** Transfer Controller, bespoke funding automations, cross-venue treasury bots.
- **Requirements:**
  - Register every (`account_id`, `network_id`, `currency`, `address`) tuple exposed in `account_address_info` so the controller can plan routes.
  - Implement state machines for long-running withdrawals (e.g., `INIT` → `AWAIT_TX_ID` → `COMPLETE`) and return context via `current_tx_context` as shown in `docs/en/vendor-guide/vendor-transfer.md`.
  - Surface reconciliation via `onEval`/`TransferEval`, including `received_amount` or `transaction_id` when available.

## Additional Guidance

### Supporting Configuration

- Document all credentials/endpoints (`API_KEY`, `SECRET_KEY`, `PASSPHRASE`, `HOST_URL`, …) and reuse them across trading and transfer modules.
- When introducing caching or secret management, follow the OKX pattern (`apps/vendor-okx/src/account.ts`)—use `@yuants/cache` for SWR/TTL polling and `@yuants/secret` to store sensitive keys, reducing API throttling while keeping multi-account expansion safe.
- Ensure `Terminal.fromNodeEnv()` can discover the correct host, namespace, and instance tags.
- Keep feature flags aligned with existing vendors (`WRITE_QUOTE_TO_SQL`, `DISABLE_TRANSFER`, etc.) so ops can toggle workloads consistently.
- Group public market data scripts under a `public-data/*` style folder and import them centrally via `index.ts`, similar to the OKX vendor, to avoid scattered quote/interest workers that cannot be reused.

### Validation Steps

`yuanctl`-based smoke tests are TBD. During the interim, perform the following manual end-to-end verification before routing production flow:

1. Compile-time safety: `npx tsc --noEmit --project apps/vendor-<vendor>/tsconfig.json`.
2. Interface-by-interface checks (run against a staging host or sandbox account):
   - **Account Snapshot**: call `terminal.client.requestForResponse('QueryAccountInfo', { account_id })` or subscribe via a short script using `useAccountInfo`; verify positions/balances match the venue portal.
   - **Pending Orders**: invoke `queryPendingOrders(terminal, account_id, true)` and compare with the venue’s open-order list.
   - **Product Catalog**: hit `terminal.client.requestForResponse('QueryProducts', { datasource_id: 'VENDOR_ID', force_update: true })` and confirm step sizes / margin fields align with the exchange docs.
   - **Quote Channel**: run a temporary subscriber for `quote/{datasource_id}/{product_id}` (e.g., via `terminal.channel.subscribeChannel`) to ensure bid/ask fields update each second and timestamps are monotonic.
   - **SubmitOrder / CancelOrder**: execute the existing E2E script (`apps/vendor-*/src/e2e/submit-order.e2e.test.ts`) or an equivalent manual script to place and cancel a tiny order; confirm the RPC returns `code = 0`, the order appears in the pending list, and cancellation clears it.
3. Transfer path checks:
   - For every (`account_id`, `network_id`, `currency`, `address`) tuple, run `TransferApply` once (via `@yuants/app-transfer-controller` dry run or a custom script), ensuring the state machine progresses `INIT → … → COMPLETE`.
   - Invoke `TransferEval` afterward to verify `received_amount` or `transaction_id` is populated; reconcile with the venue’s transfer history.

Clearing this checklist keeps vendors compatible with both the trading and transfer controllers without venue-specific hotfixes.
