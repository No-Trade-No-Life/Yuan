import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Space, Table, Toast } from '@douyinfe/semi-ui';
import { StockMarket } from '@icon-park/react';
import { IProduct } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPTY, combineLatest, filter, first, mergeMap, tap, toArray } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import Form, { showForm } from '../Form';
import { SearchButton } from '../Market/SearchButton';
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
        <SearchButton />
      </Space>
      <Table
        dataSource={products}
        style={{ width: '100%' }}
        columns={[
          //
          { title: '数据源 ID', render: (_, record) => record.origin.datasource_id },
          { title: '品种 ID', render: (_, record) => record.origin.product_id },
          { title: '品种名称', render: (_, record) => record.origin.name },
          { title: '基准货币', render: (_, record) => record.origin.base_currency },
          { title: '标价货币', render: (_, record) => record.origin.quoted_currency },
          {
            title: '是否基于基准货币',
            render: (_, record) => (record.origin.is_underlying_base_currency ? '是' : '否'),
          },
          {
            title: '价值速率',
            render: (_, record) => record.origin.value_speed,
          },
          {
            title: '成交量粒度',
            render: (_, record) => record.origin.volume_step,
          },
          {
            title: '报价粒度',
            render: (_, record) => record.origin.price_step,
          },
          {
            title: '保证金率',
            render: (_, record) => record.origin.margin_rate,
          },
          {
            title: '点差',
            render: (_, record) => record.origin.spread,
          },
          {
            title: '允许做空',
            render: (_, record) => (record.origin.allow_short ? '是' : '否'),
          },
          {
            title: '操作',
            render: (_, record) => (
              <Space>
                <Button
                  icon={<StockMarket />}
                  onClick={async () => {
                    const period_in_sec = await showForm<string>({ type: 'string', title: 'period_in_sec' });
                    if (period_in_sec) {
                      executeCommand('Market', {
                        datasource_id: record.origin.datasource_id,
                        product_id: record.origin.product_id,
                        period_in_sec: +period_in_sec,
                      });
                    }
                  }}
                ></Button>
                <Button
                  icon={<IconEdit />}
                  onClick={() => {
                    setFormData(record.origin);

                    setModalVisible(true);
                  }}
                ></Button>
                <Button icon={<IconDelete />} disabled type="danger"></Button>
              </Space>
            ),
          },
        ]}
      ></Table>
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
              quoted_currency: {
                title: '标价货币',
                type: 'string',
                description:
                  '汇率的表达方式为一单位的基准货币可兑换多少单位的标价货币\n对于非外汇品种，quoted_currency 应当为空。',
              },

              is_underlying_base_currency: {
                title: '是否标的基准货币',
                type: 'boolean',
                description:
                  '标的物是基准货币吗？\n如果此值为 true，需要在标准收益公式中额外除以本品种的"平仓时的价格"。',
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
              value_speed: {
                title: '价值速率',
                type: 'number',
                description: '交易 1 手对应的标的资产数量',
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
              base_currency: {
                title: '基准货币',
                type: 'string',
                description:
                  '基准货币是汇率报价中作为基础的货币，即报价表达形式为每一个单位的货币可兑换多少另一种货币。',
              },
              quoted_currency: {
                title: '标价货币',
                type: 'string',
                description:
                  '汇率的表达方式为一单位的基准货币可兑换多少单位的标价货币\n对于非外汇品种，quoted_currency 应当为空。',
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
