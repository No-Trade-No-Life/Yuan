import { Terminal } from '@yuants/protocol';
import { RuntimeManager } from '../runtime/runtime-manager';
import {
  SignalTraderOperatorAuditContext,
  SignalTraderServiceHandlers,
  SignalTraderServicePolicy,
  SignalTraderWriteResponse,
} from '../types';

const toResponse = (data: unknown) => ({ res: { code: 0, message: 'OK', data } });

const toErrorResponse = (error: unknown, fallbackCode = 500) => ({
  res: {
    code: fallbackCode,
    message: typeof error === 'string' ? error : 'INTERNAL_ERROR',
  },
});

const toWriteServiceResponse = (result: SignalTraderWriteResponse) => ({
  res: {
    code: result.accepted ? 0 : 409,
    message: result.accepted ? 'OK' : result.reason ?? 'REJECTED',
    data: result,
  },
});

const authorize = async (
  policy: SignalTraderServicePolicy | undefined,
  serviceName: string,
  request: unknown,
) => {
  if (!policy?.authorize) return true;
  return policy.authorize({ serviceName, request });
};

const authorizeRead = async (
  policy: SignalTraderServicePolicy | undefined,
  serviceName: string,
  request: unknown,
) => {
  if (policy?.allowAnonymousRead) return true;
  if (!policy?.authorizeRead) return false;
  return policy.authorizeRead({ serviceName, request });
};

const authorizeOperator = async (
  policy: SignalTraderServicePolicy | undefined,
  serviceName: string,
  request: unknown,
): Promise<SignalTraderOperatorAuditContext | undefined> => {
  const allowed = await authorize(policy, serviceName, request);
  if (!allowed) return undefined;
  return policy?.resolveOperatorAuditContext?.({ serviceName, request });
};

const attachOperatorAuditContext = <T extends { operator?: string }>(
  request: T,
  auditContext: SignalTraderOperatorAuditContext,
): T & {
  operator: string;
  audit_context: SignalTraderOperatorAuditContext;
} => ({
  ...request,
  operator: auditContext.principal,
  audit_context: {
    ...auditContext,
    requested_operator: request.operator,
  },
});

export const createSignalTraderServiceHandlers = (
  runtimeManager: RuntimeManager,
): SignalTraderServiceHandlers => ({
  upsertRuntimeConfig: (req) => runtimeManager.upsertRuntimeConfig(req),
  listRuntimeConfig: () => runtimeManager.listRuntimeConfig(),
  listLiveCapabilities: () => runtimeManager.listLiveCapabilities(),
  getPaperClock: () => runtimeManager.getPaperClock(),
  getMockAccountInfo: (req) => runtimeManager.getMockAccountInfo(req.runtime_id),
  submitSignal: (req) => runtimeManager.submitSignal(req.runtime_id, req.command),
  queryProjection: (req) => runtimeManager.queryProjection(req),
  queryEventStream: (req) => runtimeManager.queryEventStream(req),
  queryRuntimeAuditLog: (req) => runtimeManager.queryRuntimeAuditLog(req),
  replayRuntime: (req) => runtimeManager.replayRuntime(req.runtime_id),
  advancePaperClock: (req) => runtimeManager.advancePaperClock(req),
  setPaperClockOffset: (req) => runtimeManager.setPaperClockOffset(req),
  resetPaperClock: () => runtimeManager.resetPaperClock(),
  getRuntimeHealth: (req) => runtimeManager.getRuntimeHealth(req.runtime_id),
  disableRuntime: (req) => runtimeManager.disableRuntime(req.runtime_id),
  backfillOrderBinding: (req) => runtimeManager.backfillOrderBinding(req),
  unlockRuntime: (req) => runtimeManager.unlockRuntime(req),
});

export const registerSignalTraderServices = (
  terminal: Terminal,
  handlers: SignalTraderServiceHandlers,
  policy: SignalTraderServicePolicy = {},
) => {
  if ((policy.enableMutatingServices || policy.enableOperatorServices) && !policy.authorize) {
    throw new Error('MUTATING_OR_OPERATOR_SERVICES_REQUIRE_AUTHORIZE');
  }
  if (policy.enableOperatorServices && !policy.resolveOperatorAuditContext) {
    throw new Error('OPERATOR_SERVICES_REQUIRE_AUDIT_CONTEXT');
  }

  terminal.server.provideService('SignalTrader/ListRuntimeConfig', { type: 'object' }, async (msg) => {
    if (!(await authorizeRead(policy, 'SignalTrader/ListRuntimeConfig', msg.req)))
      return toErrorResponse('FORBIDDEN', 403);
    const data = await handlers.listRuntimeConfig();
    return toResponse(data);
  });
  terminal.server.provideService('SignalTrader/ListLiveCapabilities', { type: 'object' }, async (msg) => {
    if (!(await authorizeRead(policy, 'SignalTrader/ListLiveCapabilities', msg.req)))
      return toErrorResponse('FORBIDDEN', 403);
    return toResponse(await handlers.listLiveCapabilities());
  });
  if (policy.enablePaperClockServices) {
    terminal.server.provideService('SignalTrader/GetPaperClock', { type: 'object' }, async (msg) => {
      if (!(await authorizeRead(policy, 'SignalTrader/GetPaperClock', msg.req)))
        return toErrorResponse('FORBIDDEN', 403);
      try {
        return toResponse(await handlers.getPaperClock());
      } catch (error) {
        return toErrorResponse(error);
      }
    });
  }
  terminal.server.provideService('SignalTrader/GetMockAccountInfo', { type: 'object' }, async (msg) => {
    if (!(await authorizeRead(policy, 'SignalTrader/GetMockAccountInfo', msg.req))) {
      return toErrorResponse('FORBIDDEN', 403);
    }
    try {
      return toResponse(await handlers.getMockAccountInfo(msg.req as any));
    } catch (error) {
      return toErrorResponse(error);
    }
  });
  terminal.server.provideService('SignalTrader/QueryProjection', { type: 'object' }, async (msg) => {
    if (!(await authorizeRead(policy, 'SignalTrader/QueryProjection', msg.req)))
      return toErrorResponse('FORBIDDEN', 403);
    try {
      return toResponse(await handlers.queryProjection(msg.req as any));
    } catch (error) {
      return toErrorResponse(error);
    }
  });
  terminal.server.provideService('SignalTrader/QueryEventStream', { type: 'object' }, async (msg) => {
    if (!(await authorizeRead(policy, 'SignalTrader/QueryEventStream', msg.req)))
      return toErrorResponse('FORBIDDEN', 403);
    try {
      return toResponse(await handlers.queryEventStream(msg.req as any));
    } catch (error) {
      return toErrorResponse(error);
    }
  });
  terminal.server.provideService('SignalTrader/QueryRuntimeAuditLog', { type: 'object' }, async (msg) => {
    if (!(await authorizeRead(policy, 'SignalTrader/QueryRuntimeAuditLog', msg.req))) {
      return toErrorResponse('FORBIDDEN', 403);
    }
    try {
      return toResponse(await handlers.queryRuntimeAuditLog(msg.req as any));
    } catch (error) {
      return toErrorResponse(error);
    }
  });
  terminal.server.provideService('SignalTrader/GetRuntimeHealth', { type: 'object' }, async (msg) => {
    if (!(await authorizeRead(policy, 'SignalTrader/GetRuntimeHealth', msg.req)))
      return toErrorResponse('FORBIDDEN', 403);
    try {
      return toResponse(await handlers.getRuntimeHealth(msg.req as any));
    } catch (error) {
      return toErrorResponse(error);
    }
  });

  if (policy.enableMutatingServices) {
    terminal.server.provideService('SignalTrader/UpsertRuntimeConfig', { type: 'object' }, async (msg) => {
      if (!(await authorize(policy, 'SignalTrader/UpsertRuntimeConfig', msg.req)))
        return toErrorResponse('FORBIDDEN', 403);
      try {
        return toWriteServiceResponse(await handlers.upsertRuntimeConfig(msg.req as any));
      } catch (error) {
        return toErrorResponse(error);
      }
    });
    terminal.server.provideService('SignalTrader/SubmitSignal', { type: 'object' }, async (msg) => {
      if (!(await authorize(policy, 'SignalTrader/SubmitSignal', msg.req)))
        return toErrorResponse('FORBIDDEN', 403);
      try {
        return toWriteServiceResponse(await handlers.submitSignal(msg.req as any));
      } catch (error) {
        return toErrorResponse(error);
      }
    });
    terminal.server.provideService('SignalTrader/ReplayRuntime', { type: 'object' }, async (msg) => {
      if (!(await authorize(policy, 'SignalTrader/ReplayRuntime', msg.req)))
        return toErrorResponse('FORBIDDEN', 403);
      try {
        return toWriteServiceResponse(await handlers.replayRuntime(msg.req as any));
      } catch (error) {
        return toErrorResponse(error);
      }
    });
    if (policy.enablePaperClockServices) {
      terminal.server.provideService('SignalTrader/AdvancePaperClock', { type: 'object' }, async (msg) => {
        if (!(await authorize(policy, 'SignalTrader/AdvancePaperClock', msg.req)))
          return toErrorResponse('FORBIDDEN', 403);
        try {
          return toResponse(await handlers.advancePaperClock(msg.req as any));
        } catch (error) {
          return toErrorResponse(error);
        }
      });
      terminal.server.provideService('SignalTrader/SetPaperClockOffset', { type: 'object' }, async (msg) => {
        if (!(await authorize(policy, 'SignalTrader/SetPaperClockOffset', msg.req)))
          return toErrorResponse('FORBIDDEN', 403);
        try {
          return toResponse(await handlers.setPaperClockOffset(msg.req as any));
        } catch (error) {
          return toErrorResponse(error);
        }
      });
      terminal.server.provideService('SignalTrader/ResetPaperClock', { type: 'object' }, async (msg) => {
        if (!(await authorize(policy, 'SignalTrader/ResetPaperClock', msg.req)))
          return toErrorResponse('FORBIDDEN', 403);
        try {
          return toResponse(await handlers.resetPaperClock());
        } catch (error) {
          return toErrorResponse(error);
        }
      });
    }
    terminal.server.provideService('SignalTrader/DisableRuntime', { type: 'object' }, async (msg) => {
      if (!(await authorize(policy, 'SignalTrader/DisableRuntime', msg.req)))
        return toErrorResponse('FORBIDDEN', 403);
      try {
        return toWriteServiceResponse(await handlers.disableRuntime(msg.req as any));
      } catch (error) {
        return toErrorResponse(error);
      }
    });
  }

  if (policy.enableOperatorServices) {
    terminal.server.provideService('SignalTrader/BackfillOrderBinding', { type: 'object' }, async (msg) => {
      const auditContext = await authorizeOperator(policy, 'SignalTrader/BackfillOrderBinding', msg.req);
      if (!auditContext) return toErrorResponse('FORBIDDEN', 403);
      try {
        return toWriteServiceResponse(
          await handlers.backfillOrderBinding(attachOperatorAuditContext(msg.req as any, auditContext)),
        );
      } catch (error) {
        return toErrorResponse(error);
      }
    });
    terminal.server.provideService('SignalTrader/UnlockRuntime', { type: 'object' }, async (msg) => {
      const auditContext = await authorizeOperator(policy, 'SignalTrader/UnlockRuntime', msg.req);
      if (!auditContext) return toErrorResponse('FORBIDDEN', 403);
      try {
        return toWriteServiceResponse(
          await handlers.unlockRuntime(attachOperatorAuditContext(msg.req as any, auditContext)),
        );
      } catch (error) {
        return toErrorResponse(error);
      }
    });
  }
};
