import { formatTime, UUID } from '@yuants/utils';
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
   * Resolve candidate target_terminal_ids for a request
   */
  resolveTargetTerminalIds = async (method: string, req: ITerminalMessage['req']): Promise<string[]> => {
    await firstValueFrom(this._generateCandidates$);
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
    await firstValueFrom(this._generateCandidates$);
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

  private _generateCandidates$ = new ReplaySubject<void>(1);

  /**
   * Service Index (optimized for method resolution)
   */
  private _mapMethodToServiceIdToCandidateClientSide = new Map<
    string,
    Map<string, IServiceCandidateClientSide>
  >();

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
    method: string,
    req: TReq,
  ): Observable<ITerminalMessage & { res?: IResponse<TRes>; frame?: TFrame }> {
    return defer(() => this.resolveTargetServices(method, req)).pipe(
      map((arr) => {
        if (arr.length === 0) {
          throw Error(`No terminal available for request: method=${method} req=${JSON.stringify(req)}`);
        }
        const target = arr[~~(Math.random() * arr.length)]; // Simple Random Load Balancer
        return target;
      }),
      mergeMap((target) =>
        this.request<TReq, TRes, TFrame>(method, target.terminal_id, req, target.service_id),
      ),
    );
  }

  private _mapTraceIdToTerminalMessage$ = new Map<string, Subject<ITerminalMessage>>();

  /**
   * Make a request to specified terminal's service
   */
  request<TReq, TRes = void, TFrame = void>(
    method: string,
    target_terminal_id: string,
    req: TReq,
    service_id?: string,
  ): Observable<ITerminalMessage & { res?: IResponse<TRes>; frame?: TFrame }> {
    const trace_id = UUID();
    const msg = {
      trace_id,
      seq_id: 0,
      method,
      target_terminal_id,
      source_terminal_id: this.terminal.terminal_id,
      service_id,
      req,
    };
    const response$ = new Subject<ITerminalMessage>();
    // Open a new stream for this request
    this._mapTraceIdToTerminalMessage$.set(trace_id, response$);
    return defer((): Observable<any> => {
      if (this.terminal.options.verbose) {
        console.info(
          formatTime(Date.now()),
          'Client',
          'RequestInitiated',
          trace_id,
          method,
          target_terminal_id,
        );
      }
      let ack_seq_id = -1;
      this.terminal.output$.next(msg);
      return response$.pipe(
        timeout({
          each: 60_000, // maybe configurable in the future
          meta: `Client Read Timeout: trace_id="${trace_id}" method=${msg.method} target=${msg.target_terminal_id}`,
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
              trace_id,
              seq_id: ++ack_seq_id,
              method,
              target_terminal_id,
              source_terminal_id: this.terminal.terminal_id,
              done: true,
            });
          },
          finalize: () => {
            response$.complete();
            this._mapTraceIdToTerminalMessage$.delete(trace_id);
          },
        }),
      );
    });
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
    method: string,
    req: TReq,
    ctx?: { abort$?: AsyncIterable<void> },
  ): Promise<IResponse<TRes>> {
    return firstValueFrom(
      from(this.requestService(method as any, req as any)).pipe(
        map((msg) => msg.res),
        filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
        ctx?.abort$ ? takeUntil(ctx?.abort$) : identity,
      ),
    ) as any;
  }

  /**
   * Make a request to get the response data
   *
   * if data is undefined, it will throw the response message
   */
  async requestForResponseData<TReq, TData>(
    method: string,
    req: TReq,
    ctx?: { abort$?: AsyncIterable<void> },
  ): Promise<TData> {
    const res = await this.requestForResponse(method, req, ctx);
    if (res.data !== undefined) {
      return res.data as any;
    }
    throw res;
  }
}
