import { AddMigration } from '@yuants/sql';

AddMigration({
  id: '7c9189cb-a335-4e95-8174-cd6a975d19a2',
  name: 'create_table_data_product',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS product (
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        quote_currency TEXT NOT NULL,
        base_currency TEXT,
        price_step float8 DEFAULT 1 NOT NULL,
        volume_step float8 DEFAULT 1 NOT NULL,
        value_scale float8 DEFAULT 1 NOT NULL,
        value_unit TEXT DEFAULT '' NOT NULL,
        allow_long BOOLEAN DEFAULT TRUE NOT NULL,
        allow_short BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (datasource_id, product_id)
    );
  `,
});
