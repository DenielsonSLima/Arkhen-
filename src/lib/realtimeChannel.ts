import { supabase } from './supabase';

let fallbackSequence = 0;

export const createRuntimeId = (scope: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${++fallbackSequence}`;

  return `${scope}-${suffix}`;
};

export const createRealtimeChannelName = createRuntimeId;

/**
 * Creates and subscribes a Supabase Realtime channel safely.
 * Guarantees unique runtime channel names, removes cached topics if necessary,
 * and catches runtime errors to prevent unhandled React render crashes.
 */
export const subscribeRealtimeChannel = (
  scope: string,
  configure: (channel: any) => any,
  onStatusChange?: (status: string, error?: Error) => void,
  customClient?: any
): any => {
  try {
    const client = customClient || supabase;
    const channelName = createRealtimeChannelName(scope);
    const channels = client?.realtime?.channels;
    if (Array.isArray(channels)) {
      const existing = channels.find((c: any) => c.topic === `realtime:${channelName}`);
      if (existing && typeof client.removeChannel === 'function') {
        void client.removeChannel(existing);
      }
    }
    const channel = client.channel(channelName);
    const configured = configure(channel);
    if (configured && typeof configured.subscribe === 'function') {
      configured.subscribe((status: string, err?: Error) => {
        onStatusChange?.(status, err);
      });
    }
    return configured;
  } catch (error) {
    console.error(`[Realtime] Exception subscribing to channel '${scope}':`, error);
    return null;
  }
};

