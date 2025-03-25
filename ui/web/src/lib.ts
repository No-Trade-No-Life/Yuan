import * as SemiUI from '@douyinfe/semi-ui';
import * as SemiUIIcon from '@douyinfe/semi-icons';
import * as IconParksIcons from '@icon-park/react';
import * as dataModel from '@yuants/data-model';
import * as protocol from '@yuants/protocol';
import * as yuantsUtils from '@yuants/utils';
import echartsForReact from 'echarts-for-react';
import * as observableHooks from 'observable-hooks';
import React from 'react';
import * as rxjs from 'rxjs';
import * as yalps from 'yalps';
import * as ethers from 'ethers';

export const libs = {
  '@yuants/data-model': dataModel,
  '@yuants/protocol': protocol,
  '@yuants/utils': yuantsUtils,
  react: React,
  rxjs,
  yalps,
  '@douyinfe/semi-ui': SemiUI,
  '@douyinfe/semi-icons': SemiUIIcon,
  '@icon-park/react': IconParksIcons,
  'observable-hooks': observableHooks,
  'echarts-for-react': echartsForReact,
  ethers: ethers,
};

Object.assign(globalThis, { Libs: libs });
