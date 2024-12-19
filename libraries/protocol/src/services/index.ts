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
  /**
   * The terminal IDs that the message will be forwarded to (optional)
   * 消息将被转发到的终端 ID 列表 (可选)
   *
   * If set, the target_terminal_id will be ignored
   * 如果设置了该字段，则 target_terminal_id 将被忽略
   */
  target_terminal_ids?: string[];
  trace_id: string;

  method?: string;
  channel_id?: string;
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
