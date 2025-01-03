import { JSONSchema7 } from 'json-schema';

/**
 * 终端基本信息
 *
 * @public
 */
export interface ITerminalInfo {
  /**
   * Terminal ID
   * 终端 ID
   *
   * Reported by the terminal, cannot be duplicated, required to be readable, and specified or generated by the terminal.
   * 终端上报，不可重复，要求可读，终端指定或生成。
   *
   * It is recommended to specify all TERMINAL_ID through environment variables in the project. If not, it can be fallback to the generated one.
   * 工程上建议所有的 TERMINAL_ID 可以通过环境变量指定，如果没有，可以 fallback 到生成的。
   */
  terminal_id: string;

  /**
   * Terminal startup timestamp
   * 终端本次启动的时间戳
   *
   * Used to calculate uptime_in_ms = Date.now() - created_at
   * 用于计算 uptime_in_ms = Date.now() - created_at
   *
   * When empty, it is equivalent to Date.now()
   * 为空时，等同于 Date.now()
   */
  created_at?: number;

  /**
   * Terminal Information Update Timestamp
   */
  updated_at?: number;

  /**
   * Terminal's subscriptions
   *
   * terminal itself is a consumer.
   *
   * map provider_terminal_id to channel_id[]
   */
  subscriptions?: Record<string, string[]>;

  /**
   * Terminal service name
   * 终端服务名称
   *
   * Can be duplicated, readable by humans
   * 可重复, 人类可读
   */
  name?: string;

  /**
   * Service information provided by the terminal
   * 终端提供的服务信息
   */
  serviceInfo?: Record<
    string,
    {
      /**
       * Service name
       * 服务的名称
       */
      method: string;
      /**
       * The message must conform to this schema for the server to process it (JSON Schema)
       * 消息符合此模式时，服务端才会处理
       */
      schema: JSONSchema7;
    }
  >;

  /** Provider Channel ID Schema */
  channelIdSchemas?: JSONSchema7[];

  /**
   * A flag to indicate whether the terminal enables WebRTC messaging tunnel
   */
  enable_WebRTC?: boolean;

  /**
   * Status text
   * 状态文字
   *
   * Short, human-readable
   * 简短的，人类可读的
   *
   * Conventionally, it is initialized to "INIT" at startup;
   * 约定，启动时，初始化为 "INIT";
   *
   * "OK" is the normal value for everything else.
   * 约定 "OK" 为一切正常的取值，其余的都是不正常。
   *
   * @deprecated - Remove this field
   */
  status?: string;
}
