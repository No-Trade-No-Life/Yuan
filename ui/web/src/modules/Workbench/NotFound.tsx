import { IconClose, IconUndo } from '@douyinfe/semi-icons';
import { Button, Empty, Space, Typography } from '@douyinfe/semi-ui';
import { Actions, TabNode } from 'flexlayout-react';
import React from 'react';
import { initialJson, layoutModel$, layoutModelJson$, layoutUpdate$ } from '../../layout-model';
import { Trans, useTranslation } from 'react-i18next';

export const NotFound = React.memo((props: { node?: TabNode }) => {
  const component = props.node?.getComponent() ?? 'UNKNOWN';
  const { t } = useTranslation('NotFound');
  return (
    <Empty
      title={<Typography.Title heading={4}>{t('page_not_found')}</Typography.Title>}
      description={<Trans t={t} i18nKey={'page_not_found_note'} values={{ component }}></Trans>}
    >
      <Space align="center">
        <Button
          icon={<IconUndo />}
          type="primary"
          onClick={() => {
            layoutModelJson$.next(initialJson());
            layoutUpdate$.next();
          }}
        >
          {t('reset_layout')}
        </Button>
        <Button
          icon={<IconClose />}
          type="tertiary"
          onClick={() => {
            if (props.node) {
              layoutModel$.value.doAction(Actions.deleteTab(props.node.getId()));
            }
          }}
        >
          {t('close_this_only')}
        </Button>
      </Space>
    </Empty>
  );
});
