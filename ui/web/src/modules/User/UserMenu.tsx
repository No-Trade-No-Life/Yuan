import {
  IconExit,
  IconGithubLogo,
  IconHelpCircle,
  IconInfoCircle,
  IconLanguage,
  IconMenu,
  IconUndo,
  IconUser,
} from '@douyinfe/semi-icons';
import { Avatar, Button, Dropdown, Toast } from '@douyinfe/semi-ui';
import { SmartOptimization } from '@icon-park/react';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import i18n from '../Locale/i18n';
import { authState$, supabase } from '../SupaBase';

registerCommand('ChangeLanguage', async () => {
  const targetLang = await showForm<string>(
    {
      type: 'string',
      title: t('UserMenu:change_language_prompt'),
      enum: ['zh', 'en'],
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

registerCommand('Logout', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    Toast.error(`${t('UserMenu:sign_out_failed')}: ${error.message}`);
  }
});

export const UserMenu = React.memo(() => {
  const authState = useObservableState(authState$);
  const { t } = useTranslation('UserMenu');

  return (
    <Dropdown
      trigger="click"
      clickToHide
      position="bottomLeft"
      render={
        <Dropdown.Menu style={{ width: 300 }}>
          {!authState && (
            <>
              <Dropdown.Item
                icon={<IconUser />}
                onClick={() => {
                  executeCommand('Login');
                }}
              >
                {t('sign_in')}
              </Dropdown.Item>
              <Dropdown.Divider />
            </>
          )}
          <Dropdown.Title>{t('Applications')}</Dropdown.Title>
          <Dropdown.Item
            icon={<SmartOptimization />}
            onClick={() => {
              executeCommand('Copilot');
            }}
          >
            {t('Copilot')}
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Title>{t('settings')}</Dropdown.Title>
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
          {authState && (
            <>
              <Dropdown.Divider />
              <Dropdown.Item
                icon={<IconExit />}
                onClick={() => {
                  executeCommand('Logout');
                }}
              >
                {t('sign_out')}
              </Dropdown.Item>
            </>
          )}
        </Dropdown.Menu>
      }
    >
      {authState ? (
        <Avatar
          alt={authState.user.email}
          src={authState.user.user_metadata['avatar_url']}
          size="small"
          style={{ margin: 4 }}
        >
          {authState.user.email![0].toUpperCase()}
        </Avatar>
      ) : (
        <Button icon={<IconMenu />}></Button>
      )}
    </Dropdown>
  );
});
