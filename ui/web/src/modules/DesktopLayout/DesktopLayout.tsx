import { IconFullScreenStroked, IconHome } from '@douyinfe/semi-icons';
import { Layout, Space } from '@douyinfe/semi-ui';
import { Actions, Layout as FlexLayout, TabNode } from 'flexlayout-react';
import { useObservable, useObservableState } from 'observable-hooks';
import { extname, join } from 'path-browserify';
import { useEffect, useState } from 'react';
import { filter, from, map, mergeMap, toArray } from 'rxjs';
import { CommandCenter } from '../CommandCenter';
import { FsBackend$, fs } from '../FileSystem';
import { Button } from '../Interactive';
import { LanguageSelector } from '../Locale/LanguageSelector';
import { LocalizePageTitle, Page } from '../Pages';
import { ErrorBoundary } from '../Pages/ErrorBoundary';
import { NetworkStatusWidget } from '../Terminals/NetworkStatusWidget';
import { UserMenu } from '../User/UserMenu';
import { HomePage, isShowHome$, toggleShowHome, useIsDarkMode } from '../Workbench';
import { DarkmodeSwitch } from '../Workbench/DarkmodeSwitch';
import { layoutModel$, layoutModelJson$ } from './layout-model';

// ISSUE: React.memo will cause layout tab label not change while change language
export const DesktopLayout = () => {
  const model = useObservableState(layoutModel$);
  const isShowHome = useObservableState(isShowHome$);

  const factory = (node: TabNode) => {
    const id = node.getId();
    const type = node.getComponent()!;
    const params = node.getConfig() || {};
    const rect = node.getRect();
    const viewport = {
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    };

    return <Page page={{ id, type, params, viewport }} />;
  };

  const isDarkMode = useIsDarkMode();

  const [style, setStyle] = useState('');

  useEffect(() => {
    // ISSUE: use css by raw import will not produce side-effect. we can easily switch between dark and light
    if (isDarkMode) {
      import('flexlayout-react/style/dark.css?raw').then((mod) => setStyle(mod.default));
    } else {
      import('flexlayout-react/style/light.css?raw').then((mod) => setStyle(mod.default));
    }
  }, [isDarkMode]);

  // Load WallPaper from Workspace
  const wallPaperURLs = useObservableState(
    useObservable(() =>
      FsBackend$.pipe(
        mergeMap(async () => {
          const wallpaper_dir = '/.Y/wallpapers';
          const wallpapers = await fs.readdir(wallpaper_dir);
          return wallpapers.map((x) => join(wallpaper_dir, x));
        }),
      ).pipe(
        //
        mergeMap((x) =>
          from(x).pipe(
            map((filename) => {
              const ext = extname(filename);
              // TODO: add more MIME types mapping here
              const mime = {
                '.gif': 'image/gif',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.ogv': 'video/ogg',
                '.mpeg': 'video/mpeg',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo',
                '.3gp': 'video/3gpp',
                '.3g2': 'video/3gpp2',
              }[ext];
              if (!mime) return null;
              return { filename, mime };
            }),
            filter((x): x is Exclude<typeof x, null> => !!x),
            mergeMap(({ filename, mime }) =>
              // Blob supports big file (about 100MB tested)
              from(fs.readFileAsBlob(filename)).pipe(
                map((blob) => URL.createObjectURL(blob)),
                map((url) => ({ filename, url, mime })),
              ),
            ),
            toArray(),
          ),
        ),
      ),
    ),
    [],
  );

  const selectedWallPaper = wallPaperURLs[0];

  if (document.location.hash === '#/popout') {
    return null;
  }

  return (
    <Layout
      style={{
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
        }}
      >
        {selectedWallPaper && selectedWallPaper.mime.match(/image/) && (
          <img
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            src={selectedWallPaper.url}
          />
        )}
        {selectedWallPaper && selectedWallPaper.mime.match(/video/) && (
          <video
            autoPlay
            loop
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            src={selectedWallPaper.url}
          />
        )}
      </div>
      {isShowHome ? <HomePage /> : null}
      <Layout.Content style={{ position: 'relative' }}>
        {model && (
          <FlexLayout
            onModelChange={(model) => {
              layoutModelJson$.next(model.toJson());
            }}
            onRenderTab={(node, renderValues) => {
              renderValues.content = (
                <LocalizePageTitle type={node.getComponent()!} params={node.getConfig()} />
              );
            }}
            onTabSetPlaceHolder={() => {
              isShowHome$.next(true);
              return null;
            }}
            onAuxMouseClick={(node, e) => {
              if (
                node instanceof TabNode &&
                node.isEnableClose() &&
                // middle click
                e.button === 1
              ) {
                model.doAction(Actions.deleteTab(node.getId()));
              }
            }}
            popoutURL="/#/popout"
            model={model}
            factory={factory}
          />
        )}

        <style>{style}</style>
      </Layout.Content>
      <Layout.Header style={{ padding: 4 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <ErrorBoundary>
              <UserMenu />
            </ErrorBoundary>
            <Button
              icon={<IconHome />}
              theme="borderless"
              type={isShowHome ? 'primary' : 'tertiary'}
              onClick={async () => {
                toggleShowHome();
              }}
            />
          </Space>
          <Space>
            <CommandCenter />
          </Space>
          <Space>
            <Space>
              <ErrorBoundary>
                <NetworkStatusWidget />
              </ErrorBoundary>
              <ErrorBoundary>
                <LanguageSelector />
              </ErrorBoundary>
              <ErrorBoundary>
                <DarkmodeSwitch />
              </ErrorBoundary>
              <ErrorBoundary>
                <Button
                  theme="borderless"
                  type="tertiary"
                  icon={<IconFullScreenStroked />}
                  onClick={async () => {
                    if (document.fullscreenElement) {
                      return document.exitFullscreen();
                    }
                    function enterFullscreen(element: any) {
                      if (element.requestFullscreen) {
                        return element.requestFullscreen();
                      } else if (element.mozRequestFullScreen) {
                        // Firefox
                        return element.mozRequestFullScreen();
                      } else if (element.webkitRequestFullscreen) {
                        // Chrome, Safari and Opera
                        return element.webkitRequestFullscreen();
                      } else if (element.msRequestFullscreen) {
                        // IE/Edge
                        return element.msRequestFullscreen();
                      }
                    }
                    return enterFullscreen(document.body);

                    // return document.body.requestFullscreen();
                  }}
                ></Button>
              </ErrorBoundary>
            </Space>
          </Space>
        </Space>
      </Layout.Header>
    </Layout>
  );
};
