import {
  IconComment,
  IconExit,
  IconGithubLogo,
  IconHelpCircle,
  IconInfoCircle,
  IconLanguage,
  IconMenu,
  IconUndo,
  IconUser,
} from '@douyinfe/semi-icons';
import { Avatar, Button, Dropdown, Tag, Toast } from '@douyinfe/semi-ui';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { authState$, supabase } from '../../common/supabase';
import { executeCommand, registerCommand } from '../CommandCenter/CommandCenter';
import i18n from '../Locale/i18n';
import { currentHostConfig$ } from '../Workbench/model';

registerCommand('ChangeLanguage', () => {
  const targetLang = prompt(`${t('UserMenu:change_language_prompt')}: (${i18n.languages.join(' / ')})`);
  if (targetLang) {
    i18n.changeLanguage(targetLang);
  }
});

registerCommand('UserManual', () => {
  open('https://tradelife.feishu.cn/wiki/wikcngXV0voYLV2ihtdNyU2i96g');
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
  const currentHostConfig = useObservableState(currentHostConfig$);
  const isHostMode = !!currentHostConfig;
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
            icon={<IconComment />}
            onClick={() => {
              executeCommand('AI');
            }}
          >
            {t('AI Assistant')}
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('ManualTradePanel');
            }}
          >
            手动交易 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('AccountReplay');
            }}
          >
            账户回放 <Tag>主机模式可用</Tag>
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
          <Dropdown.Title>数据管理</Dropdown.Title>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('TerminalList');
            }}
          >
            终端列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('AccountList');
            }}
          >
            账户列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('ProductList');
            }}
          >
            品种列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('PullSourceRelationList');
            }}
          >
            同步关系列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('GeneralSpecificRelationList');
            }}
          >
            标准品种关系列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('TradeCopyRelationList');
            }}
          >
            跟单关系列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('TradeConfigList');
            }}
          >
            交易配置列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Item
            disabled={!isHostMode}
            onClick={() => {
              executeCommand('SubscriptionRelationList');
            }}
          >
            订阅关系列表 <Tag>主机模式可用</Tag>
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Title>{t('about')}</Dropdown.Title>
          <Dropdown.Item
            icon={<IconHelpCircle />}
            onClick={() => {
              executeCommand('UserManual');
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
