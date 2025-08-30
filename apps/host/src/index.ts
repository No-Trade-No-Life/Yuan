import { verifyMessage } from '@yuants/utils';
import { createNodeJSHostManager } from './host-manager';

createNodeJSHostManager({
  mapHostUrlToHostId: (host_url) => {
    const url = new URL(host_url);
    if (process.env.HOST_TOKEN) {
      if (process.env.HOST_TOKEN !== url.searchParams.get('host_token')) throw new Error('InvalidHostToken');
    }
    if (process.env.MULTI_TENANCY === 'ED25519') {
      const public_key = url.searchParams.get('public_key')!;
      const signature = url.searchParams.get('signature')!;
      if (!public_key) throw new Error('public_key is required');
      if (!signature) throw new Error('signature is required');
      if (!verifyMessage('', signature, public_key)) throw new Error('signature is invalid');
      return public_key;
    }
    return 'main';
  },
});
