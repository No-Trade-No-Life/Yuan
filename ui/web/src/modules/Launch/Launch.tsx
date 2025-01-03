import { Collapse, Empty, Space, Typography } from '@douyinfe/semi-ui';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useEffect } from 'react';
import ReactLoading from 'react-loading';
import { timer } from 'rxjs';
import { error$ } from '../BIOS';
import { fullLog$, logLines } from '../BIOS/log';
import { useIsDarkMode } from '../Workbench';

/**
 * @public
 */
export const Launch = React.memo(() => {
  const fullLog = useObservableState(fullLog$);
  const error = useObservableState(error$);
  const isLoading = !error;
  const isError = !!error;
  const isShowLog = useObservableState(useObservable(() => timer(2000))) === undefined ? false : true;
  const isDarkMode = useIsDarkMode();
  useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, [fullLog]);
  return (
    <Space
      style={{ width: '100%', height: '100%', justifyContent: 'center' }}
      vertical
      align="center"
      spacing="loose"
    >
      {isLoading && (
        <>
          <ReactLoading type="spinningBubbles" color={isDarkMode ? '#FFFFFF' : '#000000'} />
          <Typography.Text>{logLines[logLines.length - 1]}</Typography.Text>
        </>
      )}
      {isError && <Empty title="BOOT FAILED" description={`${error}`}></Empty>}
      {isShowLog && (
        <Collapse style={{ width: '100%' }}>
          <Collapse.Panel header="FULL LOG" itemKey="full_log">
            <Typography.Paragraph copyable component="pre">
              {fullLog}
            </Typography.Paragraph>
          </Collapse.Panel>
        </Collapse>
      )}
    </Space>
  );
});
