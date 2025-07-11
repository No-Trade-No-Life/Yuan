import { Card, Descriptions, Popover, Typography } from '@douyinfe/semi-ui';
import { encodePath } from '@yuants/utils';
import { IProduct } from '@yuants/data-product';
import { escape, requestSQL } from '@yuants/sql';
import { useObservable, useObservableState } from 'observable-hooks';
import { filter, map, switchMap } from 'rxjs';
import { terminal$ } from '../Terminals';

const ProductCard = (props: { datasource_id: string; product_id: string }) => {
  const product = useObservableState(
    useObservable(
      () =>
        terminal$.pipe(
          filter((x): x is Exclude<typeof x, undefined | null> => !!x),
          switchMap((terminal) =>
            requestSQL<IProduct[]>(
              terminal,
              `select * from product where datasource_id = ${escape(
                props.datasource_id,
              )} and product_id = ${escape(props.product_id)}`,
            ),
          ),
          map((x) => x[0]),
        ),
      [props.datasource_id, props.product_id],
    ),
  );

  if (!product) {
    return (
      <Card title={encodePath(props.datasource_id, props.product_id)} loading={true}>
        <Card.Meta></Card.Meta>
      </Card>
    );
  }

  return (
    <Card title={encodePath(product.datasource_id, product.product_id)}>
      <Descriptions
        data={[
          { key: '数据源', value: product.datasource_id },
          { key: '品种', value: product.product_id },
          { key: '基础货币', value: product.base_currency },
          { key: '计价货币', value: product.quote_currency },
          {
            key: '价值尺度',
            value: `${product.value_scale ?? 1} ${
              product.value_scale_unit ?? product.base_currency ?? product.product_id
            }`,
          },
          { key: '成交量单位', value: product.volume_step ?? 1 },
          { key: '报价单位', value: product.price_step ?? 1 },
        ]}
      ></Descriptions>
    </Card>
  );
};

export const InlineProductId = (props: { datasource_id: string; product_id: string }) => {
  return (
    <Popover content={<ProductCard datasource_id={props.datasource_id} product_id={props.product_id} />}>
      <Typography.Text copyable link={{}}>
        {encodePath(props.datasource_id, props.product_id)}
      </Typography.Text>
    </Popover>
  );
};
