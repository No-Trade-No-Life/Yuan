export interface IChatMessage<T extends string, P extends {}> {
  type: T;
  payload: P;
}
export interface IMessageCardProps<P = {}> {
  payload: P;
  replaceMessage: (message: IChatMessage<any, any>[]) => void;
  send: () => void;
  sendMessages: (messages: IChatMessage<any, any>[]) => void;
  appendMessage: (message: IChatMessage<any, any>[]) => void;
}
