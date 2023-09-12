import { IAccountInfo, PositionVariant } from '@yuants/protocol';

export interface ITradeCopyRelation {
  source_account_id: string;
  source_product_id: string;
  target_account_id: string;
  target_product_id: string;
  multiple: number;
  /** 根据正则表达式匹配头寸的备注 (黑名单) */
  exclusive_comment_pattern?: string;
}

export const calcTargetVolumeMap = (
  source: Array<{ accountInfo: IAccountInfo; relation: ITradeCopyRelation }>,
): Record<string, number> => {
  const mapProductIdToNetVolume: Record<string, number> = {};

  for (const { accountInfo, relation } of source) {
    if (relation.source_account_id !== accountInfo.account_id) {
      continue;
    }
    for (const position of accountInfo.positions) {
      if (position.product_id !== relation.source_product_id) {
        continue;
      }
      const netVolume =
        (position.variant === PositionVariant.LONG ? 1 : -1) * position.volume * relation.multiple;
      mapProductIdToNetVolume[relation.target_product_id] =
        (mapProductIdToNetVolume[relation.target_product_id] ?? 0) + netVolume;
    }
  }

  return mapProductIdToNetVolume;
};
