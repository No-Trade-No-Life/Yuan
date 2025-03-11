import { formatTime } from '@yuants/data-model';
import { listWatch } from '@yuants/utils';
import {
  bufferTime,
  concatMap,
  defer,
  filter,
  from,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  Subject,
  tap,
} from 'rxjs';
import './migrations';
import { terminal } from './terminal';
import { ITwitterEvent } from './types/ITwitterEvent';
import { getUserTweetsByName } from './utils/getUserTweetsByName';

const twitterMonitorUsers$ = defer(() =>
  terminal.requestForResponse('SQL', {
    query: `select * from twitter_monitor_users`,
  }),
).pipe(
  map((v) => (v.data || []) as { user_id: string }[]),
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
        terminal.requestForResponse('SQL', {
          query: `
      insert into twitter_messages (id, content, author_id, author, author_description, author_followers, author_image, created_at, raw_data) 
      values ${messages
        .map(
          (event) =>
            `('${event.id}', '${event.content}', '${event.author_id}', '${event.author}', '${event.author_description}', '${event.author_followers}', '${event.author_image}', '${event.created_at}', '${event.raw_data}')`,
        )
        .join(', ')} 
      ON CONFLICT (id) DO NOTHING;
`,
        }),
      ).pipe(retry({ delay: 5000 })),
    ),
  )
  .subscribe();
