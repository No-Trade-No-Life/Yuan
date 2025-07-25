import * as SemiUIIcon from '@douyinfe/semi-icons';
import * as SemiUI from '@douyinfe/semi-ui';
import * as IconParksIcons from '@icon-park/react';
import * as dataModel from '@yuants/data-model';
import * as protocol from '@yuants/protocol';
import * as yuantsSql from '@yuants/sql';
import * as yuantsUtils from '@yuants/utils';
import * as yuantsCache from '@yuants/cache';
import echartsForReact from 'echarts-for-react';
import * as ethers from 'ethers';
import i18next from 'i18next';
import * as observableHooks from 'observable-hooks';
import React from 'react';
import * as reacti18next from 'react-i18next';
import * as rxjs from 'rxjs';
import * as yalps from 'yalps';

export const libs = {
  '@yuants/data-model': dataModel,
  '@yuants/protocol': protocol,
  '@yuants/utils': yuantsUtils,
  '@yuants/cache': yuantsCache,
  '@yuants/sql': yuantsSql,
  react: React,
  rxjs,
  yalps,
  '@douyinfe/semi-ui': SemiUI,
  i18next,
  'react-i18next': reacti18next,
  '@douyinfe/semi-icons': SemiUIIcon,
  '@icon-park/react': IconParksIcons,
  'observable-hooks': observableHooks,
  'echarts-for-react': echartsForReact,
  ethers: ethers,
};

Object.assign(globalThis, { Libs: libs });
