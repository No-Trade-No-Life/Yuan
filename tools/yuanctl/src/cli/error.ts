export type YuanctlErrorCategory = 'usage' | 'config' | 'network' | 'not_found' | 'unsafe' | 'internal';

export interface YuanctlCommandError {
  ok: false;
  error: {
    code: string;
    category: YuanctlErrorCategory;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export class YuanctlError extends Error {
  constructor(public readonly payload: YuanctlCommandError['error']) {
    super(payload.message);
    this.name = 'YuanctlError';
  }
}

export const createError = (
  code: string,
  category: YuanctlErrorCategory,
  message: string,
  details?: Record<string, unknown>,
): YuanctlError =>
  new YuanctlError({
    code,
    category,
    message,
    retryable: category === 'network',
    details,
  });

export const toErrorResult = (error: unknown): YuanctlCommandError => {
  if (error instanceof YuanctlError) {
    return { ok: false, error: error.payload };
  }
  return {
    ok: false,
    error: {
      code: 'E_INTERNAL',
      category: 'internal',
      message: 'Internal error',
      retryable: false,
    },
  };
};

export const exitCodeForError = (error: YuanctlCommandError): number => {
  switch (error.error.category) {
    case 'usage':
      return 2;
    case 'config':
      return 3;
    case 'network':
      return 4;
    case 'not_found':
      return 5;
    case 'unsafe':
      return 6;
    case 'internal':
    default:
      return 1;
  }
};
