import * as FlexLayout from 'flexlayout-react';
import { BehaviorSubject, bufferCount, combineLatest, first, map, Subject } from 'rxjs';
import { createPersistBehaviorSubject } from './common/utils';
import i18n from './modules/Locale/i18n';

export const initialJson: FlexLayout.IJsonModel = {
  global: {
    // FIXED: 修复对多屏幕支持的问题后，再开启此功能
    // tabEnableFloat: true
  },
  borders: [
    {
      type: 'border',
      location: 'left',
      size: 320,
      children: [
        {
          type: 'tab',
          name: i18n.t('Workspace'),
          id: 'Explorer',
          component: 'Explorer',
          enableDrag: false,
          enableClose: false,
        },
        {
          type: 'tab',
          name: i18n.t('AgentConfForm'),
          id: 'AgentConfForm',
          component: 'AgentConfForm',
          enableDrag: false,
          enableClose: false,
        },
      ],
    },
    {
      type: 'border',
      location: 'bottom',
      children: [
        {
          type: 'tab',
          name: i18n.t('Program'),
          id: 'Program',
          enableClose: false,
          component: 'Program',
        },
      ],
    },
  ],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        id: '#main',
        type: 'tabset',
        active: true,
        enableDeleteWhenEmpty: false,
        children: [],
      },
    ],
  },
};

export const layoutModelJson$ = createPersistBehaviorSubject('layout', initialJson);

export const layoutUpdate$ = new Subject<void>();

combineLatest([layoutModelJson$, layoutUpdate$]).subscribe(([json]) => {
  layoutModel$.next(FlexLayout.Model.fromJson(json!));
});

layoutModelJson$
  .pipe(
    bufferCount(2),
    first(([a, b]) => a === undefined && b !== undefined),
    map(([, b]) => b),
  )
  .subscribe((json) => {
    layoutUpdate$.next();
  });

export const layoutModel$ = new BehaviorSubject(FlexLayout.Model.fromJson(initialJson));
layoutModel$.subscribe((layoutModel) => {
  Object.assign(globalThis, { layoutModel, Actions: FlexLayout.Actions });
});

export function openSingletonComponent(component: string, nodeName?: string, toNodeId = '#main') {
  const model = layoutModel$.value;
  const nodeId = component;
  const node = model.getNodeById(nodeId);
  if (node) {
    model.doAction(FlexLayout.Actions.selectTab(node.getId()));
  } else {
    model.doAction(
      FlexLayout.Actions.addNode(
        { id: nodeId, name: nodeName, component },
        toNodeId,
        FlexLayout.DockLocation.CENTER,
        -1,
      ),
    );
  }
}
