import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Space, Toast } from '@douyinfe/semi-ui';
import { StockMarket } from '@icon-park/react';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { IProduct } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPTY, combineLatest, filter, first, mergeMap, tap, toArray } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import Form, { showForm } from '../Form';
import { DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

registerPage('ProductList', () => {
  const { t } = useTranslation('ProductList');
  const [refreshId, setRefreshId] = useState(0);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);

  const [_searchFormData, _setSearchFormData] = useState({});
  const [searchFormData, setSearchFormData] = useState({} as any);

  const products$ = useObservable(
    (input$) =>
      combineLatest([terminal$, input$]).pipe(
        //
        mergeMap(([terminal, [searchFormData]]) =>
          (
            terminal?.queryDataRecords<IProduct>({
              type: 'product',
              tags: {
                datasource_id: searchFormData.datasource_id || undefined,
                product_id: searchFormData.product_id || undefined,
                quote_currency: searchFormData.quote_currency || undefined,
                base_currency: searchFormData.base_currency || undefined,
              },
              options: {
                limit: 200,
                skip: 0,
                sort: [
                  ['tags.datasource_id', 1],
                  ['tags.product_id', 1],
                ],
              },
            }) ?? EMPTY
          ).pipe(
            //
            toArray(),
          ),
        ),
      ),
    [searchFormData, refreshId],
  );

  const products = useObservableState(products$);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<IProduct>();

    return [
      columnHelper.accessor('datasource_id', {
        header: () => '数据源ID',
      }),
      columnHelper.accessor('product_id', {
        header: () => '品种ID',
      }),
      columnHelper.accessor('name', { header: () => '品种名称' }),
      columnHelper.accessor('quote_currency', { header: () => '计价货币' }),
      columnHelper.accessor('base_currency', { header: () => '基准货币' }),
      columnHelper.accessor((x) => `${x.value_scale || ''} ${x.value_scale_unit || ''}`, {
        id: 'value_scale',
        header: () => '价值尺度',
      }),
      columnHelper.accessor('volume_step', { header: () => '成交量粒度' }),
      columnHelper.accessor('price_step', { header: () => '报价粒度' }),
      columnHelper.accessor('margin_rate', { header: () => '保证金率' }),
      columnHelper.accessor('spread', { header: () => '点差' }),
      columnHelper.accessor((x) => 0, {
        id: 'actions',
        header: () => '操作',
        cell: (x) => {
          const item = x.row.original;
          return (
            <Space>
              <Button
                icon={<StockMarket />}
                onClick={async () => {
                  const period_in_sec = await showForm<string>({ type: 'string', title: 'period_in_sec' });
                  if (period_in_sec) {
                    executeCommand('Market', {
                      datasource_id: item.datasource_id,
                      product_id: item.product_id,
                      period_in_sec: +period_in_sec,
                    });
                  }
                }}
              ></Button>
              <Button
                icon={<IconEdit />}
                onClick={() => {
                  setFormData(item);

                  setModalVisible(true);
                }}
              ></Button>
              <Button icon={<IconDelete />} disabled type="danger"></Button>
            </Space>
          );
        },
      }),
    ];
  }, []);

  const data = useMemo(() => products?.map((x) => x.origin) ?? [], [products]);

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

  const [isModalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({} as IProduct);

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button
          icon={<IconSearch />}
          onClick={() => {
            setSearchModalVisible(true);
          }}
        >
          搜索
        </Button>
        <Button
          icon={<IconCopyAdd />}
          onClick={() => {
            setFormData({} as IProduct);
            setModalVisible(true);
          }}
        >
          添加
        </Button>
        <Button
          icon={<IconRefresh />}
          onClick={() => {
            setRefreshId((x) => x + 1);
            Toast.success('已刷新');
          }}
        >
          刷新
        </Button>
      </Space>
      <DataView table={table} />

      <Modal
        visible={isModalVisible}
        onCancel={() => {
          setModalVisible(false);
        }}
        onOk={() => {
          terminal$
            .pipe(
              filter((x): x is Exclude<typeof x, null> => !!x),
              first(),
              mergeMap((terminal) => terminal.updateProducts([formData])),
              tap({
                complete: () => {
                  Toast.success(`成功更新品种 ${formData.datasource_id}/${formData.product_id}`);
                },
              }),
            )
            .subscribe();
        }}
      >
        <Form
          formData={formData}
          onChange={(data) => {
            setFormData(data.formData);
          }}
          schema={{
            type: 'object',
            properties: {
              datasource_id: {
                title: '数据源ID',
                type: 'string',
              },
              product_id: {
                title: '品种ID',
                type: 'string',
              },
              name: {
                title: '品种名',
                type: 'string',
                description: '人类易读的品种名称',
              },
              base_currency: {
                title: '基准货币',
                type: 'string',
                description:
                  '基准货币是汇率报价中作为基础的货币，即报价表达形式为每一个单位的货币可兑换多少另一种货币。',
              },
              quote_currency: {
                title: '计价货币',
                type: 'string',
              },
              price_step: {
                title: '报价粒度',
                type: 'number',
                description: '市场报价，委托价都必须为此值的整数倍，不得有浮点误差',
              },
              volume_step: {
                title: '成交量粒度',
                type: 'number',
                description: '委托量、成交量、持仓量都必须为此值的整数倍，不得有浮点误差',
              },
              value_scale: {
                title: '价值尺度',
                type: 'number',
                description: '交易 1 手对应的标的资产数量',
              },
              value_scale_unit: {
                title: '价值尺度单位',
                type: 'string',
              },
              margin_rate: {
                title: '保证金率',
                type: 'number',
                description: `
          保证金 = 持仓量 * 持仓价 * 价值速率 * 保证金率 / 账户杠杆率
        `,
              },
              value_based_cost: {
                title: '基于价值的成本',
                type: 'number',
                description: `
        产生与成交额成正比的结算资产成本，例如:
        1. 按成交额收取的手续费
        `,
              },
              volume_based_cost: {
                title: '基于成交量的成本',
                type: 'number',
                description: `
        产生与成交量成正比的结算资产成本，例如:
        1. 按成交量收取的手续费; 
        2. 滑点等交易实况造成的不利价差。
        `,
              },
              max_position: {
                title: '最大持仓量',
                type: 'number',
              },
              max_volume: {
                title: '最大单笔委托量',
                type: 'number',
              },
              min_volume: {
                title: '最小单笔委托量',
                type: 'number',
              },
              allow_long: {
                title: '允许做多',
                type: 'boolean',
                default: true,
              },
              allow_short: {
                title: '允许做空',
                type: 'boolean',
                default: true,
              },
              spread: {
                title: '点差',
                type: 'number',
              },
            },
          }}
        >
          <div></div>
        </Form>
      </Modal>
      <Modal
        visible={isSearchModalVisible}
        onCancel={() => {
          setSearchModalVisible(false);
        }}
        onOk={() => {
          setSearchFormData(_searchFormData);
        }}
      >
        <Form
          formData={_searchFormData}
          onChange={(data) => {
            _setSearchFormData(data.formData);
          }}
          schema={{
            type: 'object',
            properties: {
              datasource_id: {
                title: '数据源ID',
                type: 'string',
              },
              product_id: {
                title: '品种ID',
                type: 'string',
              },
              quote_currency: {
                title: '计价货币',
                type: 'string',
              },
              base_currency: {
                title: '基准货币',
                type: 'string',
                description:
                  '基准货币是汇率报价中作为基础的货币，即报价表达形式为每一个单位的货币可兑换多少另一种货币。',
              },
            },
          }}
        >
          <div></div>
        </Form>
      </Modal>
    </Space>
  );
});
