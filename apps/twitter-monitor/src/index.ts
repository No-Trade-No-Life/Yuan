import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import {
  bufferTime,
  concatMap,
  defer,
  filter,
  from,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  Subject,
  tap,
} from 'rxjs';
import './migrations';
import { ITwitterEvent } from './types/ITwitterEvent';
import { getUserTweetsByName } from './utils/getUserTweetsByName';
const terminal = Terminal.fromNodeEnv();
const twitterMonitorUsers$ = defer(() =>
  requestSQL<{ user_id: string }[]>(terminal, `select * from twitter_monitor_users`),
).pipe(
  //
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay(1),
);

const twitterMessage$ = new Subject<ITwitterEvent>();

terminal.channel.publishChannel('TwitterMonitorMessages', { const: '' }, () => twitterMessage$);

twitterMonitorUsers$
  .pipe(
    listWatch(
      (v) => v.user_id,
      (user) =>
        defer(() => getUserTweetsByName(user.user_id)).pipe(
          tap({
            subscribe: () => console.log(formatTime(Date.now()), `Start fetching for user`, user.user_id),
            complete: () => console.log(formatTime(Date.now()), `Completed fetching for user`, user.user_id),
          }),
          // Handle each tweet
          concatMap((tweets) =>
            from(tweets).pipe(
              // Process each tweet
              filter((tweet) => !tweet?.noResults),
              tap((tweet) => {
                console.log(formatTime(Date.now()), 'tap tweet', user.user_id, tweet);
                const event: ITwitterEvent = {
                  id: tweet.id,
                  content: tweet.text,
                  author_id: tweet.author.id,
                  author: tweet.author.userName,
                  author_description: tweet.author.description,
                  author_followers: tweet.author.followers,
                  author_image: tweet.author.profilePicture,
                  created_at: formatTime(new Date(tweet.createdAt).getTime()),
                  raw_data: JSON.stringify(tweet),
                };
                twitterMessage$.next(event);
              }),
            ),
          ),
          repeat({ delay: 3000 }),
        ),
      (a, b) => a.user_id === b.user_id,
    ),
  )
  .subscribe();

twitterMessage$.subscribe((event) => console.log('output: ', event));

twitterMessage$
  .pipe(
    bufferTime(1000),
    filter((x) => x.length > 0),
    mergeMap((messages) =>
      defer(() =>
        requestSQL(
          terminal,
          buildInsertManyIntoTableSQL(messages, 'twitter_messages', {
            columns: [
              'id',
              'content',
              'author_id',
              'author',
              'author_description',
              'author_followers',
              'author_image',
              'created_at',
              'raw_data',
            ],
            ignoreConflict: true,
          }),
        ),
      ).pipe(retry({ delay: 5000 })),
    ),
  )
  .subscribe();
