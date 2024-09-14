import { isNode } from 'browser-or-node';
import SimplePeer from 'simple-peer';
// @ts-ignore
import SimplePeerClass from 'simple-peer/simplepeer.min.js';

export const getSimplePeerInstance = (option?: {
  initiator?: boolean;
  channelName?: string;
}): SimplePeer.Instance => {
  if (isNode) {
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('@roamhq/wrtc');
    return new SimplePeer({
      ...option,
      wrtc: { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate },
    });
  }
  return new SimplePeerClass(option);
};
