# Trade-Copier Vendor Requirements

The `trade-copier` strategies expect every vendor to expose the same services and channels on the host. Missing any of them will break reconciliation or order submission. Use this checklist when onboarding or auditing a vendor.

## 1. Account Snapshot Service

- **API:** `provideAccountInfoService` (`@yuants/data-account`)
- **Purpose:** `runStrategyBboMaker*` compares the actual account with the expected account through `useAccountInfo`.
- **Requirements:**
  - Expose every trading account driven by the copier.
  - Include per-product positions (direction, volume, average price) plus equity/free balance.
  - Auto refresh (≈1 s for futures accounts is recommended).

## 2. Pending Order Service

- **API:** `providePendingOrdersService` (`@yuants/data-order`)
- **Purpose:** Strategies call `queryPendingOrders` to decide whether to cancel or update in-flight orders.
- **Requirements:**
  - List all open orders under each copier account.
  - Populate `order_id`, `product_id`, `order_type`, `order_direction`, `volume`, `price`, `submit_at`.
  - Refresh every few seconds (faster if the exchange allows it).

## 3. Product Catalog

- **API:** `provideQueryProductsService` (`@yuants/data-product`)
- **Purpose:** The copier reads product metadata from SQL to compute price/volume steps.
- **Requirements:**
  - Provide `product_id`, `datasource_id`, `volume_step`, `price_step`, margin parameters, etc.
  - Refresh periodically (hourly/daily depending on the venue).
  - Keep `datasource_id` consistent with other modules (e.g., `ASTER`, `HYPERLIQUID`).

## 4. Quote Channel (mandatory for BBO strategies)

- **API:** publish `quote` channel (`terminal.channel.publishChannel('quote', { pattern: '^VENDOR/' }, …)`).
- **Purpose:** `runStrategyBboMaker` subscribes to `quote/{datasource_id}/{product_id}` for bid/ask prices.
- **Requirements:**
  - Use the venue’s REST polling or WebSocket feed.
  - Emit `last_price`, `bid_price`, `ask_price`, `updated_at`.
  - Guard SQL writes / channel publishing with `WRITE_QUOTE_TO_SQL` (same pattern as `apps/vendor-okx/src/quote.ts`).

## 5. Trading RPCs

### SubmitOrder

- **API:** `terminal.server.provideService<IOrder>('SubmitOrder', …)`
- **Usage:** The copier calls `terminal.client.requestForResponse('SubmitOrder', order)` for every action.
- **Requirements:**
  - Support all four directions: `OPEN_LONG`, `CLOSE_LONG`, `OPEN_SHORT`, `CLOSE_SHORT`.
  - Support at least `MARKET`, `LIMIT`, `MAKER`.
  - Return `{ res: { code: 0, message: 'OK', data?: { order_id } } }` so order ids can be tracked.

### CancelOrder

- **API:** `terminal.server.provideService<IOrder>('CancelOrder', …)`
- **Usage:** Copier cancels stale maker orders or re-issues them with new parameters.
- **Requirements:**
  - Accept `order_id`, `product_id`, `account_id`.
  - Return `code = 0` on success; forward the exchange error payload otherwise.

## 6. Supporting Configuration

- **Environment variables:** provide all required credentials/endpoints (`API_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `HOST_URL`, …).
- **Terminal metadata:** document the necessary host env vars so `Terminal.fromNodeEnv()` can connect reliably.
- **Feature flags:** follow existing conventions (`WRITE_QUOTE_TO_SQL`, etc.) to control optional workloads.

## 7. Validation Steps

Before enabling the copier against a vendor, go through:

1. `npx tsc --noEmit --project apps/vendor-<vendor>/tsconfig.json` — static safety.
2. Manual smoke tests via `yuanctl`: `QueryAccountInfo`, `QueryPendingOrders`, `SubmitOrder`, `CancelOrder`.
3. Run `trade-copier` in a sandbox account and check logs for:
   - `StrategyStart` / `StrategyEnd` per product
   - Successful `SubmitOrder` / `CancelOrder`
   - No `RunStrategyError` due to missing services

Following this list keeps every vendor compatible with the stable trade-copier branch without exchange-specific hacks.
