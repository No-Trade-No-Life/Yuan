import {
  from,
  concatMap,
  delay,
  tap,
  repeatWhen,
  defer,
  map,
  retry,
  repeat,
  shareReplay,
  Subject,
  bufferTime,
  filter,
  mergeMap,
} from 'rxjs';
import { getUserTweetsByName } from './utils/getUserTweetsByName';
import { ITwitterEvent } from './types/ITwitterEvent';
import { formatTime } from '@yuants/data-model';
import { terminal } from './terminal';
import './migrations';
import { listWatch } from '@yuants/utils';

const twitterMonitorUsers$ = defer(() =>
  terminal.requestForResponse('SQL', {
    query: `select * from twitter_monitor_users`,
  }),
).pipe(
  map((v) => v.data as { user_id: string }[]),
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay(1),
);

const twitterMessage$ = new Subject<ITwitterEvent>();

terminal.provideChannel({ const: 'TwitterMonitorMessages' }, () => twitterMessage$);

twitterMonitorUsers$
  .pipe(
    listWatch(
      (v) => v.user_id,
      (user) =>
        defer(() => getUserTweetsByName(user.user_id)).pipe(
          // Handle each tweet
          concatMap((tweets) =>
            from(tweets).pipe(
              // Process each tweet
              tap((tweet) => {
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
              // After processing all tweets of a user
              tap(() => console.log(`Completed fetching for user: ${user}`)),
            ),
          ),
          // Delay seconds before re-triggering
          delay(3000),
          // Repeat the process indefinitely
          repeatWhen((completed) =>
            completed.pipe(
              tap(() => console.log(`Restarting fetch for user: ${user}`)),
              delay(5000),
            ),
          ),
          // Limit the number of repeats if needed (remove take if indefinite)
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
