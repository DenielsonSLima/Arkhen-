interface RpcErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

export const isMissingRpcFunctionError = (error: RpcErrorLike | null | undefined) => {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  const description = `${error.message || ''} ${error.details || ''}`;
  return /could not find the function|function .* does not exist/i.test(description);
};

export const activityWriteError = (action: string, error: RpcErrorLike) => (
  new Error(`${action}: ${error.message || 'erro desconhecido'}`)
);
