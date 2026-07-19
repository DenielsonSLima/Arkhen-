let fallbackSequence = 0;

export const createRuntimeId = (scope: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${++fallbackSequence}`;

  return `${scope}-${suffix}`;
};

export const createRealtimeChannelName = createRuntimeId;
