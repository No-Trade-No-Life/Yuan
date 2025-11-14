# @yuants/vendor-bitget

Bitget vendor adapter exposing trading, account, transfer, and public data streams used by `trade-copier`, `transfer-controller`, and CLI tooling.

## Capabilities

- **Account snapshots & pending orders** – caches UID/profile data via `@yuants/cache`, publishes USDT futures and spot account info, and keeps pending orders in sync through `/mix/order/orders-pending`.
- **Order services** – legacy single-account RPCs plus opt-in credential-based `SubmitOrder` / `CancelOrder` so callers can provide arbitrary API keys at runtime.
- **Market data pipeline** – `public-data/*` hosts product catalog, quotes, funding rate history, and writes both SQL tables and live quote channels.
- **Transfer flows** – on-chain TRC20 withdrawals, internal spot↔futures shuffles, and sub-account transfers are registered through `addAccountTransferAddress`.

## Directory layout

```
src/
├── account.ts              # Account caches, account info + pending order services
├── api/
│   ├── client.ts           # REST client + credential cache
│   ├── private-api.ts      # Authenticated endpoints
│   └── public-api.ts       # Rate-limited public endpoints
├── order-actions*.ts       # Submit/Cancel RPCs (default + credential-aware)
├── order-utils.ts          # Shared helpers for Bitget order params
├── public-data/
│   ├── interest-rate.ts
│   ├── product.ts
│   ├── quote.ts
│   └── utils/cyclic-task.ts
└── transfer.ts             # On-chain, internal, and sub-account transfer services
```

## Runtime expectations

1. Set `ACCESS_KEY`, `SECRET_KEY`, and `PASSPHRASE` before launching `cli.ts`/`index.ts`.
2. `Terminal.fromNodeEnv()` discovers namespace/instance tags and bootstraps every module via `src/index.ts`.
3. `@yuants/cache` keeps Bitget UID/profile stable so account IDs follow the `bitget/<uid>/<scope>` naming convention across services.
4. Enable `WRITE_QUOTE_TO_SQL=1` when you want to persist quotes; otherwise the publisher only emits Terminal channels.

Follow `docs/en/vendor-guide/implementation-checklist.md` when extending or adding new Bitget capabilities so the interface contract remains copier-compatible.
