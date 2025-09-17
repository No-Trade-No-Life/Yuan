export interface IAccountComposerConfig {
  account_id: string;
  enabled: boolean;
  sources: Array<{
    account_id: string;
    /**
     * - "ALL": select all positions and money
     * - "BY_PRODUCT": select only a position (no money), use source_datasource_id and source_product_id to filter; use target_datasource_id and target_product_id to specify where to open the position
     */
    type: string;
    /**
     * volume / free_volume multiple applied to the source account.
     */
    multiple?: number;
    /**
     * If true, force the output position volume to be 0, while keeping the product position data existing. Equivalent to setting multiple to 0, suitable for operations that require closing positions.
     */
    force_zero?: boolean;

    source_datasource_id?: string;
    source_product_id?: string;
    target_datasource_id?: string;
    target_product_id?: string;

    enabled: boolean;
  }>;
  created_at: string;
  updated_at: string;
}
