# @yuants/vendor-turboflow

TurboFlow DEX vendor integration for Yuan trading system.

## Overview

This package provides integration with TurboFlow DEX, implementing both account and order management services with credential-based authentication.

## Features

- **Account Actions**: List accounts and retrieve account information including positions
- **Order Actions**: Submit, cancel, modify, and list orders
- **Credential-based Authentication**: Uses ED25519 private key for secure API access

## Credentials

The TurboFlow vendor requires the following credential:

```json
{
  "private_key": "base58-encoded-ed25519-private-key"
}
```

## Account Actions

### List Accounts

Lists all accounts associated with the credential.

**Returns**: Array of account objects with `account_id` in the format `turboflow/{account_id}`

### Get Account Info

Retrieves detailed account information including:

- Asset balances
- Open positions with:
  - Position ID
  - Product ID (PERPETUAL market)
  - Direction (LONG/SHORT)
  - Volume and free volume
  - Position price and closable price
  - Floating profit
  - Valuation and margin
  - Additional metadata (pool_id, leverage, margin_type, etc.)

## Order Actions

### Submit Order

Submits a new order to TurboFlow.

**Parameters**:

- `order`: IOrder object containing:
  - `product_id`: Product identifier
  - `order_type`: LIMIT or MARKET
  - `order_direction`: OPEN_LONG, CLOSE_SHORT, OPEN_SHORT, or CLOSE_LONG
  - `volume`: Order size
  - `price`: Order price (for limit orders)
  - `comment`: JSON string with additional parameters (pool_id, coin_code, leverage, etc.)

**Returns**: Object with `order_id`

### Cancel Order

Cancels an existing order.

**Parameters**:

- `order`: IOrder object with `order_id` and `product_id`

### Modify Order

Modifies an existing order (position-based).

**Parameters**:

- `order`: IOrder object with:
  - `order_id`
  - `price`: New price
  - `volume`: New volume
  - `comment`: JSON string with `position_id` and optional `tp_order`/`sl_order`

### List Orders

Lists all pending orders for an account.

**Returns**: Array of IOrder objects

## Order Direction Mapping

TurboFlow uses numeric order_way values:

- `1`: Open Long (开多)
- `2`: Close Short (平空)
- `3`: Open Short (开空)
- `4`: Close Long (平多)

## Usage

The vendor is automatically registered when the package is imported:

```typescript
import '@yuants/vendor-turboflow';
```

The services will be available through the Yuan terminal with datasource ID `TURBOFLOW`.

## API Documentation

For detailed API documentation, refer to `TurboFlow_API_Key_认证接口文档.txt` in the `src/api` directory.

## Development

### Build

```bash
rushx build
```

### Run

```bash
rushx dev
```

## Dependencies

- `@yuants/data-account`: Account data management
- `@yuants/data-order`: Order data management
- `@yuants/protocol`: Yuan protocol definitions
- `@yuants/utils`: Utility functions including ED25519 signing
