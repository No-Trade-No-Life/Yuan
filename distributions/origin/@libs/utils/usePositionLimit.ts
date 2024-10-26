import { useSinglePosition } from '@libs';
/**
 * Derive a PositionLimit account from the source account.
 *
 * The derived account has a specified position limit. Its positions' volume will be limited to the position limit.
 *
 */
export function usePositionLimit(source_account_id: string, product_id: string, positionLimit: number) {
  const src = useAccountInfo({ account_id: source_account_id });
  const tar = useAccountInfo({
    account_id: `${source_account_id}-PL_${positionLimit}`,
    currency: src.money.currency,
    leverage: src.money.leverage,
  });
  const pL = useSinglePosition(product_id, 'LONG', tar.account_id);
  const pS = useSinglePosition(product_id, 'SHORT', tar.account_id);
  useEffect(() => {
    const srcNetPosition = src.positions.reduce(
      (acc, cur) =>
        acc + (cur.product_id !== product_id ? 0 : cur.volume * (cur.direction === 'LONG' ? 1 : -1)),
      0,
    );
    pL.setTargetVolume(srcNetPosition > 0 ? Math.min(positionLimit, Math.abs(srcNetPosition)) : 0);
    pS.setTargetVolume(srcNetPosition < 0 ? Math.min(positionLimit, Math.abs(srcNetPosition)) : 0);
  });
  return tar;
}
