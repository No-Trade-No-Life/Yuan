import { Button, Input, Toast, Typography } from '@douyinfe/semi-ui';
import { useState } from 'react';
import { useFinancialReport } from './useFinancialReport';
const { Text, Paragraph } = Typography;

export const ClearingAndSettlement = () => {
  const { addRecord, handleDividend } = useFinancialReport();
  const [contents, setContents] = useState('');
  const [dividendDate, setDividendDate] = useState('');

  return (
    <>
      <br />
      <Paragraph>
        日志文件名：<Text code>aof.log</Text>
      </Paragraph>
      <Paragraph>
        日志输入格式：<Text code>时间 描述 更新元素...</Text>
      </Paragraph>
      <Paragraph>
        更新元素格式：<Text code>投资人姓名-份额-分红基数-净入金-分红比例（可选）</Text>、
        <Text code>投资人姓名-分红比例</Text>、<Text code>总资产</Text>
      </Paragraph>
      <Paragraph>
        如：<Text code>2022-10-15T12:00:00 入金 投资人1-1000-2500-2000-0.3 140000</Text>
      </Paragraph>
      <br />
      <label>更新日志：</label>
      <Input onChange={setContents} />
      <Button
        theme="borderless"
        onClick={async () => {
          try {
            await addRecord(contents);
            Toast.success('更新成功');
          } catch (e) {
            Toast.error(`更新失败，${e}`);
          }
        }}
      >
        更新记录
      </Button>
      <br />
      <label>输入分红时间：</label>
      <Input onChange={setDividendDate} />
      <Button
        theme="borderless"
        onClick={async () => {
          try {
            await handleDividend(dividendDate);
            Toast.success('分红完成，更新日志成功');
          } catch (e) {
            Toast.error(`更新失败，${e}`);
          }
        }}
      >
        分红
      </Button>
      <br />
    </>
  );
};
