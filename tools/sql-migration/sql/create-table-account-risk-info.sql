CREATE TABLE IF NOT EXISTS
    account_risk_info (
        account_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        group_id TEXT NOT NULL,
        active_supply_threshold NUMERIC,
        active_supply_leverage NUMERIC,
        passive_supply_threshold NUMERIC,
        passive_supply_leverage NUMERIC,
        active_demand_threshold NUMERIC,
        active_demand_leverage NUMERIC,
        passive_demand_threshold NUMERIC,
        passive_demand_leverage NUMERIC,
        minimum_free NUMERIC,
        disabled BOOLEAN DEFAULT FALSE
    );