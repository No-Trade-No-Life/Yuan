import * as SemiUIIcon from '@douyinfe/semi-icons';
import * as SemiUI from '@douyinfe/semi-ui';
import * as IconParksIcons from '@icon-park/react';
import * as yuantsCache from '@yuants/cache';
import * as dataInterestRate from '@yuants/data-interest-rate';
import * as dataOHLC from '@yuants/data-ohlc';
import * as dataOrder from '@yuants/data-order';
import * as dataProduct from '@yuants/data-product';
import * as dataQuote from '@yuants/data-quote';
import * as dataSeries from '@yuants/data-series';
import * as dataAccount from '@yuants/data-account';
import * as protocol from '@yuants/protocol';
import * as yuantsSql from '@yuants/sql';
import * as yuantsUtils from '@yuants/utils';
import echartsForReact from 'echarts-for-react';
import * as ethers from 'ethers';
import i18next from 'i18next';
import * as observableHooks from 'observable-hooks';
import React from 'react';
import * as reacti18next from 'react-i18next';
import * as rxjs from 'rxjs';
import * as yalps from 'yalps';

export const libs = {
  '@yuants/protocol': protocol,
  '@yuants/utils': yuantsUtils,
  '@yuants/cache': yuantsCache,
  '@yuants/sql': yuantsSql,
  '@yuants/data-ohlc': dataOHLC,
  '@yuants/data-order': dataOrder,
  '@yuants/data-account': dataAccount,
  '@yuants/data-quote': dataQuote,
  '@yuants/data-interest-rate': dataInterestRate,
  '@yuants/data-series': dataSeries,
  '@yuants/data-product': dataProduct,
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

Object.assign(globalThis, { Libs: libs, utils: yuantsUtils, protocol, rxjs });
