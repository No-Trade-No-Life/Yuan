import { Terminal } from '@yuants/protocol';
import { AddMigration, ExecuteMigrations } from '@yuants/sql';

AddMigration({
  id: '050323a5-1f56-4252-8aa7-e27097453708',
  name: 'create-table-account_risk_info',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS account_risk_info (
  account_id text NOT NULL,
  currency text NOT NULL,
  group_id text NOT NULL,
  active_supply_threshold numeric,
  active_supply_leverage numeric,
  passive_supply_threshold numeric,
  passive_supply_leverage numeric,
  active_demand_threshold numeric,
  active_demand_leverage numeric,
  passive_demand_threshold numeric,
  passive_demand_leverage numeric,
  minimum_free numeric,
  disabled boolean DEFAULT false
);`,
});

ExecuteMigrations(Terminal.fromNodeEnv());
