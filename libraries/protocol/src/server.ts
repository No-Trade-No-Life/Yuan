import { ValueType } from '@opentelemetry/api';
import { formatTime, UUID } from '@yuants/utils';
import { JSONSchema7 } from 'json-schema';
import {
  BehaviorSubject,
  catchError,
  defer,
  filter,
  from,
  interval,
  of,
  Subject,
  takeUntil,
  tap,
  timeout,
} from 'rxjs';
import { MetricsMeterProvider } from './metrics';
import {
  IServiceHandler,
  IServiceInfo,
  IServiceInfoServerSide,
  IServiceOptions,
  ITerminalMessage,
} from './model';
import { createValidator } from './schema';
import { Terminal } from './terminal';

// 1. Initialize: create a RequestContext
// 2. Routing: binding a ServiceContext to RequestContext, if complete goto pending, if error, goto finalizing
// 3. Pending: if the processing is full (auto keepalive heartbeat when pending), if failed, goto finalizing
// 4. Processing: (must be routed), if complete, go processed; if error, goto finalize
// 5. Processed: if complete, goto finalizing. release the processing, schedule the next pending request in the same service
// 6. Finalizing: complete (close) the output$ of RequestContext
// All Initialized requests must be finalizing

interface IRequestContext {
  trace_id: string;
  message: ITerminalMessage;
  output$: Subject<IServiceOutput>;
  serviceContext?: IServiceContext;

  stage: 'initialized' | 'routed' | 'pending' | 'processing' | 'processed' | 'finalizing';

  isAborted$: BehaviorSubject<boolean>;

  // timestamp
  initialized_at: number;
  routed_at: number;
  processing_at: number;
  processed_at: number;
  finalized_at: number;

  // response code
  response?: ITerminalMessage['res'];
}
type IServiceOutput = Omit<
  ITerminalMessage,
  'trace_id' | 'method' | 'source_terminal_id' | 'target_terminal_id' | 'seq_id'
>;

interface IServiceContext {
  service_id: string;
  method: string;
  service: IServiceInfoServerSide;
  pending: IRequestContext[];
  processing: Set<IRequestContext>;

  /**
   * 入队令牌容量
   */
  ingress_token_capacity: number;
  /**
   * 当前剩余入队令牌
   */
  ingress_token_remaining: number;
  /**
   * 入队令牌补充间隔，单位毫秒
   */
  ingress_token_refill_interval: number;
  /**
   * 队列容量
   */
  capacity: number;
  /**
   * 出队令牌容量
   */
  egress_token_capacity: number;
  /**
   * 当前剩余出队令牌
   */
  egress_token_remaining: number;
  /**
   * 出队令牌补充间隔，单位毫秒
   */
  egress_token_refill_interval: number;
  /**
   * 最大并发处理量
   */
  concurrency: number;

  // counts
  total_routed: number;
  total_processed: number;

  /**
   * Service 被清理时触发
   */
  dispose$: Subject<void>;
}

/**
 * Terminal Server Module
 *
 * @public
 */
export class TerminalServer {
  constructor(public readonly terminal: Terminal) {
    //
    this._setupServer();
    this._setupHeartbeat();
    this._setMetrics();
  }

  private _setMetrics() {
    interval(5000)
      .pipe(takeUntil(this.terminal.dispose$))
      .subscribe(() => {
        this._mapServiceIdToServiceRuntimeContext.forEach((serviceContext) => {
          RequestPendingTotal.record(serviceContext.pending.length, {
            method: serviceContext.method,
            service_id: serviceContext.service_id,
            terminal_id: this.terminal.terminal_id,
          });
          RequestProcessingTotal.record(serviceContext.processing.size, {
            method: serviceContext.method,
            service_id: serviceContext.service_id,
            terminal_id: this.terminal.terminal_id,
          });
        });
      });
  }

  public mapServiceIdToService = new Map<string, IServiceInfoServerSide>();

  private _mapServiceIdToServiceRuntimeContext = new Map<string, IServiceContext>();

  private _mapMethodToServiceIds = new Map<string, Set<string>>();

  /**
   * Provide a service
   */
  provideService<TReq = {}, TRes = void, TFrame = void>(
    method: string,
    requestSchema: JSONSchema7,
    handler: IServiceHandler<TReq, TRes, TFrame>,
    options?: IServiceOptions,
  ): { dispose: () => void } {
    const service_id = UUID();
    const serviceInfo: IServiceInfo = { service_id, method, schema: requestSchema };

    // update terminalInfo
    (this.terminal.terminalInfo.serviceInfo ??= {})[service_id] = serviceInfo;
    this.terminal.terminalInfoUpdated$.next();

    const service: IServiceInfoServerSide = {
      serviceInfo,
      handler: handler as any,
      options: options || {},
      validator: createValidator(requestSchema),
    };
    // update service object
    this.addService(service);
    const dispose = () => {
      delete this.terminal.terminalInfo.serviceInfo?.[service_id];
      this.terminal.terminalInfoUpdated$.next();
      this.removeService(service_id);
    };
    return { dispose };
  }

  addService = (service: IServiceInfoServerSide) => {
    const serviceId = service.serviceInfo.service_id || service.serviceInfo.method;
    const dispose$ = new Subject<void>();
    this.mapServiceIdToService.set(serviceId, service);
    this._mapMethodToServiceIds.set(
      service.serviceInfo.method,
      (this._mapMethodToServiceIds.get(service.serviceInfo.method) || new Set()).add(serviceId),
    );

    const serviceRuntimeContext: IServiceContext = {
      service_id: serviceId,
      method: service.serviceInfo.method,
      service: this.mapServiceIdToService.get(serviceId)!,
      pending: [],
      processing: new Set(),

      concurrency: service.options.concurrent || Infinity,
      capacity: service.options.max_pending_requests || Infinity,

      ingress_token_capacity: service.options.ingress_token_capacity || Infinity,
      ingress_token_remaining: service.options.ingress_token_capacity || Infinity,
      ingress_token_refill_interval: service.options.ingress_token_refill_interval || 1000,

      egress_token_capacity: service.options.egress_token_capacity || Infinity,
      egress_token_remaining: service.options.egress_token_capacity || Infinity,
      egress_token_refill_interval: service.options.egress_token_refill_interval || 1000,

      total_routed: 0,
      total_processed: 0,
      dispose$,
    };

    if (service.options.ingress_token_capacity) {
      interval(service.options.ingress_token_refill_interval || 1000)
        .pipe(
          takeUntil(dispose$),
          tap(() => {
            serviceRuntimeContext.ingress_token_remaining = serviceRuntimeContext.ingress_token_capacity;
          }),
        )
        .subscribe();
    }

    if (service.options.egress_token_capacity) {
      interval(service.options.egress_token_refill_interval || 1000)
        .pipe(
          takeUntil(dispose$),
          tap(() => {
            serviceRuntimeContext.egress_token_remaining = serviceRuntimeContext.egress_token_capacity;
            this._checkQueue(serviceRuntimeContext);
          }),
        )
        .subscribe();
    }

    this._mapServiceIdToServiceRuntimeContext.set(serviceId, serviceRuntimeContext);
  };

  removeService = (serviceId: string) => {
    const service = this.mapServiceIdToService.get(serviceId);
    if (!service) return;
    this.mapServiceIdToService.delete(serviceId);
    this._mapMethodToServiceIds.get(service.serviceInfo.method)?.delete(serviceId);

    // Abort all processing and pending requests
    const serviceContext = this._mapServiceIdToServiceRuntimeContext.get(serviceId);
    if (serviceContext) {
      serviceContext.pending.forEach((requestContext) => {
        requestContext.isAborted$.next(true);
      });
      serviceContext.processing.forEach((requestContext) => {
        requestContext.isAborted$.next(true);
      });
      serviceContext.dispose$.next();
    }
  };

  private _mapTraceIdToRequestContext = new Map<string, IRequestContext>();

  /**
   * 检查队列，尝试将 Pending 的请求推进到 Processing
   *
   * 检查时机:
   * - 新请求入队时
   * - 出队令牌补充时
   * - 每次请求处理完成时
   *
   * @param serviceContext - 服务上下文
   */
  private _checkQueue(serviceContext: IServiceContext) {
    if (serviceContext.egress_token_remaining <= 0) return;
    if (serviceContext.processing.size >= serviceContext.concurrency) return;
    const nextRequest = serviceContext.pending.shift();
    if (!nextRequest) return;
    serviceContext.egress_token_remaining--;
    this._handleRequestProcessing(nextRequest);
  }

  private _setupServer() {
    // Msg -> Initialize Request
    from(this.terminal.input$)
      .pipe(takeUntil(this.terminal.dispose$))
      .subscribe((msg) => {
        // if incoming msg is a request
        if (!msg.method) return;
        if (!msg.req) return;
        if (msg.frame || msg.res) return;

        if (this.terminal.options.verbose) {
          console.info(formatTime(Date.now()), 'Server', `RequestReceived`, msg.trace_id, msg.method);
        }

        const output$ = new Subject<IServiceOutput>();

        const terminalMessageBase: ITerminalMessage = {
          // Auto fill the trace_id and method
          trace_id: msg.trace_id,
          seq_id: msg.seq_id || 0,
          method: msg.method,
          // ISSUE: Reverse source / target as response, otherwise the host cannot guarantee the forwarding direction
          source_terminal_id: this.terminal.terminal_id,
          target_terminal_id: msg.source_terminal_id,
        };

        output$.subscribe({
          next: (x) => {
            terminalMessageBase.seq_id!++;
            const terminalMessage: ITerminalMessage = {
              ...x,
              ...terminalMessageBase,
            };
            if (x.res) {
              terminalMessage.done = true;
            }
            this.terminal.output$.next(terminalMessage);
          },
          complete: () => {
            terminalMessageBase.seq_id!++;
            this.terminal.output$.next({
              //
              ...terminalMessageBase,
              done: true,
            });
          },
          error: () => {
            terminalMessageBase.seq_id!++;
            this.terminal.output$.next({
              ...terminalMessageBase,
              res: { code: 500, message: 'Internal Server Error' },
              done: true,
            });
          },
        });

        const requestContext: IRequestContext = {
          stage: 'initialized',
          trace_id: msg.trace_id,
          message: msg,
          output$,
          isAborted$: new BehaviorSubject(false),
          initialized_at: NaN,
          routed_at: NaN,
          processing_at: NaN,
          processed_at: NaN,
          finalized_at: NaN,
        };

        this._mapTraceIdToRequestContext.set(msg.trace_id, requestContext);

        output$.subscribe((x) => {
          if (x.res) {
            requestContext.response = x.res;
          }
        });

        requestContext.isAborted$.subscribe((aborted) => {
          if (!aborted) return;
          if (requestContext.stage === 'pending') {
            // remove from pending queue
            const serviceContext = requestContext.serviceContext;
            if (!serviceContext) return;
            const idx = serviceContext.pending.lastIndexOf(requestContext);
            if (idx < 0) return;
            serviceContext.pending.splice(idx, 1);
          }
        });

        this._routeRequest(requestContext);
      });

    // Abort Request
    from(this.terminal.input$)
      .pipe(takeUntil(this.terminal.dispose$))
      .subscribe((msg) => {
        if (!msg.done) return;
        const requestContext = this._mapTraceIdToRequestContext.get(msg.trace_id);
        if (!requestContext) return;
        if (this.terminal.options.verbose) {
          console.info(formatTime(Date.now()), 'Server', `RequestAborted`, msg.trace_id);
        }

        // Immediately remove if the request is pending, for saving the queue capacity
        if (requestContext.stage === 'pending') {
          const serviceContext = requestContext.serviceContext;

          if (serviceContext) {
            const idx = serviceContext.pending.indexOf(requestContext);
            if (idx >= 0) {
              serviceContext.pending.splice(idx, 1);
            }
          }
        }

        requestContext.isAborted$.next(true);
      });
  }

  private _routeRequest(requestContext: IRequestContext) {
    requestContext.initialized_at = Date.now();
    requestContext.stage = 'initialized';
    RequestReceivedTotal.add(1, {
      method: requestContext.message.method!,
      source_terminal_id: requestContext.message.source_terminal_id,
      target_terminal_id: this.terminal.terminal_id,
    });

    const { message, output$ } = requestContext;
    const method = message.method!;
    // find the service
    const candidates = this._mapMethodToServiceIds.get(method);
    if (!candidates) {
      output$.next({ res: { code: 400, message: 'Bad Request: Method Not Found' } });
      this._finalizeRequest(requestContext);
      return;
    }
    let targetService: IServiceInfoServerSide | undefined;
    for (const serviceId of candidates) {
      const serviceInfo = this.mapServiceIdToService.get(serviceId);
      if (!serviceInfo) continue;
      if (serviceInfo.validator(message.req!)) {
        if (targetService) {
          output$.next({ res: { code: 400, message: 'Bad Request: Ambiguous Service' } });
          this._finalizeRequest(requestContext);
          return;
        }
        targetService = serviceInfo;
      }
    }
    if (!targetService) {
      output$.next({ res: { code: 400, message: 'Bad Request: No Matching Service' } });
      this._finalizeRequest(requestContext);
      return;
    }

    // Routing Finished, Binding ServiceContext to RequestContext
    const serviceId = targetService.serviceInfo.service_id || targetService.serviceInfo.method;
    const serviceContext = this._mapServiceIdToServiceRuntimeContext.get(serviceId);
    if (!serviceContext) {
      output$.next({ res: { code: 500, message: 'Internal Server Error: Service Not Found' } });
      this._finalizeRequest(requestContext);
      return;
    }
    requestContext.serviceContext = serviceContext;

    // 路由成功
    requestContext.routed_at = Date.now();
    requestContext.stage = 'routed';

    serviceContext.total_routed++;

    if (serviceContext.pending.length >= serviceContext.capacity) {
      output$.next({ res: { code: 503, message: 'Service Unavailable: Pending Queue Full' } });
      this._finalizeRequest(requestContext);
      return;
    }

    if (serviceContext.ingress_token_remaining <= 0) {
      output$.next({
        res: {
          code: 429,
          message: `Too Many Requests: Ingress Rate Limit Exceeded: capacity = ${serviceContext.ingress_token_capacity}, interval = ${serviceContext.ingress_token_refill_interval} ms`,
        },
      });
      this._finalizeRequest(requestContext);
      return;
    }
    serviceContext.ingress_token_remaining--;

    requestContext.stage = 'pending';
    serviceContext.pending.push(requestContext);

    this._checkQueue(serviceContext);
  }

  private _handleRequestProcessing(requestContext: IRequestContext) {
    requestContext.processing_at = Date.now();
    requestContext.stage = 'processing';
    const { message, serviceContext, output$ } = requestContext;
    if (!serviceContext) throw new Error('ServiceContext Not Found');
    serviceContext.processing.add(requestContext);
    requestContext.output$.next({ event: { type: 'in_processing' } });

    defer(() =>
      serviceContext.service.handler(message as any, {
        isAborted$: requestContext.isAborted$,
      }),
    )
      .pipe(
        takeUntil(requestContext.isAborted$.pipe(filter((x) => x))), // Abort if true
        catchError((err) => {
          console.info(formatTime(Date.now()), `ServerError`, JSON.stringify(message), err);
          return of({ res: { code: 500, message: `Internal Server Error: ${err}` } });
        }),
        timeout(60_000),
        catchError((err) => {
          console.info(formatTime(Date.now()), `ServerError`, JSON.stringify(message), err);
          // Intentionally trigger the abort flag to stop further processing on timeout
          requestContext.isAborted$.next(true);
          return of({ res: { code: 504, message: `Service Handler Timeout: ${err}` } });
        }),
        tap({
          next: (msg) => {
            output$.next(msg);
          },
          complete: () => {
            this._handleRequestProcessed(requestContext);
          },
        }),
      )
      .pipe(takeUntil(this.terminal.dispose$))
      .subscribe();
  }

  /**
   * 处理请求完成 (Processed) 逻辑
   *
   * 仅在调用业务处理函数后调用，由于各种原因 (限流、排队时取消)，没有被业务处理函数调用的请求不会进入该函数
   *
   * @param requestContext - 请求上下文
   */
  private _handleRequestProcessed(requestContext: IRequestContext) {
    requestContext.processed_at = Date.now();
    requestContext.stage = 'processed';
    const { serviceContext } = requestContext;
    if (!serviceContext) throw new Error('ServiceContext Not Found');

    serviceContext.processing.delete(requestContext);
    serviceContext.total_processed++;

    // finalize
    this._finalizeRequest(requestContext);

    // schedule the next pending
    this._checkQueue(serviceContext);
  }

  private _finalizeRequest(requestContext: IRequestContext) {
    requestContext.finalized_at = Date.now();
    requestContext.stage = 'finalizing';
    requestContext.output$.complete();
    if (this.terminal.options.verbose) {
      console.info(formatTime(Date.now()), 'Server', 'RequestFinalized', requestContext.message.trace_id);
    }

    RequestFinalizedTotal.add(1, {
      method: requestContext.message.method!,
      source_terminal_id: requestContext.message.source_terminal_id,
      target_terminal_id: this.terminal.terminal_id,
    });

    this._mapTraceIdToRequestContext.delete(requestContext.trace_id);

    const duration = requestContext.finalized_at - requestContext.initialized_at;
    if (isNaN(duration)) return;
    RequestDurationBucket.record(duration, {
      method: requestContext.message.method!,
      source_terminal_id: requestContext.message.source_terminal_id,
      target_terminal_id: this.terminal.terminal_id,
      code: requestContext.response?.code ?? 520,
    });
  }

  private _setupHeartbeat() {
    interval(5000)
      .pipe(takeUntil(this.terminal.dispose$))
      .subscribe(() => {
        this._mapServiceIdToServiceRuntimeContext.forEach((serviceContext) => {
          serviceContext.pending.forEach((requestContext, index) => {
            requestContext.output$.next({
              event: {
                type: 'heartbeat',
                payload: {
                  position: index + 1,
                  total: serviceContext.pending.length,
                },
              },
            });
          });
        });
      });
  }
}

const TerminalMeter = MetricsMeterProvider.getMeter('terminal-server');

const RequestDurationBucket = TerminalMeter.createHistogram('terminal_request_duration_milliseconds', {
  description: 'terminal_request_duration_milliseconds Request Duration bucket in 1, 10, 100, 1000, 10000 ms',
  valueType: ValueType.INT,
  advice: {
    explicitBucketBoundaries: [1, 10, 100, 1000, 10000],
  },
});

const RequestReceivedTotal = TerminalMeter.createCounter('terminal_request_received_total', {
  description: 'terminal_request_received_total Request Received',
});

const RequestFinalizedTotal = TerminalMeter.createCounter('terminal_request_finalized_total', {
  description: 'terminal_request_finalized_total Request Finalized',
});

const RequestPendingTotal = TerminalMeter.createGauge('terminal_request_pending_total', {
  description: 'terminal_request_pending_total Request Pending',
});

const RequestProcessingTotal = TerminalMeter.createGauge('terminal_request_processing_total', {
  description: 'terminal_request_processing_total Request Processing',
});
