import { isNode } from 'browser-or-node';
import SimplePeer from 'simple-peer';

export const getSimplePeerClass = async (): Promise<typeof SimplePeer> => {
  if (isNode) {
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = await import('@roamhq/wrtc');
    Object.assign(globalThis, { RTCIceCandidate, RTCSessionDescription, RTCPeerConnection });
  }
  // @ts-ignore
  const TheSimplePeer = await import('simple-peer/simplepeer.min.js');
  return TheSimplePeer.default;
};
