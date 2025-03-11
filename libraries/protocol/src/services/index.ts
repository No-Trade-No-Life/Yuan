/**
 * Collection of service interfaces
 * 服务接口集合
 * @public
 */
export interface IService {}

/**
 * Message format for terminal communication
 * 终端通讯时的消息格式
 * @public
 */
export interface ITerminalMessage {
  source_terminal_id: string;
  target_terminal_id: string;
  trace_id: string;

  method?: string;

  req?: unknown;
  res?: IResponse<unknown>;
  frame?: unknown;
  /**
   * if true, both client and server should close the session defined by `trace_id`
   */
  done?: boolean;
}
/**
 * Response body for operations with side effects
 * 有副作用的操作的执行响应体
 * @public
 */
export interface IResponse<T = void> {
  code: number;
  message: string;
  data?: T;
}

export * from './predefined';
