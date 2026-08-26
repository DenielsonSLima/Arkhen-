export class OperationTimeoutError extends Error {
  readonly code = 'OPERATION_TIMEOUT';

  constructor(message: string) {
    super(message);
    this.name = 'OperationTimeoutError';
  }
}

export const isOperationTimeoutError = (error: unknown): error is OperationTimeoutError => (
  error instanceof OperationTimeoutError
  || (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'OPERATION_TIMEOUT'
  )
);

export const withOperationTimeout = <T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> => new Promise<T>((resolve, reject) => {
  let settled = false;
  const timeoutId = globalThis.setTimeout(() => {
    if (settled) return;
    settled = true;
    onTimeout?.();
    reject(new OperationTimeoutError(message));
  }, timeoutMs);

  Promise.resolve(operation).then(
    (value) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeoutId);
      resolve(value);
    },
    (error) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeoutId);
      reject(error);
    },
  );
});
