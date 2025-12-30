import { AccountDatasourceRelationUnit } from './AccountDatasouceRelationUnit';
import { BasicUnit } from './BasicUnit';

interface IQuote {
  datasource_id: string;
  product_id: string;
  ask: number;
  bid: number;
}

/**
 * 报价数据单元
 * @public
 */
export class QuoteDataUnit extends BasicUnit {
  private adrUnit: AccountDatasourceRelationUnit | undefined;
  private mapProductIdToQuote: Record<string, Record<string, IQuote>> = {};
  private mapDatasourceIdMapProductIdToAccountIds: Record<string, Record<string, Set<string>>> = {};
  private currentEventId: number = -1;
  /**
   * 本事件内发生变化的产品ID
   */
  dirtyProductIds: Set<string> = new Set();

  onInit(): void | Promise<void> {
    this.adrUnit = this.kernel.findUnit(AccountDatasourceRelationUnit);
    if (this.adrUnit) {
      for (const relation of this.adrUnit.list()) {
        ((this.mapDatasourceIdMapProductIdToAccountIds[relation.datasource_id] ??= {})[
          relation.product_id
        ] ??= new Set()).add(relation.account_id);
      }
    }
  }

  getQuote(datasource_id: string, product_id: string): IQuote | undefined {
    return (
      this.mapProductIdToQuote[datasource_id]?.[product_id] ?? this.mapProductIdToQuote['']?.[product_id]
    );
  }

  private _updateQuote(quote: IQuote) {
    if (this.currentEventId !== this.kernel.currentEventId) {
      this.dirtyProductIds.clear();
      this.currentEventId = this.kernel.currentEventId;
    }

    (this.mapProductIdToQuote[quote.datasource_id] ??= {})[quote.product_id] = quote;
    (this.mapProductIdToQuote[''] ??= {})[quote.product_id] = quote;
    this.mapDatasourceIdMapProductIdToAccountIds[quote.datasource_id]?.[quote.product_id]?.forEach(
      (account_id) => {
        (this.mapProductIdToQuote[account_id] ??= {})[quote.product_id] = quote;
      },
    );
    this.dirtyProductIds.add(quote.product_id);
  }

  updateQuote(datasource_id: string, product_id: string, ask: number, bid: number) {
    this._updateQuote({
      datasource_id,
      product_id,
      ask,
      bid,
    });
  }

  listQuotes(): IQuote[] {
    return Object.values(this.mapProductIdToQuote).flatMap((x) => Object.values(x));
  }

  dump() {
    return {
      mapProductIdToQuote: this.mapProductIdToQuote,
      mapDatasourceIdMapProductIdToAccountIds: this.mapDatasourceIdMapProductIdToAccountIds,
    };
  }
  restore(state: any): void {
    this.mapProductIdToQuote = state.mapProductIdToQuote;
    this.mapDatasourceIdMapProductIdToAccountIds = state.mapDatasourceIdMapProductIdToAccountIds;
  }
}
