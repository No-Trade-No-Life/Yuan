import { useObservable, useObservableState } from 'observable-hooks';
import { extname, join } from 'path-browserify';
import React from 'react';
import {
  EMPTY,
  Subject,
  catchError,
  defer,
  filter,
  from,
  map,
  merge,
  mergeMap,
  throwIfEmpty,
  toArray,
} from 'rxjs';
import { registerCommand } from '../CommandCenter';
import { FsBackend$, createFileSystemBehaviorSubject, fs } from '../FileSystem';
import { generateWallpaper } from './generateWallPaper';

const reloadWallPaper$ = new Subject<void>();
const currentWallPaperIndex$ = createFileSystemBehaviorSubject('wall-paper-index', 0);

registerCommand('WallPaper.next', () => {
  currentWallPaperIndex$.next((currentWallPaperIndex$.value || 0) + 1);
});
registerCommand('WallPaper.prev', () => {
  currentWallPaperIndex$.next((currentWallPaperIndex$.value || 0) - 1);
});

registerCommand('WallPaper.reload', () => {
  reloadWallPaper$.next();
});

const WALLPAPER_DIR = '/.Y/wallpapers';

export const WallPaper = React.memo(() => {
  // Load WallPaper from Workspace
  const wallPaperURLs = useObservableState(
    useObservable(() =>
      merge(FsBackend$, reloadWallPaper$)
        .pipe(
          mergeMap(() =>
            defer(() => fs.readdir(WALLPAPER_DIR)).pipe(
              mergeMap((x) => x),
              map((x) => join(WALLPAPER_DIR, x)),
              catchError(() => EMPTY),
              toArray(),
            ),
          ),
        )
        .pipe(
          //
          map((x) => x.sort((a, b) => a.localeCompare(b))),
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
                  catchError(() => EMPTY),
                ),
              ),
              throwIfEmpty(() => new Error('No wallpaper found')),
              catchError(() =>
                generateWallpaper().then((url) => ({ filename: '', url, mime: 'image/jpeg' })),
              ),
              toArray(),
            ),
          ),
        ),
    ),
    [],
  );

  const currentWallPaperIndex = useObservableState(currentWallPaperIndex$) || 0;

  const selectedWallPaper =
    wallPaperURLs[
      ((currentWallPaperIndex % wallPaperURLs.length) + wallPaperURLs.length) % wallPaperURLs.length
    ];

  return (
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
          // ISSUE: video with sound will not autoPlay, so set muted
          muted
          loop
          // disable auto full-screen play in iOS
          playsInline
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
  );
});
