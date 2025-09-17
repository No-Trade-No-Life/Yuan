import { Select, Space } from '@douyinfe/semi-ui';
import { encodePath } from '@yuants/utils';
import { useObservableState } from 'observable-hooks';
import { useEffect, useRef, useState } from 'react';
import { EMPTY, switchMap, tap } from 'rxjs';
import { Button } from '../Interactive';
import { terminal$ } from '../Network';
import { registerPage, usePageParams } from '../Pages';
import { availableNodeUnit$, deployments$ } from './model';

registerPage('DeploymentRealtimeLog', () => {
  const { node_unit_address, deployment_id } = usePageParams<{
    node_unit_address: string;
    deployment_id: string;
  }>();

  const [nodeUnitAddress, setNodeUnitAddress] = useState(node_unit_address || '');
  const [deploymentId, setDeploymentId] = useState(deployment_id || '');

  const availableNodeUnit = useObservableState(availableNodeUnit$);

  const deployments = useObservableState(deployments$);

  const logDomRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (logDomRef.current) {
      const sub = terminal$
        .pipe(
          switchMap((terminal) => {
            logDomRef.current!.innerText = '';
            if (!terminal) return EMPTY;
            return terminal.channel
              .subscribeChannel<string>(
                encodePath('Deployment', 'RealtimeLog', nodeUnitAddress),
                deploymentId,
              )
              .pipe(
                tap((log) => {
                  logDomRef.current!.insertAdjacentText('beforeend', log);
                }),
              );
          }),
        )
        .subscribe();
      return () => {
        sub.unsubscribe();
      };
    }
  }, [nodeUnitAddress, deploymentId]);

  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Space vertical align="start">
        <Select
          prefix="Node Unit"
          value={nodeUnitAddress}
          onChange={(e) => setNodeUnitAddress(e as string)}
          optionList={availableNodeUnit?.map((unit) => ({
            label: `${unit.node_unit_name} (${unit.node_unit_address}) @yuants/node-unit@${unit.node_unit_version}`,
            value: unit.node_unit_address,
          }))}
          style={{ width: '100%' }}
          filter
        />
        <Select
          prefix="Deployment"
          value={deploymentId}
          onChange={(e) => setDeploymentId(e as string)}
          optionList={
            deployments
              ?.filter((d) => d.address === nodeUnitAddress)
              .map((d) => ({ label: `${d.id} (${d.package_name}@${d.package_version})`, value: d.id })) ?? []
          }
          emptyContent="请先选择 Node Unit / 没有可用的 Deployment"
          style={{ width: '100%' }}
          filter
        />
        <Space>
          <Button
            onClick={() => {
              if (logDomRef.current) {
                logDomRef.current.innerText = '';
              }
            }}
          >
            清空日志
          </Button>
        </Space>
      </Space>
      <Space
        vertical
        align="start"
        style={{ width: '100%', flexGrow: 1, overflow: 'auto', border: '1px solid var(--semi-color-border)' }}
      >
        <pre style={{ width: '100%' }} ref={logDomRef}></pre>
      </Space>
    </Space>
  );
});
