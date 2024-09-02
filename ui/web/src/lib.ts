import * as SemiUI from '@douyinfe/semi-ui';
import * as IconParksIcons from '@icon-park/react';
import * as dataModel from '@yuants/data-model';
import * as protocol from '@yuants/protocol';
import * as yuantsUtils from '@yuants/utils';
import * as observableHooks from 'observable-hooks';
import React from 'react';
import * as rxjs from 'rxjs';

export const libs = {
  '@yuants/data-model': dataModel,
  '@yuants/protocol': protocol,
  '@yuants/utils': yuantsUtils,
  react: React,
  rxjs,
  '@douyinfe/semi-ui': SemiUI,
  '@icon-park/react': IconParksIcons,
  'observable-hooks': observableHooks,
};

Object.assign(globalThis, { Libs: libs });
