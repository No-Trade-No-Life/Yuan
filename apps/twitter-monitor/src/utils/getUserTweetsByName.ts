import { ApifyClient } from 'apify-client';
import { ITwitter } from '../types/ITwitter';

const GET_TWITTER_METHOD_ID = `61RPP7dywgiy0JPD0`;
const token = process.env.APIFY_TOKEN;
//if use apify
const client = new ApifyClient({
  token,
});

//通过推特的用户名字 获取推特的信息
export const getUserTweetsByName = async (name: string): Promise<ITwitter[]> => {
  const input = {
    author: name,
    customMapFunction: (object: any) => {
      return { ...object };
    },
    includeSearchTerms: false,
    maxItems: 3,
    onlyImage: false,
    onlyQuote: false,
    onlyTwitterBlue: false,
    onlyVerifiedUsers: false,
    onlyVideo: false,
    sort: 'Latest',
    twitterHandles: [name],
  };
  // Run the Actor and wait for it to finish
  const run = await client.actor(GET_TWITTER_METHOD_ID).call(input);
  // Fetch and print Actor results from the run's dataset (if any)
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items as any;
};
