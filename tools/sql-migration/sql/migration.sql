-- create_table_secret migration
CREATE TABLE IF NOT EXISTS
    secret (
        id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid (),
        public_data JSONB NOT NULL,
        encrypted_data_base58 TEXT NOT NULL,
        encryption_key_sha256_base58 TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON secret FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS secret_encryption_key_sha256_base58_idx ON secret (encryption_key_sha256_base58);

CREATE INDEX IF NOT EXISTS secret_updated_at ON secret (updated_at DESC);

CREATE INDEX IF NOT EXISTS secret_public_data ON secret USING gin (public_data);

-- create_table_deployment migration
CREATE TABLE IF NOT EXISTS
    deployment (
        id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid (),
        command TEXT NOT NULL,
        args JSONB NOT NULL DEFAULT '[]',
        env JSONB NOT NULL DEFAULT '{}',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON deployment FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS deployment_command_idx ON deployment (command);

CREATE INDEX IF NOT EXISTS deployment_updated_at ON deployment (updated_at DESC);

CREATE INDEX IF NOT EXISTS deployment_enabled ON deployment (enabled);

-- add_columns_package_name_version_to_deployment migration
ALTER TABLE deployment
ADD COLUMN IF NOT EXISTS package_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS package_version TEXT NOT NULL DEFAULT '';

-- alter_column_command_set_default_empty_string
ALTER TABLE deployment
ALTER COLUMN command
SET DEFAULT '';

-- add_column_address_to_deployment
ALTER TABLE deployment
ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';

-- create_table_series_collecting_task migration
CREATE TABLE IF NOT EXISTS
    series_collecting_task (
        table_name TEXT NOT NULL,
        series_id TEXT NOT NULL,
        cron_pattern TEXT NOT NULL,
        cron_timezone TEXT NOT NULL,
        disabled BOOLEAN NOT NULL DEFAULT FALSE,
        replay_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (table_name, series_id)
    );

CREATE INDEX IF NOT EXISTS idx_series_collecting_task_updated_at ON series_collecting_task (updated_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON series_collecting_task FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- create_table_quote migration
CREATE TABLE IF NOT EXISTS
    QUOTE (
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_price TEXT,
        ask_price TEXT,
        ask_volume TEXT,
        bid_price TEXT,
        bid_volume TEXT,
        open_interest TEXT,
        interest_rate_long TEXT,
        interest_rate_short TEXT,
        interest_rate_prev_settled_at TIMESTAMPTZ,
        interest_rate_next_settled_at TIMESTAMPTZ,
        PRIMARY KEY (datasource_id, product_id)
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON QUOTE FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS idx_quote_updated_at ON QUOTE (updated_at DESC);

-- create_table_product migration
CREATE TABLE IF NOT EXISTS
    product (
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        NAME TEXT NOT NULL,
        quote_currency TEXT NOT NULL,
        base_currency TEXT,
        price_step float8 DEFAULT 1 NOT NULL,
        volume_step float8 DEFAULT 1 NOT NULL,
        value_scale float8 DEFAULT 1 NOT NULL,
        value_scale_unit TEXT DEFAULT '' NOT NULL,
        margin_rate float8 DEFAULT 0 NOT NULL,
        value_based_cost float8 DEFAULT 0 NOT NULL,
        volume_based_cost float8 DEFAULT 0 NOT NULL,
        max_position float8 DEFAULT 0 NOT NULL,
        max_volume float8 DEFAULT 0 NOT NULL,
        allow_long BOOLEAN DEFAULT TRUE NOT NULL,
        allow_short BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (datasource_id, product_id)
    );

-- update_table_data_product_add_no_interest_rate migration
ALTER TABLE public.product
ADD COLUMN IF NOT EXISTS no_interest_rate BOOLEAN;

-- alert_table_data_product_add_market_id migration
ALTER TABLE public.product
ADD COLUMN IF NOT EXISTS market_id TEXT;

-- add_table_order migration
CREATE TABLE IF NOT EXISTS
    "order" (
        order_id TEXT,
        account_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        position_id TEXT,
        order_type TEXT,
        order_direction TEXT,
        volume DECIMAL(20, 8) NOT NULL,
        submit_at BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL,
        filled_at BIGINT,
        price DECIMAL(20, 8),
        traded_volume DECIMAL(20, 8),
        traded_price DECIMAL(20, 8),
        order_status TEXT,
        COMMENT TEXT,
        profit_correction DECIMAL(20, 8),
        real_profit DECIMAL(20, 8),
        inferred_base_currency_price DECIMAL(20, 8),
        take_profit_price DECIMAL(20, 8),
        stop_loss_price DECIMAL(20, 8),
        PRIMARY KEY (account_id, order_id)
    );

CREATE INDEX IF NOT EXISTS idx_order_account_id ON "order" (account_id);

CREATE INDEX IF NOT EXISTS idx_order_product_id ON "order" (product_id);

CREATE INDEX IF NOT EXISTS idx_order_position_id ON "order" (position_id);

CREATE INDEX IF NOT EXISTS idx_order_order_id ON "order" (order_id);

CREATE INDEX IF NOT EXISTS idx_order_submit_at ON "order" (submit_at);

CREATE INDEX IF NOT EXISTS idx_order_updated_at ON "order" (updated_at);

CREATE INDEX IF NOT EXISTS idx_order_created_at ON "order" (created_at);

CREATE INDEX IF NOT EXISTS idx_order_filled_at ON "order" (filled_at);

-- add_column_traded_value migration
ALTER TABLE "order"
ADD COLUMN IF NOT EXISTS traded_value DECIMAL(20, 8);

-- create_table_ohlc migration
CREATE TABLE IF NOT EXISTS
    ohlc (
        series_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        duration TEXT NOT NULL,
        closed_at TIMESTAMPTZ NOT NULL,
        open TEXT NOT NULL,
        high TEXT NOT NULL,
        low TEXT NOT NULL,
        CLOSE TEXT NOT NULL,
        volume TEXT,
        open_interest TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (series_id, created_at)
    );

CREATE INDEX IF NOT EXISTS idx_ohlc_series_id_created_at ON ohlc (series_id, created_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON ohlc FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- account_composition_relation table
CREATE TABLE IF NOT EXISTS
    account_composition_relation (
        id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid (),
        source_account_id TEXT NOT NULL,
        target_account_id TEXT NOT NULL,
        multiple FLOAT8 NOT NULL,
        hide_positions BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON account_composition_relation FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- account_composer_config table
CREATE TABLE IF NOT EXISTS
    account_composer_config (
        account_id TEXT PRIMARY KEY NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sources JSONB NOT NULL DEFAULT '[]'::JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON account_composer_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- alert_receiver_config table
CREATE TABLE IF NOT EXISTS
    alert_receiver_config (
        TYPE TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        enabled BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (
            TYPE,
            receiver_id
        )
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON alert_receiver_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

-- email table
CREATE TABLE IF NOT EXISTS
    email (
        address TEXT NOT NULL,
        uid TEXT NOT NULL,
        attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
        body JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (address, uid)
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON email FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS email_address_idx ON email (address);

--