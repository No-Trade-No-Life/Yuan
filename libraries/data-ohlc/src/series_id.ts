import { decodePath, encodePath } from '@yuants/utils';

/**
 * @public
 */
export const encodeOHLCSeriesId = (product_id: string, duration: string): string => {
  return `${product_id}/${duration}`;
};

/**
 * @public
 */
export const decodeOHLCSeriesId = (series_id: string): { product_id: string; duration: string } => {
  const parts = decodePath(series_id);
  const product_id = encodePath(...parts.slice(0, -1));
  return { product_id, duration: parts[parts.length - 1] };
};
