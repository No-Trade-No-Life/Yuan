import { Button, Descriptions, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { JSONSchema7 } from 'json-schema';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useMemo, useState } from 'react';
import { defer, first, mergeMap, of, shareReplay, switchMap, tap } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { PERIOD_IN_SEC_TO_LABEL } from '../../common/utils';
import { executeCommand } from '../CommandCenter/CommandCenter';
import { Form } from '../Form';

export const datasourceIds$ = defer(() => terminal$).pipe(
  switchMap((terminal) => terminal.datasourceIds$),
  shareReplay(1),
);

export const SearchButton = React.memo(() => {
  const [visible, setVisible] = useState(false);

  const datasourceIds = useObservableState(datasourceIds$, []);

  const [formData, setFormData] = useState({
    datasource_id: '',
    product_id: '',
    period_in_sec: undefined as number | undefined,
    start_time: undefined as string | undefined,
    end_time: undefined as string | undefined,
  });

  const selected_datasource_id = formData.datasource_id;

  const products$ = useObservable(
    mergeMap(([datasource_id]) =>
      datasource_id
        ? terminal$.pipe(
            //
            first(),
            mergeMap((terminal) => terminal.queryProducts({ datasource_id }, 'MongoDB')),
          )
        : of([]),
    ),
    [selected_datasource_id],
  );

  const products = useObservableState(products$, []);

  const selected_product = useMemo(
    () => products.find((product) => product.product_id === formData.product_id),
    [products, formData],
  );

  const schema: JSONSchema7 = {
    type: 'object',
    properties: {
      datasource_id: {
        type: 'string',
        title: '数据源',
        enum: datasourceIds,
      },
      product_id: {
        type: 'string',
        title: '品种',
        // 用 examples 允许用户自行填写不在列表中的选项
        examples: products.map((product) => product.product_id),
        // @ts-expect-error
        exampleNames: products.map(
          (product) => `${product.product_id}${product.name ? ` (${product.name})` : ''}`,
        ),
      },
      period_in_sec: {
        title: '周期',
        type: 'number',
        examples: Object.keys(PERIOD_IN_SEC_TO_LABEL).map((v) => +v),
        // @ts-expect-error
        exampleNames: Object.values(PERIOD_IN_SEC_TO_LABEL),
      },
      start_time: {
        title: '起始时间',
        description: '请按照本地时区填写',
        type: 'string',
        format: 'date-time',
      },
      end_time: {
        title: '结束时间',
        description: '请按照本地时区填写',
        type: 'string',
        format: 'date-time',
      },
    },
  };
  return (
    <>
      <Button
        onClick={() => {
          setVisible(true);
        }}
      >
        市场品种
      </Button>
      <Modal
        title="市场品种"
        visible={visible}
        onCancel={() => {
          setVisible(false);
        }}
        footer={
          <Space>
            <Button
              disabled={!(formData.datasource_id && formData.product_id && formData.period_in_sec)}
              onClick={() => {
                executeCommand('Market', formData);
              }}
            >
              打开行情图表
            </Button>
            <Button
              disabled={
                !(
                  formData.datasource_id &&
                  formData.product_id &&
                  formData.period_in_sec &&
                  formData.start_time &&
                  formData.end_time
                )
              }
              onClick={() => {
                terminal$
                  .pipe(
                    first(),
                    tap(() =>
                      Toast.info(
                        `开始拉取 ${formData.datasource_id} / ${formData.product_id} / ${formData.period_in_sec} 历史数据...`,
                      ),
                    ),
                    mergeMap((terminal) =>
                      terminal.queryPeriods(
                        {
                          datasource_id: formData.datasource_id,
                          product_id: formData.product_id,
                          period_in_sec: formData.period_in_sec!,
                          start_time_in_us: new Date(formData.start_time!).getTime() * 1000,
                          end_time_in_us: new Date(formData.end_time!).getTime() * 1000,
                          pull_source: true,
                        },
                        'MongoDB',
                      ),
                    ),
                    tap((msg) => Toast.info(`拉取历史数据, 共 ${msg.length} 条数据`)),
                  )
                  .subscribe();
              }}
            >
              拉取历史行情
            </Button>
          </Space>
        }
      >
        <Space vertical align="start">
          <Form schema={schema} formData={formData} onChange={(e) => setFormData(e.formData)}>
            <div></div>
          </Form>

          {selected_product && (
            <>
              <Typography.Title heading={4}>品种参数</Typography.Title>
              <Descriptions
                data={[
                  //
                  {
                    key: '数据源',
                    value: <Typography.Text copyable>{selected_product.datasource_id}</Typography.Text>,
                  },
                  {
                    key: '品种ID',
                    value: <Typography.Text copyable>{selected_product.product_id}</Typography.Text>,
                  },
                  {
                    key: '品种别名',
                    value: (
                      <Typography.Text copyable={selected_product.name !== undefined}>
                        {selected_product.name ?? '未提供'}
                      </Typography.Text>
                    ),
                  },
                  { key: '基准货币', value: selected_product.base_currency },
                  {
                    key: '标的指代',
                    value: selected_product.is_underlying_base_currency ? '基准货币' : '品种自身',
                  },
                  {
                    key: '价值速率',
                    value: (
                      <Typography.Text>
                        {selected_product.value_speed} (1 手 = {selected_product.value_speed}{' '}
                        {selected_product.is_underlying_base_currency
                          ? selected_product.base_currency
                          : selected_product.product_id}
                        )
                      </Typography.Text>
                    ),
                  },
                  { key: '委托量单位', value: `${selected_product.volume_step} 手` },
                  {
                    key: '委托价单位',
                    value: `${selected_product.price_step} ${
                      selected_product.is_underlying_base_currency
                        ? selected_product.quoted_currency
                        : selected_product.base_currency
                    }`,
                  },
                  { key: '保证金率', value: `${((selected_product.margin_rate ?? 1) * 100).toFixed(2)}%` },

                  { key: '报价货币', value: selected_product.quoted_currency ?? '不适用' },
                ]}
              ></Descriptions>
            </>
          )}
        </Space>
      </Modal>
    </>
  );
});
