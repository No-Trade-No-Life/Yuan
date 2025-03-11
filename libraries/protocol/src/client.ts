import { formatTime, UUID } from '@yuants/data-model';
import { nativeSubjectToSubject } from '@yuants/utils';
import Ajv from 'ajv';
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
  timeout,
} from 'rxjs';
import { IServiceCandidateClientSide } from './model';
import { IService, ITerminalMessage } from './services';
import { Terminal } from './terminal';

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

  private _terminalOutput$ = nativeSubjectToSubject(this.terminal.output$);

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
      candidate.validator ??= new Ajv({ strict: false, strictSchema: false }).compile(
        candidate.serviceInfo.schema,
      );
      if (candidate.validator(req)) {
        result.push(candidate.terminal_id);
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
          console.info(formatTime(Date.now()), 'Client', 'GenerateCandidates', 'Start');
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
          console.info(
            formatTime(Date.now()),
            'Client',
            'GenerateCandidates',
            'Done',
            `New Schemas: ${init_cnt}`,
            `Duration: ${Date.now() - t1} ms`,
          );
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
  requestService<T extends keyof IService>(
    method: T,
    req: IService[T]['req'],
  ): Observable<Partial<IService[T]> & ITerminalMessage>;

  requestService(method: string, req: ITerminalMessage['req']): Observable<ITerminalMessage>;

  requestService(method: string, req: ITerminalMessage['req']): Observable<ITerminalMessage> {
    return defer(() => this.resolveTargetTerminalIds(method, req)).pipe(
      map((arr) => {
        if (arr.length === 0) {
          throw Error(`No terminal available for request: method=${method} req=${JSON.stringify(req)}`);
        }
        const target = arr[~~(Math.random() * arr.length)]; // Simple Random Load Balancer
        return target;
      }),
      mergeMap((target_terminal_id) => this.request(method, target_terminal_id, req)),
    );
  }

  private _mapTraceIdToTerminalMessage$ = new Map<string, Subject<ITerminalMessage>>();

  /**
   * Make a request to specified terminal's service
   */
  request<T extends string>(
    method: T,
    target_terminal_id: string,
    req: T extends keyof IService ? IService[T]['req'] : ITerminalMessage['req'],
  ): Observable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> {
    const trace_id = UUID();
    const msg = {
      trace_id,
      method,
      target_terminal_id,
      source_terminal_id: this.terminal.terminal_id,
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
      this._terminalOutput$.next(msg);
      return response$.pipe(
        timeout({
          each: 60_000, // maybe configurable in the future
          meta: `Client Read Timeout: trace_id="${trace_id}" method=${msg.method} target=${msg.target_terminal_id}`,
        }),
        takeUntil(this.terminal.dispose$),
        tap({
          unsubscribe: () => {
            if (this.terminal.options.verbose) {
              console.info(formatTime(Date.now()), 'Client', 'RequestAborted', msg.trace_id);
            }
            this._terminalOutput$.next({
              trace_id,
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
  requestForResponse<T extends keyof IService>(
    method: T,
    req: IService[T]['req'],
    ctx?: { abort$?: AsyncIterable<void> },
  ): Promise<Exclude<(Partial<IService[T]> & ITerminalMessage)['res'], undefined>>;

  requestForResponse(
    method: string,
    req: ITerminalMessage['req'],
    ctx?: { abort$?: AsyncIterable<void> },
  ): Promise<Exclude<ITerminalMessage['res'], undefined>>;

  requestForResponse(
    method: string,
    req: ITerminalMessage['req'],
    ctx?: { abort$?: AsyncIterable<void> },
  ): Promise<Exclude<ITerminalMessage['res'], undefined>> {
    return firstValueFrom(
      from(this.requestService(method as any, req as any)).pipe(
        map((msg) => msg.res),
        filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
        ctx?.abort$ ? takeUntil(ctx?.abort$) : identity,
      ),
    ) as any;
  }
}
