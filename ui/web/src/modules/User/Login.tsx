import { Button, Divider, Form, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { Github, Wechat } from '@icon-park/react';
import { useObservableState } from 'observable-hooks';
import React, { useState } from 'react';
import { BehaviorSubject, Subject, defer, mergeMap, tap, throttleTime } from 'rxjs';
import { supabase } from '../../common/supabase';

export const triggerLoginModalAction$ = new Subject<void>();
const isLoginModalVisible$ = new BehaviorSubject(false);

triggerLoginModalAction$.subscribe(() => {
  isLoginModalVisible$.next(true);
});

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
            Toast.error(`登录失败: ${error.message}`);
          } else {
            Toast.success(`登录链接已发送至 ${email}，请查收`);
          }
        }),
      ),
    ),
  )
  .subscribe();

export const Login = React.memo(() => {
  const visible = useObservableState(isLoginModalVisible$);

  const [isLoading, setLoading] = useState(false);

  return (
    <>
      <Modal
        title="登录"
        visible={visible}
        onCancel={() => {
          isLoginModalVisible$.next(false);
        }}
        footer={null}
        header={null}
      >
        <Space
          vertical
          align="center"
          style={{ width: '100%', padding: '1em', paddingBottom: '3em', boxSizing: 'border-box' }}
        >
          <Typography.Title style={{ margin: 20 }} heading={2}>
            <b style={{ color: 'red' }}>Y</b>uan
          </Typography.Title>
          <Divider align="center">第三方登录</Divider>
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
                Toast.error(`登录失败: ${error.message}`);
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
                  Toast.error(`登录失败: ${error.message}`);
                }
              }}
            >
              微信登录
            </Button>
          )}
          <Divider align="center">邮箱登录</Divider>
          <Form
            style={{ width: '100%' }}
            labelPosition="inset"
            onSubmitFail={(e) => {
              Toast.error(`登录失败: ${e.email}`);
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
                  Toast.error(`登录失败: ${error.message}`);
                } else {
                  Toast.success(`登录成功`);
                  isLoginModalVisible$.next(false);
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
                  placeholder="请输入您的邮箱"
                  validate={(v: string) => {
                    if (v.match(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/) === null) {
                      return '请输入正确的邮箱地址';
                    }
                    return '';
                  }}
                ></Form.Input>
                <Form.Input
                  field="otp"
                  label="OTP"
                  style={{ width: '100%' }}
                  placeholder="请输入您收到的 6 位验证码"
                  validate={(v: string) => {
                    if (v.length !== 6) {
                      return '请输入正确的 6 位验证码';
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
                          Toast.error(`登录失败: 请输入邮箱`);
                          return;
                        }
                        Toast.success(`正在发送登陆链接到 ${v.email}...`);
                        triggerEmailOPLoginAction$.next(v.email);
                      }}
                    >
                      发送验证码
                    </Button>
                  </div>
                  <Button theme="solid" htmlType="submit" loading={isLoading}>
                    登录
                  </Button>
                </Space>
              </>
            )}
          </Form>
        </Space>
      </Modal>
    </>
  );
});
