/**
 * Use parameter as Product
 * @param key - parameter's name
 */
export const useParamProduct = (key: string): IProduct => {
  const productKey = useParamSchema<string>(key, {
    type: 'string',
    format: 'product-key',
  });

  const { datasource_id, product_id } = useMemo(() => {
    const [datasource_id = '', product_id = ''] = decodePath(productKey || '');
    return { datasource_id, product_id };
  }, []);
  return useProduct(datasource_id, product_id);
};
