import {
  IconFolderOpen,
  IconGithubLogo,
  IconHelpCircle,
  IconInfoCircle,
  IconLanguage,
  IconMenu,
  IconUndo,
} from '@douyinfe/semi-icons';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { t } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import i18n from '../Locale/i18n';

registerCommand('ChangeLanguage', async () => {
  const targetLang = await showForm<string>(
    {
      type: 'string',
      title: t('UserMenu:change_language_prompt'),
      oneOf: [
        { const: 'zh-Hans', title: '简体中文' },
        { const: 'en', title: 'English' },
      ],
    },
    i18n.language,
  );

  if (targetLang) {
    i18n.changeLanguage(targetLang);
  }
});

registerCommand('Help', () => {
  open(t('common:help_url'));
});

registerCommand('OpenSource', () => {
  open('https://github.com/No-Trade-No-Life/Yuan');
});

export const UserMenu = React.memo(() => {
  const { t } = useTranslation(['UserMenu', 'common']);
  const canPickDirectory = typeof (window as any).showDirectoryPicker === 'function';

  return (
    <Dropdown
      trigger="click"
      clickToHide
      position="topLeft"
      render={
        <Dropdown.Menu style={{ width: 300 }}>
          <Dropdown.Title>{t('settings')}</Dropdown.Title>
          <Dropdown.Item
            disabled={!canPickDirectory}
            icon={<IconFolderOpen />}
            onClick={() => {
              executeCommand('workspace.open');
            }}
          >
            {t('common:change_workspace')}
          </Dropdown.Item>
          <Dropdown.Item
            icon={<IconUndo />}
            onClick={() => {
              executeCommand('ResetLayout');
            }}
          >
            {t('reset_layout')}
          </Dropdown.Item>
          <Dropdown.Item
            icon={<IconLanguage />}
            onClick={() => {
              executeCommand('ChangeLanguage');
            }}
          >
            {t('change_language')}
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Title>{t('about')}</Dropdown.Title>
          <Dropdown.Item
            icon={<IconHelpCircle />}
            onClick={() => {
              executeCommand('Help');
            }}
          >
            {t('user_manual')}
          </Dropdown.Item>
          <Dropdown.Item
            icon={<IconInfoCircle />}
            onClick={() => {
              executeCommand('About');
            }}
          >
            {t('about')}
          </Dropdown.Item>
          <Dropdown.Item
            icon={<IconGithubLogo />}
            onClick={() => {
              executeCommand('OpenSource');
            }}
          >
            {t('open_source')}
          </Dropdown.Item>
        </Dropdown.Menu>
      }
    >
      <Button icon={<IconMenu />}></Button>
    </Dropdown>
  );
});
