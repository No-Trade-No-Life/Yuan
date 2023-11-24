import * as k8s from '@kubernetes/client-node';
import { IDeploySpec, mergeSchema } from '@yuants/extension';

// constants
export const GROUP = 'yuan.ntnl.io';
export const VERSION = 'v1alpha1';
export const KIND = 'Manifest';
export const PLURAL = 'manifests';
export const SINGULAR = 'manifest';

export const FINALIZER_NAME = 'yuan.finalizer.ntnl.io';

export interface IDeployResourceStatus {
  conditions: k8s.V1Condition[];
  managedResources: number;
  readyResources: number;
  // in the future, we may want to add more fields like phase denoting the current status of the agent
}

export interface IDeployResource extends k8s.KubernetesObject {
  apiVersion: string;
  kind: string;
  metadata: k8s.V1ObjectMeta;
  spec: IDeploySpec;
  status?: IDeployResourceStatus;
}

export const CRD: k8s.V1CustomResourceDefinition = {
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: {
    name: `${PLURAL}.${GROUP}`,
  },
  spec: {
    group: GROUP,
    names: {
      kind: KIND,
      plural: PLURAL,
      singular: SINGULAR,
    },
    scope: 'Namespaced',
    versions: [
      {
        name: 'v1alpha1',
        schema: {
          openAPIV3Schema: {
            type: 'object',
            required: ['spec'],
            description: 'Yuan Manifest',
            properties: {
              apiVersion: {
                type: 'string',
                description: 'Yuan Manifest API Version',
              },
              kind: {
                type: 'string',
                description: 'Resource Kind',
              },
              metadata: {
                type: 'object',
              },
              spec: mergeSchema({
                description: 'Yuan Manifest Spec',
                type: 'object',
              }) as k8s.V1JSONSchemaProps,
              status: {
                description: 'Yuan Manifest Status',
                type: 'object',
                properties: {
                  conditions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          description: 'Type of the condition',
                        },
                        status: {
                          type: 'string',
                          description: 'Status of the condition',
                        },
                        lastTransitionTime: {
                          type: 'string',
                          description: 'Last transition time',
                        },
                        reason: {
                          type: 'string',
                          description: 'Reason for the condition',
                        },
                        message: {
                          type: 'string',
                          description: 'Message for the condition',
                        },
                      },
                    },
                  },
                  managedResources: {
                    type: 'number',
                    description: 'Number of managed resources',
                  },
                  readyResources: {
                    type: 'number',
                    description: 'Number of ready resources',
                  },
                },
              },
            },
          },
        },
        served: true,
        storage: true,
      },
    ],
  },
};
