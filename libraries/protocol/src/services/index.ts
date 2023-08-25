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
  trace_id: string;
  method: string;
  /**
   * (Network layer) Indicates the target terminal of the data frame
   * (网络层) 表明数据帧的目标终端
   */
  target_terminal_id: string;
  /**
   * (Network layer) Indicates the source terminal of the data frame
   * (网络层) 表明数据帧的来源终端
   */
  source_terminal_id: string;
  req?: unknown;
  res?: IResponse<unknown>;
  frame?: unknown;
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
