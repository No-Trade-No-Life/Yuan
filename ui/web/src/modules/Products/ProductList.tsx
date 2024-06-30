import { StockMarket } from '@icon-park/react';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, IProduct } from '@yuants/data-model';
import { wrapProduct } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { executeCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { showForm } from '../Form';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';

const schema: JSONSchema7 = {
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
};
registerPage('ProductList', () => {
  return (
    <DataRecordView
      TYPE="product"
      columns={() => {
        const columnHelper = createColumnHelper<IDataRecord<IProduct>>();

        return [
          columnHelper.accessor('origin.datasource_id', {
            header: () => '数据源ID',
          }),
          columnHelper.accessor('origin.product_id', {
            header: () => '品种ID',
          }),
          columnHelper.accessor('origin.name', { header: () => '品种名称' }),
          columnHelper.accessor('origin.quote_currency', { header: () => '计价货币' }),
          columnHelper.accessor('origin.base_currency', { header: () => '基准货币' }),
          columnHelper.accessor((x) => `${x.origin.value_scale || ''} ${x.origin.value_scale_unit || ''}`, {
            id: 'value_scale',
            header: () => '价值尺度',
          }),
          columnHelper.accessor('origin.volume_step', { header: () => '成交量粒度' }),
          columnHelper.accessor('origin.price_step', { header: () => '报价粒度' }),
          columnHelper.accessor('origin.margin_rate', { header: () => '保证金率' }),
          columnHelper.accessor('origin.spread', { header: () => '点差' }),
        ];
      }}
      newRecord={() => {
        return {};
      }}
      mapOriginToDataRecord={wrapProduct}
      extraRecordActions={(props) => {
        const item = props.record.origin;
        return (
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
        );
      }}
      schema={schema}
    />
  );
});
