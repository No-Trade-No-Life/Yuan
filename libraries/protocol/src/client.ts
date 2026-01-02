import { formatTime, newError, UUID } from '@yuants/utils';
import {
  defer,
  filter,
  firstValueFrom,
  from,
  identity,
  map,
  mergeMap,
  Observable,
  ReplaySubject,
  Subject,
  takeUntil,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { IResponse, IServiceCandidateClientSide, ITerminalMessage } from './model';
import { createValidator } from './schema';
import { Terminal } from './terminal';

/**
 * Terminal Client Module
 *
 * @public
 */
export class TerminalClient {
  constructor(public readonly terminal: Terminal) {
    this._setupTerminalIdAndMethodValidatorSubscription();

    from(this.terminal.input$)
      .pipe(
        //
        tap((msg) => {
          const subject$ = this._mapTraceIdToTerminalMessage$.get(msg.trace_id);
          if (subject$) {
            subject$.next(msg);
            if (msg.done || msg.res !== undefined) {
              subject$.complete();
              this._mapTraceIdToTerminalMessage$.delete(msg.trace_id);
            }
          }
        }),
        takeUntil(this.terminal.dispose$),
      )
      .subscribe();
  }

  /**
   * 等待目标服务列表就绪
   */
  servicesReady = async (): Promise<void> => {
    await firstValueFrom(this._generateCandidates$);
  };

  /**
   * Resolve candidate target_terminal_ids for a request
   */
  resolveTargetTerminalIds = async (method: string, req: ITerminalMessage['req']): Promise<string[]> => {
    await this.servicesReady();
    const candidates = this._mapMethodToServiceIdToCandidateClientSide.get(method);
    if (!candidates) return [];
    const result: string[] = [];
    for (const candidate of candidates.values()) {
      // ISSUE: Ajv is very slow and cause a lot CPU utilization, so we must cache the compiled validator
      candidate.validator ??= createValidator(candidate.serviceInfo.schema);
      if (candidate.validator(req)) {
        result.push(candidate.terminal_id);
      }
    }
    return result;
  };

  /**
   * Resolve candidate target services for a request
   */
  resolveTargetServices = async (
    method: string,
    req: ITerminalMessage['req'],
  ): Promise<{ terminal_id: string; service_id: string }[]> => {
    await this.servicesReady();
    return this.resolveTargetServicesSync(method, req);
  };

  /**
   * Resolve candidate target services by method and req body
   */
  resolveTargetServicesSync = (method: string, req: ITerminalMessage['req']) => {
    const candidates = this._mapMethodToServiceIdToCandidateClientSide.get(method);
    if (!candidates) return [];
    const result: { terminal_id: string; service_id: string }[] = [];
    for (const candidate of candidates.values()) {
      // ISSUE: Ajv is very slow and cause a lot CPU utilization, so we must cache the compiled validator
      candidate.validator ??= createValidator(candidate.serviceInfo.schema);
      if (candidate.validator(req)) {
        result.push({ terminal_id: candidate.terminal_id, service_id: candidate.service_id });
      }
    }
    return result;
  };

  /**
   * Resolve a single target service by method and req body (load balanced)
   */
  resolveTargetServiceByMethodSync = (method: string, req: ITerminalMessage['req']) => {
    const services = this.resolveTargetServicesSync(method, req);
    if (services.length === 0) {
      throw newError(`NO_TERMINAL_AVAILABLE_FOR_REQUEST`, { method, req });
    }
    if (services.length === 1) return services[0];
    // 使用简单的随机负载均衡选择
    const target = services[~~(Math.random() * services.length)];
    return target;
  };

  resolveTargetServiceByMethodAndTargetTerminalIdSync = (
    method: string,
    target_terminal_id: string,
    req: ITerminalMessage['req'],
  ) => {
    const services = this.resolveTargetServicesSync(method, req);
    for (const service of services) {
      if (service.terminal_id === target_terminal_id) {
        return service;
      }
    }
    throw newError(`NO_TERMINAL_AVAILABLE_FOR_REQUEST`, { method, target_terminal_id, req });
  };

  private _generateCandidates$ = new ReplaySubject<void>(1);

  /**
   * Service Index (optimized for method resolution)
   */
  private _mapMethodToServiceIdToCandidateClientSide = new Map<
    string,
    Map<string, IServiceCandidateClientSide>
  >();

  private _mapServiceIdToService = new Map<string, IServiceCandidateClientSide>();

  private _setupTerminalIdAndMethodValidatorSubscription() {
    // CREATE CANDIDATE INDEX
    from(this.terminal.terminalInfos$)
      .pipe(
        tap((terminalInfos) => {
          if (this.terminal.options.verbose) {
            console.info(formatTime(Date.now()), 'Client', 'GenerateCandidates', 'Start');
          }
          const t1 = Date.now();
          let init_cnt = 0;
          const nextMap: typeof this._mapMethodToServiceIdToCandidateClientSide = new Map();
          for (const terminalInfo of terminalInfos) {
            for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
              if (!nextMap.get(serviceInfo.method)) {
                nextMap.set(serviceInfo.method, new Map());
              }
              const serviceId = serviceInfo.service_id;
              // if previous candidate exists, keep it
              // or create a new one
              let candidate = this._mapMethodToServiceIdToCandidateClientSide
                .get(serviceInfo.method)
                ?.get(serviceId);
              if (!candidate) {
                init_cnt++;
                candidate = {
                  service_id: serviceId,
                  serviceInfo,
                  terminal_id: terminalInfo.terminal_id,
                  validator: undefined, // Lazy init later
                };
                this._mapServiceIdToService.set(serviceId, candidate);
              }
              nextMap.get(serviceInfo.method)!.set(serviceId, candidate);
            }
          }
          this._mapMethodToServiceIdToCandidateClientSide = nextMap;
          if (this.terminal.options.verbose) {
            console.info(
              formatTime(Date.now()),
              'Client',
              'GenerateCandidates',
              'Done',
              `New Schemas: ${init_cnt}`,
              `Duration: ${Date.now() - t1} ms`,
            );
          }
          this._generateCandidates$.next();
        }),
      )
      .pipe(takeUntil(this.terminal.dispose$))
      .subscribe();
  }

  /**
   * Make a request to a service
   *
   * - [x] SINGLE-IN-SINGLE-OUT
   * - [x] SINGLE-IN-STREAM-OUT
   * - [ ] STREAM-IN-SINGLE-OUT
   * - [ ] STREAM-IN-STREAM-OUT
   */

  requestService<TReq = {}, TRes = void, TFrame = void>(
    serviceIdOrMethod: string,
    req: TReq,
  ): Observable<ITerminalMessage & { res?: IResponse<TRes>; frame?: TFrame }> {
    return defer(() => this.servicesReady()).pipe(
      mergeMap(() => {
        const serviceId =
          this._mapServiceIdToService.get(serviceIdOrMethod)?.service_id ||
          this.resolveTargetServiceByMethodSync(serviceIdOrMethod, req).service_id;
        return this.requestByServiceId<TReq, TRes, TFrame>(serviceId, req);
      }),
    );
  }

  private _mapTraceIdToTerminalMessage$ = new Map<string, Subject<ITerminalMessage>>();

  /**
   * 通过初始请求消息发送请求。
   *
   * 跳过客户端路由逻辑，需要手动指定 msg 的各个字段 (method, service_id, target_terminal_id, req)
   */
  requestByMessage<TReq, TRes = void, TFrame = void>(
    _msg: Omit<ITerminalMessage & { req: TReq }, 'trace_id' | 'source_terminal_id' | 'seq_id'>,
  ): Observable<ITerminalMessage & { res?: IResponse<TRes>; frame?: TFrame }> {
    const msg: ITerminalMessage & { req: TReq } = {
      ..._msg,
      seq_id: 0,
      trace_id: UUID(),
      source_terminal_id: this.terminal.terminal_id,
    };
    const response$ = new Subject<ITerminalMessage>();
    // Open a new stream for this request
    this._mapTraceIdToTerminalMessage$.set(msg.trace_id, response$);
    return defer((): Observable<any> => {
      if (this.terminal.options.verbose) {
        console.info(
          formatTime(Date.now()),
          'Client',
          'RequestInitiated',
          `trace_id=${msg.trace_id}, service_id=${msg.service_id}, method=${msg.method}, target=${msg.target_terminal_id}`,
        );
      }
      let ack_seq_id = -1;
      this.terminal.output$.next(msg);
      return response$.pipe(
        timeout({
          each: 60_000, // maybe configurable in the future
          meta: `Client Read Timeout: trace_id="${msg.trace_id}" method=${msg.method} target=${msg.target_terminal_id}`,
        }),
        // auto abort request (throwError) when disconnected
        takeUntil(
          this.terminal.isConnected$.pipe(
            filter((x) => !x),
            mergeMap(() => throwError(() => new Error('Client Connection Disconnected'))),
          ),
        ),
        // TODO: Auto Abort request (throwError) when target terminal or service is not available

        // auto abort request (throwError) when terminal is disposed
        takeUntil(this.terminal.dispose$),
        tap({
          next: (msg) => {
            // TODO: Check the order of seq_id to ensure the correctness of the protocol
            ack_seq_id = msg.seq_id;
          },
          unsubscribe: () => {
            if (this.terminal.options.verbose) {
              console.info(formatTime(Date.now()), 'Client', 'RequestAborted', msg.trace_id);
            }
            this.terminal.output$.next({
              trace_id: msg.trace_id,
              seq_id: ++ack_seq_id,
              method: msg.method,
              target_terminal_id: msg.target_terminal_id,
              source_terminal_id: msg.source_terminal_id,
              done: true,
            });
          },
          finalize: () => {
            response$.complete();
            this._mapTraceIdToTerminalMessage$.delete(msg.trace_id);
          },
        }),
      );
    });
  }

  /**
   * Make a request to specific serviceId
   */
  requestByServiceId<TReq, TRes = void, TFrame = void>(
    service_id: string,
    req: TReq,
  ): Observable<ITerminalMessage & { res?: IResponse<TRes>; frame?: TFrame }> {
    return defer(() => this.servicesReady()).pipe(
      mergeMap(() => {
        const serviceInfo = this._mapServiceIdToService.get(service_id);
        if (!serviceInfo) throw newError('SERVICE_NOT_FOUND', { service_id });
        const method = serviceInfo.serviceInfo.method;
        const target_terminal_id = serviceInfo.terminal_id;

        return this.requestByMessage<TReq, TRes, TFrame>({
          method,
          target_terminal_id,
          service_id,
          req,
        });
      }),
    );
  }

  /**
   * Make a request to specified terminal's service
   * @deprecated - use requestByServiceId instead if you want to specify target service, use requestByMessage if you want to skip client router
   */
  request<TReq, TRes = void, TFrame = void>(
    method: string,
    target_terminal_id: string,
    req: TReq,
  ): Observable<ITerminalMessage & { res?: IResponse<TRes>; frame?: TFrame }> {
    return defer(() => this.servicesReady()).pipe(
      mergeMap(() => {
        const service = this.resolveTargetServiceByMethodAndTargetTerminalIdSync(
          method,
          target_terminal_id,
          req,
        );
        return this.requestByServiceId<TReq, TRes, TFrame>(service.service_id, req);
      }),
    );
  }

  /**
   * Make a request to get the response
   *
   * Use it only when using SINGLE-IN-SINGLE-OUT pattern.
   *
   * It's simpler to call this method when using this pattern.
   *
   * - [x] SINGLE-IN-SINGLE-OUT
   * - [ ] SINGLE-IN-STREAM-OUT
   * - [ ] STREAM-IN-SINGLE-OUT
   * - [ ] STREAM-IN-STREAM-OUT
   */
  requestForResponse<TReq = {}, TRes = void>(
    serviceIdOrMethod: string,
    req: TReq,
    ctx?: { abort$?: AsyncIterable<void> },
  ): Promise<IResponse<TRes>> {
    return firstValueFrom(
      from(this.requestService(serviceIdOrMethod as any, req as any)).pipe(
        map((msg) => msg.res),
        filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
        ctx?.abort$ ? takeUntil(ctx?.abort$) : identity,
      ),
      {
        defaultValue: {
          code: 'NO_RESPONSE',
          message: 'No Response Received',
        } as IResponse<TRes>,
      },
    ) as any;
  }

  /**
   * Make a request to get the response data
   *
   * if data is undefined, it will throw the response message
   */
  async requestForResponseData<TReq, TData>(
    serviceIdOrMethod: string,
    req: TReq,
    ctx?: { abort$?: AsyncIterable<void> },
  ): Promise<TData> {
    const res = await this.requestForResponse(serviceIdOrMethod, req, ctx);
    if (res.data !== undefined) {
      return res.data as any;
    }
    throw res;
  }
}
