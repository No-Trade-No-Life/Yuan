import { UUID } from '@yuants/data-model';
import { nativeSubjectToSubject, observableToAsyncIterable } from '@yuants/utils';
import Ajv from 'ajv';
import {
  defer,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  Observable,
  share,
  takeUntil,
  takeWhile,
  tap,
  timeout,
} from 'rxjs';
import { IServiceCandidateClientSide } from './model';
import { IService, ITerminalMessage } from './services';
import { Terminal } from './terminal';

export class TerminalClient {
  constructor(public readonly terminal: Terminal) {
    this._setupTerminalIdAndMethodValidatorSubscription();
  }

  private _terminalOutput$ = nativeSubjectToSubject(this.terminal.output$);

  /**
   * Resolve candidate target_terminal_ids for a request
   */
  resolveTargetTerminalIds = async (method: string, req: ITerminalMessage['req']): Promise<string[]> => {
    await firstValueFrom(from(this.terminal.terminalInfos$));
    const candidates = this._mapMethodToServiceIdToCandidateClientSide.get(method);
    if (!candidates) return [];
    const result: string[] = [];
    for (const candidate of candidates.values()) {
      if (candidate.validator(req)) {
        result.push(candidate.terminal_id);
      }
    }
    return result;
  };

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
          const nextMap: typeof this._mapMethodToServiceIdToCandidateClientSide = new Map();
          for (const terminalInfo of terminalInfos) {
            for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
              if (!nextMap.get(serviceInfo.method)) {
                nextMap.set(serviceInfo.method, new Map());
              }
              // if previous candidate exists, keep it
              // or create a new one
              const candidate = this._mapMethodToServiceIdToCandidateClientSide
                .get(serviceInfo.method)
                ?.get(serviceInfo.service_id || serviceInfo.method) ?? {
                service_id: serviceInfo.service_id || serviceInfo.method,
                serviceInfo,
                terminal_id: terminalInfo.terminal_id,
                // ISSUE: Ajv is very slow and cause a lot CPU utilization, so we must cache the compiled validator
                validator: new Ajv({ strict: false }).compile(serviceInfo.schema),
              };
              nextMap.get(serviceInfo.method)!.set(serviceInfo.service_id || serviceInfo.method, candidate);
            }
          }
          this._mapMethodToServiceIdToCandidateClientSide = nextMap;
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
  ): AsyncIterable<Partial<IService[T]> & ITerminalMessage>;

  requestService(method: string, req: ITerminalMessage['req']): AsyncIterable<ITerminalMessage>;

  requestService(method: string, req: ITerminalMessage['req']): AsyncIterable<ITerminalMessage> {
    return observableToAsyncIterable(
      defer(() => this.resolveTargetTerminalIds(method, req)).pipe(
        map((arr) => {
          if (arr.length === 0) {
            throw Error(`No terminal available for request: method=${method} req=${JSON.stringify(req)}`);
          }
          const target = arr[~~(Math.random() * arr.length)]; // Simple Random Load Balancer
          return target;
        }),
        mergeMap((target_terminal_id) => this.request(method, target_terminal_id, req)),
      ),
    );
  }

  /**
   * Make a request to specified terminal's service
   */
  request<T extends string>(
    method: T,
    target_terminal_id: string,
    req: T extends keyof IService ? IService[T]['req'] : ITerminalMessage['req'],
  ): AsyncIterable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> {
    const trace_id = UUID();
    const msg = {
      trace_id,
      method,
      target_terminal_id,
      source_terminal_id: this.terminal.terminal_id,
      req,
    };
    return observableToAsyncIterable(
      defer((): Observable<any> => {
        this._terminalOutput$.next(msg);
        return from(this.terminal.input$).pipe(
          filter((m) => m.trace_id === msg.trace_id),
          // complete immediately when res is received
          takeWhile((msg1) => msg1.res === undefined, true),
          timeout({
            first: 30000,
            each: 10000,
            meta: `request Timeout: method=${msg.method} target=${msg.target_terminal_id}`,
          }),
          share(),
        );
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
  requestForResponse<T extends keyof IService>(
    method: T,
    req: IService[T]['req'],
  ): Promise<Exclude<(Partial<IService[T]> & ITerminalMessage)['res'], undefined>>;

  requestForResponse(
    method: string,
    req: ITerminalMessage['req'],
  ): Promise<Exclude<ITerminalMessage['res'], undefined>>;

  requestForResponse(
    method: string,
    req: ITerminalMessage['req'],
  ): Promise<Exclude<ITerminalMessage['res'], undefined>> {
    return firstValueFrom(
      from(this.requestService(method as any, req as any)).pipe(
        map((msg) => msg.res),
        filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
      ),
    ) as any;
  }
}
