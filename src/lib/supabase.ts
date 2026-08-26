import { createClient } from '@supabase/supabase-js';

const defaultSupabaseUrl = 'https://dgklhykjwzmeqxejlicz.supabase.co';
const defaultSupabasePublishableKey = 'sb_publishable_WI3KnXA-nJf2RnHq_1AKXA_EhwQuDOi';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || defaultSupabaseUrl;
export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || defaultSupabasePublishableKey;
const PASSWORD_RECOVERY_PATH = '/redefinir-senha';
const isPasswordRecoveryPath = (pathname: string) => (
  pathname.replace(/\/+$/, '') === PASSWORD_RECOVERY_PATH
);
const AUTH_URL_KEYS = [
  'access_token',
  'refresh_token',
  'expires_at',
  'expires_in',
  'token_type',
  'type',
  'error',
  'error_code',
  'error_description',
  'code',
];

export type InitialPasswordRecoveryTokens = Readonly<{
  accessToken: string;
  refreshToken: string;
}>;

const retainAuthControlParams = (rawValue: string, prefix: string) => {
  const source = new URLSearchParams(rawValue.replace(/^[?#]/, ''));
  const retained = new URLSearchParams();
  ['type', 'error', 'error_code', 'error_description'].forEach((key) => {
    const value = source.get(key);
    if (value) retained.set(key, value);
  });
  if (source.has('code')) retained.set('code', 'present');
  const result = retained.toString();
  return result ? `${prefix}${result}` : '';
};

const stripAuthParams = (rawValue: string, prefix: string) => {
  const source = new URLSearchParams(rawValue.replace(/^[?#]/, ''));
  let changed = false;
  AUTH_URL_KEYS.forEach((key) => {
    if (!source.has(key)) return;
    source.delete(key);
    changed = true;
  });
  if (!changed) return rawValue;
  const result = source.toString();
  return result ? `${prefix}${result}` : '';
};

const initialBrowserLocation = typeof window === 'undefined' ? null : {
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
};
const initialSearchParams = new URLSearchParams(initialBrowserLocation?.search || '');
const initialHashParams = new URLSearchParams((initialBrowserLocation?.hash || '').replace(/^#/, ''));
const initialAuthType = initialHashParams.get('type') || initialSearchParams.get('type');
const isPasswordSetupType = initialAuthType === 'recovery' || initialAuthType === 'invite';
const isPasswordRecoveryLoad = Boolean(
  initialBrowserLocation
  && (isPasswordRecoveryPath(initialBrowserLocation.pathname) || isPasswordSetupType),
);
const hasInitialAuthError = Boolean(
  initialHashParams.get('error')
  || initialHashParams.get('error_code')
  || initialHashParams.get('error_description')
  || initialSearchParams.get('error')
  || initialSearchParams.get('error_code')
  || initialSearchParams.get('error_description'),
);
const initialAccessToken = initialHashParams.get('access_token');
const initialRefreshToken = initialHashParams.get('refresh_token');
let initialPasswordRecoveryTokens: InitialPasswordRecoveryTokens | null = (
  isPasswordSetupType
  && !hasInitialAuthError
  && initialAccessToken
  && initialRefreshToken
) ? {
    accessToken: initialAccessToken,
    refreshToken: initialRefreshToken,
  } : null;

const initialAuthLocation = initialBrowserLocation ? {
  pathname: initialBrowserLocation.pathname,
  search: retainAuthControlParams(initialBrowserLocation.search, '?'),
  hash: retainAuthControlParams(initialBrowserLocation.hash, '#'),
} : null;

if (initialBrowserLocation && isPasswordRecoveryLoad) {
  const sanitizedSearch = stripAuthParams(initialBrowserLocation.search, '?');
  const sanitizedHash = stripAuthParams(initialBrowserLocation.hash, '#');
  try {
    window.history.replaceState(
      window.history.state,
      '',
      `${initialBrowserLocation.pathname}${sanitizedSearch}${sanitizedHash}`,
    );
  } catch {
    // A captura em memória continua válida mesmo quando o histórico não está disponível.
  }
}

export const getInitialAuthLocation = () => initialAuthLocation;

export const takeInitialPasswordRecoveryTokens = () => {
  const tokens = initialPasswordRecoveryTokens;
  initialPasswordRecoveryTokens = null;
  return tokens;
};

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL nao foi configurada.');
}

if (!supabasePublishableKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY nao foi configurada.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !isPasswordRecoveryLoad,
    flowType: 'implicit',
  },
});

export const supabaseProjectUrl = supabaseUrl;

export const createIsolatedPasswordRecoveryClient = () => createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'implicit',
      storageKey: `contabil-password-recovery-${crypto.randomUUID()}`,
    },
  },
);
