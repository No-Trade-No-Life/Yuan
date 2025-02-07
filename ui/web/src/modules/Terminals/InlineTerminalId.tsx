import { Popover, Typography } from '@douyinfe/semi-ui';
import { executeCommand } from '../CommandCenter';

const TerminalCard = (props: { terminal_id: string }) => {
  //
  return null;
};

export const InlineTerminalId = (props: { terminal_id: string }) => {
  return (
    <Popover content={<TerminalCard terminal_id={props.terminal_id} />}>
      <Typography.Text
        copyable
        link={{
          onClick: () => {
            executeCommand('TerminalDetail', { terminal_id: props.terminal_id });
          },
        }}
      >
        {props.terminal_id}
      </Typography.Text>
    </Popover>
  );
};
