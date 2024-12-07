import { createNodeJSHostManager } from '@yuants/host-manager';

createNodeJSHostManager({
  mapHostUrlToHostId: (host_url) => {
    const url = new URL(host_url);
    if (!process.env.HOST_TOKEN) return 'main';
    if (process.env.HOST_TOKEN !== url.searchParams.get('host_token')) throw new Error('InvalidHostToken');
    return 'main';
  },
});
