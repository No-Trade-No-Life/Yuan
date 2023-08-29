import { IDeploySpec, IEnvContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';

export const make_json_schema = (): JSONSchema7 => ({
  type: 'object',
  title: 'Email Notifier',
  properties: {
    env: {
      type: 'object',
      required: ['HV_URL', 'SMTP_USER', 'SMTP_HOST', 'SMTP_PASS'],
      properties: {
        HV_URL: {
          type: 'string',
        },
        SMTP_USER: {
          type: 'string',
        },
        SMTP_HOST: {
          type: 'string',
        },
        SMTP_PASS: {
          type: 'string',
        },
      },
    },
  },
});

export const make_docker_compose_file = async (ctx: IDeploySpec, envCtx: IEnvContext) => ({
  [`notifier-email-${ctx.env!.SMTP_USER.replace(/[^A-Za-z0-9]/g, '-')}`]: {
    image: `ghcr.io/no-trade-no-life/app-email-notifier:${ctx.version ?? envCtx.version}`,
    environment: makeDockerEnvs(ctx.env),
  },
});

export const make_k8s_resource_objects = async (ctx: IDeploySpec, envCtx: IEnvContext) => {
  const name = ctx.env!.SMTP_USER.replace(/[^A-Za-z0-9]/g, '-');
  return {
    deployment: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        labels: {
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
          'y.ntnl.io/email-user': name,
          'y.ntnl.io/component': 'email-notifier',
        },
        name: `email-notifier-${name}`,
        namespace: 'yuan',
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'y.ntnl.io/component': 'email-notifier',
            'y.ntnl.io/email-user': name,
          },
        },
        template: {
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'email-notifier',
              'y.ntnl.io/email-user': name,
            },
          },
          spec: {
            containers: [
              {
                env: makeK8sEnvs(ctx.env),
                image: `ghcr.io/no-trade-no-life/app-email-notifier:${ctx.version ?? envCtx.version}`,
                imagePullPolicy: 'IfNotPresent',
                name: 'email-notifier',
                resources: {
                  limits: {
                    cpu: ctx.cpu?.max ?? '400m',
                    memory: ctx.memory?.max ?? '512Mi',
                  },
                  requests: {
                    cpu: ctx.cpu?.min ?? '100m',
                    memory: ctx.memory?.min ?? '128Mi',
                  },
                },
              },
            ],
            hostname: 'email-notifier',
            imagePullSecrets: [
              {
                name: 'pull-secret',
              },
            ],
          },
        },
      },
    },
  };
};
