import { Button, Divider, Form, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { Github, Wechat } from '@icon-park/react';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Subject, defer, mergeMap, tap, throttleTime } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { registerPage, usePageId } from '../Pages';
import { authState$, supabase } from '../SupaBase';

const triggerEmailOPLoginAction$ = new Subject<string>();
triggerEmailOPLoginAction$
  .pipe(
    //
    throttleTime(1000),
    mergeMap((email) =>
      defer(() =>
        supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.href,
          },
        }),
      ).pipe(
        //
        tap(({ error }) => {
          if (error !== null) {
            Toast.error(`${t('Login:login_failed')}: ${error.message}`);
          } else {
            Toast.success(t('Login:email_sent', { email, interpolation: { escapeValue: false } }));
          }
        }),
      ),
    ),
  )
  .subscribe();

registerPage('Login', () => {
  const { t } = useTranslation('Login');
  const pageId = usePageId();
  const [isLoading, setLoading] = useState(false);
  const authState = useObservableState(authState$);

  useEffect(() => {
    if (authState) {
      executeCommand('Page.close', { pageId });
    }
  }, [authState]);

  return (
    <Space
      vertical
      align="center"
      style={{ width: '100%', padding: '1em', paddingBottom: '3em', boxSizing: 'border-box' }}
    >
      <Typography.Title style={{ margin: 20 }} heading={2}>
        <b style={{ color: 'red' }}>Y</b>uan
      </Typography.Title>
      <Divider align="center">{t('third_party_login')}</Divider>
      <Button
        icon={<Github theme="outline" size="24" />}
        theme="borderless"
        size="large"
        type="tertiary"
        block
        style={{ justifyContent: 'flex-start' }}
        onClick={async () => {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
              redirectTo: window.location.href,
            },
          });
          if (error) {
            Toast.error(`${t('login_failed')}: ${error.message}`);
          }
        }}
      >
        GitHub
      </Button>
      {false && (
        <Button
          icon={<Wechat size="24" theme="outline" />}
          theme="borderless"
          type="tertiary"
          size="large"
          block
          style={{ justifyContent: 'flex-start' }}
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'github',
              options: {
                redirectTo: window.location.href,
              },
            });
            if (error) {
              Toast.error(`${t('login_failed')}: ${error.message}`);
            }
          }}
        >
          {t('login_wechat')}
        </Button>
      )}
      <Divider align="center">{t('login_by_email')}</Divider>
      <Form
        style={{ width: '100%' }}
        labelPosition="inset"
        onSubmitFail={(e) => {
          Toast.error(`${t('login_failed')}: ${e.email}`);
        }}
        onSubmit={async (v) => {
          setLoading(true);
          try {
            const { error } = await supabase.auth.verifyOtp({
              email: v.email,
              token: v.otp,
              type: 'email',
            });
            if (error) {
              Toast.error(`${t('login_failed')}: ${error.message}`);
            } else {
              Toast.success(t('login_succeed'));
              executeCommand('Page.close', { pageId });
            }
          } catch (e) {}
          setLoading(false);
        }}
      >
        {({ formState, values, formApi }) => (
          <>
            <Form.Input
              field="email"
              label="Email"
              style={{ width: '100%' }}
              placeholder={t('email_placeholder')}
              validate={(v: string) => {
                if (v.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/) === null) {
                  return t('email_error');
                }
                return '';
              }}
            ></Form.Input>
            <Form.Input
              field="otp"
              label="OTP"
              style={{ width: '100%' }}
              placeholder={t('otp_placeholder')}
              validate={(v: string) => {
                if (v.length !== 6) {
                  return t('otp_error');
                }
                return '';
              }}
            ></Form.Input>
            <Space spacing="loose" style={{ width: '100%' }}>
              <div style={{ flex: 'auto' }}>
                <Button
                  onClick={() => {
                    const v = formState.values;
                    if (!v.email) {
                      Toast.error(`${t('login_failed')}: ${t('login_failed_empty_email')}`);
                      return;
                    }
                    Toast.success(
                      t('email_sending', { email: v.email, interpolation: { escapeValue: false } }),
                    );
                    triggerEmailOPLoginAction$.next(v.email);
                  }}
                >
                  {t('send_email')}
                </Button>
              </div>
              <Button theme="solid" htmlType="submit" loading={isLoading}>
                {t('common:login')}
              </Button>
            </Space>
          </>
        )}
      </Form>
    </Space>
  );
});

// Override default behavior
registerCommand('Login', () => {
  executeCommand('Page.open', { type: 'Login', parentId: 'border_left' });
});
