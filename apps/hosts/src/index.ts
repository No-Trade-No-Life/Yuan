import { createNodeJSHostManager } from '@yuants/host-manager';
import { verifyMessage } from '@yuants/utils';

createNodeJSHostManager({
  mapHostUrlToHostId: (host_url) => {
    const url = new URL(host_url);
    const public_key = url.searchParams.get('public_key')!;
    const signature = url.searchParams.get('signature')!;
    if (!public_key) throw new Error('public_key is required');
    if (!signature) throw new Error('signature is required');
    if (!verifyMessage('', signature, public_key)) throw new Error('signature is invalid');
    return public_key;
  },
});
