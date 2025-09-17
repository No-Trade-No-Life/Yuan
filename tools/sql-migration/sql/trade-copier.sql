CREATE TABLE IF NOT EXISTS
    trade_copy_relation (
        id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid (),
        source_account_id TEXT NOT NULL,
        target_account_id TEXT NOT NULL,
        source_product_id TEXT NOT NULL,
        target_product_id TEXT NOT NULL,
        multiple FLOAT8 NOT NULL,
        disabled BOOLEAN NOT NULL DEFAULT FALSE,
        exclusive_comment_pattern TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON trade_copy_relation FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE TABLE IF NOT EXISTS
    trade_copier_trade_config (
        id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid (),
        account_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        max_volume_per_order FLOAT8 NOT NULL,
        disabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON trade_copier_trade_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

ALTER TABLE trade_copier_trade_config
ADD COLUMN limit_order_control BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS
    trade_copier_config (
        account_id TEXT PRIMARY KEY NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        strategy JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON trade_copier_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();