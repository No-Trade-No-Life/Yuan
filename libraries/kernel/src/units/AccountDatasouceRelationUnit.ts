import { encodePath } from '@yuants/utils';
import { BasicUnit } from './BasicUnit';

interface IAccountDatasourceRelation {
  account_id: string;
  datasource_id: string;
  product_id: string;
}

/**
 * @public
 */
export class AccountDatasourceRelationUnit extends BasicUnit {
  private map: Record<string, IAccountDatasourceRelation> = {};

  list(): IAccountDatasourceRelation[] {
    return Object.values(this.map);
  }

  updateRelation(relation: IAccountDatasourceRelation) {
    this.map[encodePath(relation.account_id, relation.datasource_id, relation.product_id)] = relation;
  }

  restore(state: any): void {
    this.map = state.map;
  }

  dump(): any {
    return {
      map: this.map,
    };
  }
}
