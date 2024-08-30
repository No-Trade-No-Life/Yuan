import * as SemiUI from '@douyinfe/semi-ui';
import * as IconParksIcons from '@icon-park/react';
import * as dataModel from '@yuants/data-model';
import * as yuantsUtils from '@yuants/utils';
import { formatTime } from '@yuants/data-model';
import * as protocol from '@yuants/protocol';
import * as observableHooks from 'observable-hooks';
import React from 'react';
import * as rxjs from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { FsBackend$, fs } from '../FileSystem/api';
import { bundleCode } from '../Workspace';

registerCommand('LoadLocalExtensions', async () => {
  const json: {
    yuan?: {
      extensions?: Array<{ name: string; main: string }>;
    };
  } = JSON.parse(await fs.readFile('package.json'));
  if (!json.yuan?.extensions) return;
  console.info(formatTime(Date.now()), `loading local extensions...`);
  await rxjs.lastValueFrom(
    rxjs.from(json.yuan.extensions).pipe(
      rxjs.mergeMap((x) =>
        rxjs
          .defer(async () => {
            const code = await bundleCode(x.main);
            const requireContext = {
              '@yuants/ui-web': Modules,
              '@yuants/data-model': dataModel,
              '@yuants/protocol': protocol,
              '@yuants/utils': yuantsUtils,
              react: React,
              rxjs,
              '@douyinfe/semi-ui': SemiUI,
              '@icon-park/react': IconParksIcons,
              'observable-hooks': observableHooks,
            };

            Object.assign(globalThis, { requireContext });

            const module = new Function('globals', `return ${code}`)(requireContext);
            return module;
          })
          .pipe(
            rxjs.tap({
              next: (module) => {
                console.info(formatTime(Date.now()), `load local extension "${x.name}" successfully`);
              },
              error: (e) => {
                console.error(formatTime(Date.now()), `load local extension "${x.name}" failed`, e);
              },
            }),
          ),
      ),
    ),
  );
  console.info(formatTime(Date.now()), `load local extensions successfully`);
});

FsBackend$.subscribe(() => executeCommand('LoadLocalExtensions'));
