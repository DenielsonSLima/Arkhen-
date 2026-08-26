const NON_RETRYABLE_STATUS = new Set([401, 403]);
const NON_RETRYABLE_CODES = new Set(['401', '403', '42501', 'PGRST003']);

type QueryErrorShape = {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  cause?: unknown;
};

const asQueryError = (error: unknown): QueryErrorShape | null => (
  error !== null && typeof error === 'object' ? error as QueryErrorShape : null
);

export const isNonRetryableQueryError = (error: unknown): boolean => {
  const candidate = asQueryError(error);
  if (!candidate) return false;

  const code = String(candidate.code || '').toUpperCase();
  const status = Number(candidate.status ?? candidate.statusCode);
  if (NON_RETRYABLE_CODES.has(code) || NON_RETRYABLE_STATUS.has(status)) return true;

  return candidate.cause ? isNonRetryableQueryError(candidate.cause) : false;
};

export const shouldRetryQuery = (failureCount: number, error: unknown) => (
  failureCount < 1 && !isNonRetryableQueryError(error)
);
