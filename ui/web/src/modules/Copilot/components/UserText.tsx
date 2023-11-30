import { Typography } from '@douyinfe/semi-ui';
import { IMessageCardProps } from '../model';

export default ({ payload }: IMessageCardProps<{ text: string }>) => {
  return (
    <Typography.Title heading={3} style={{ width: '100%', flexShrink: 0 }}>
      {payload.text}
    </Typography.Title>
  );
};
