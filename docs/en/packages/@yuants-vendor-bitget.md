# @yuants/vendor-bitget

Bitget integration that mirrors the OKX vendor architecture: cached account discovery, modular public-data workers, trading RPCs (single-account plus credential-aware), and transfer state machines.

## Highlights

- **Account core** – `src/account.ts` caches UID/profile via `@yuants/cache`, publishes both futures & spot account snapshots (`provideAccountInfoService`), and keeps `providePendingOrdersService` hydrated from `/api/v2/mix/order/orders-pending`.
- **Trading RPCs** – `src/order-actions.ts` exposes the legacy single-account `SubmitOrder`/`CancelOrder`, while `src/order-actions-with-credential.ts` enforces `account_id` regex + credential schema so callers can pass arbitrary API keys per request.
- **Market data** – `src/public-data/*` gathers product catalog, quotes, funding rate history, and writes SQL rows through `@yuants/sql`, matching the `public-data` layout mandated by the implementation checklist.
- **Transfers** – `src/transfer.ts` registers TRC20 withdrawals, spot↔USDT futures shuffles, and parent/sub-account routes with `addAccountTransferAddress`, enabling `@yuants/transfer` controllers to stitch end-to-end flows.

Consult `apps/vendor-bitget/README.md` for the exact directory map and bootstrapping requirements.
