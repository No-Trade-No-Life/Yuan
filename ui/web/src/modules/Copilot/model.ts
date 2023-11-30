export interface IChatMessage<T extends string, P extends {}> {
  type: T;
  payload: P;
}
export interface IMessageCardProps<P = {}> {
  payload: P;
  appendMessages: (message: IChatMessage<any, any>[]) => void;
  send: () => void;
  sendMessages: (messages: IChatMessage<any, any>[]) => void;
}
