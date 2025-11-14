## Stage 1: Documentation Alignment
**Goal**: Update vendor implementation checklist so it fully describes the layering, directory structure, and services required for vendors, matching okx/bitget practices.
**Success Criteria**: Checklist explicitly describes API layering, public-data layout, and service responsibilities used later in code changes.
**Tests**: Proofread and ensure no TODOs remain.
**Status**: Complete

## Stage 2: API Layering Refactor
**Goal**: Split Binance API access into client/public/private modules with shared credential helpers.
**Success Criteria**: `apps/vendor-binance/src/api` contains `client.ts`, `public-api.ts`, `private-api.ts`, and no longer exports the monolithic legacy API file.
**Tests**: `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`.
**Status**: Complete

## Stage 3: Account & Order Services
**Goal**: Rebuild account snapshot, pending orders, and order RPCs using the new API modules and consistent account IDs.
**Success Criteria**: `account.ts`, `order-actions*.ts`, and `order-utils.ts` align with okx/bitget patterns, `legacy_index.ts` no longer needed for these features.
**Tests**: `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`.
**Status**: Complete

## Stage 4: Transfer Flows & Public Data
**Goal**: Implement transfer services and reorganize public data scripts under `src/public-data` using the new API modules.
**Success Criteria**: `transfer.ts` implements flows, public-data modules relocated and imported by `src/index.ts`.
**Tests**: `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`.
**Status**: Complete

## Stage 5: Entry Wiring & Cleanup
**Goal**: Update `src/index.ts`, remove legacy files, ensure packaging references new structure, and run final verification.
**Success Criteria**: `src/index.ts` only references new modules, `legacy_index.ts` deleted, package metadata updated if needed.
**Tests**: `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`.
**Status**: Complete
