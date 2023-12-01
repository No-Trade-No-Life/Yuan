import { Button } from '@douyinfe/semi-ui';
import { CloseWifi, Wifi } from '@icon-park/react';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { executeCommand } from '../CommandCenter';
import { currentHostConfig$ } from '../Workbench/model';

export const NetworkStatusWidget = React.memo(() => {
  const config = useObservableState(currentHostConfig$);

  return (
    <Button
      type="tertiary"
      theme="borderless"
      icon={config ? <Wifi size={20} /> : <CloseWifi size={20} />}
      onClick={() => {
        executeCommand('HostList');
      }}
    ></Button>
  );
});
