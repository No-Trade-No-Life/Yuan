export interface IChatMessage<T extends string, P extends {}> {
  type: T;
  payload: P;
}
export interface IMessageCardProps<P = {}> {
  payload: P;
  messages: IChatMessage<any, any>[];
  replaceMessage: (message: IChatMessage<any, any>[]) => void;
  send: () => void;
  appendMessage: (message: IChatMessage<any, any>[]) => void;
}
