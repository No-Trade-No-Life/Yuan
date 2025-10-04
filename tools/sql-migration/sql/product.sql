-- product 表
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

-- 添加 no_interest_rate 列
ALTER TABLE public.product
ADD COLUMN IF NOT EXISTS no_interest_rate BOOLEAN;

-- 添加 market_id 列
ALTER TABLE public.product
ADD COLUMN IF NOT EXISTS market_id TEXT;
