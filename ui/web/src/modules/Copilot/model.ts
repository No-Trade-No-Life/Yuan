export interface IChatMessage<T extends string, P extends {}> {
  type: T;
  payload: P;
}
export interface IMessageCardProps<P = {}> {
  payload: P;
  sendMessages: (messages: IChatMessage<any, any>[]) => void;
}
