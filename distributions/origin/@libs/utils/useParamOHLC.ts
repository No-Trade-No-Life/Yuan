/**
 * Use OHLC with parameter
 */
export const useParamOHLC = (key: string) => {
  const OHLCKey = useParamSchema<string>(key, {
    type: 'string',
    format: 'OHLC-key',
  });
  const { datasource_id, product_id, period_in_sec } = useMemo(() => {
    const [datasource_id = '', product_id = '', _period_in_sec] = decodePath(OHLCKey || '');
    const period_in_sec = _period_in_sec;
    return { datasource_id, product_id, period_in_sec };
  }, []);

  const periods = useOHLC(datasource_id, product_id, period_in_sec);
  return { datasource_id, product_id, period_in_sec, ...periods };
};
