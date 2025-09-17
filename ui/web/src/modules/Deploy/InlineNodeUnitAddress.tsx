import { IconAlertTriangle } from '@douyinfe/semi-icons';
import { Popover, Typography } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { memo } from 'react';
import { availableNodeUnit$ } from './model';

export const InlineNodeUnitAddress = memo((props: { address: string }) => {
  const availableNodeUnit = useObservableState(availableNodeUnit$);
  const theNodeUnit = availableNodeUnit?.find((unit) => unit.node_unit_address === props.address);

  if (theNodeUnit === undefined) {
    return (
      <Typography.Text icon={<IconAlertTriangle />} type="danger">
        {props.address} (未识别)
      </Typography.Text>
    );
  }

  return (
    <Popover content={<Typography.Text copyable>{props.address}</Typography.Text>} position="right">
      <Typography.Text type="success">
        {theNodeUnit.node_unit_name} ({theNodeUnit.node_unit_version})
      </Typography.Text>
    </Popover>
  );
});
