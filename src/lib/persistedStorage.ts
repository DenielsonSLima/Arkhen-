import { supabase } from './supabase';

type CachedStorage = Map<string, string>;

const STORAGE_TABLE = 'preferencias_usuario_modulos';
const STORAGE_MODULE = 'app-local-storage';

const MIGRATION_LEGACY_KEYS = new Set([
  'gestor_user_profile',
  'contabil_auth',
  'contabil_internal_tabs_state',
  'contabil_calculator_position',
  'contabil_calculator_size',
  'contabil_calculator_last_model',
  'arkhen_sidebar_menu_order',
  'contabil_gestao_empresarial_companies',
  'contabil_atividade_period_tasks_v1',
  'contabil_atividade_period_notes_v1',
  'contabil_atividades_instancias',
  'contabil_financeiro_cobrancas',
  'contabil_parametrizacao_parametros_calculo',
  'contabil_calculator_prefs_',
  'analise-tributaria-',
  'arkhen_param_tipos-empresa',
  'arkhen_param_natureza-juridica',
  'contabil_plano_contratacao_empresa:',
  'contabil_config_xml_modelos',
]);

const hasPrefix = (key: string, prefixes: string[]) => prefixes.some((prefix) => key.startsWith(prefix));

interface StorageContext {
  empresa_id: string;
  user_id: string;
}

interface RawPreferenceRow {
  chave: string;
  valor: unknown;
  user_id: string;
  modulo: string;
}

type Listener = (key: string) => void;

const cache: CachedStorage = new Map();
const listeners = new Set<Listener>();
let initPromise: Promise<void> | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let currentContext: StorageContext | null = null;

const legacyPrefixes = [
  'contabil_calculator_prefs_',
  'analise-tributaria-',
  'contabil_plano_contratacao_empresa:',
];

const isKnownLegacyKey = (key: string) => (
  MIGRATION_LEGACY_KEYS.has(key)
  || hasPrefix(key, legacyPrefixes)
);

const normalizeValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const notify = (key: string) => {
  listeners.forEach((listener) => {
    try {
      listener(key);
    } catch {
      // ignore
    }
  });

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('persisted_storage_change', { detail: { key } }));
      if (key === 'gestor_user_profile') {
        window.dispatchEvent(new Event('profile_updated'));
      }
    } catch {
      // ignore
    }
  }
};

const hydrateFromLegacy = (keys: string[]) => {
  if (typeof window === 'undefined') return;

  for (const key of keys) {
    if (!isKnownLegacyKey(key)) continue;
    const value = window.localStorage.getItem(key);
    if (value === null) continue;
    if (!cache.has(key)) {
      cache.set(key, value);
    }
  }
};

const getBrowserLegacyKeys = (): string[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key) keys.push(key);
  }
  return keys.filter(isKnownLegacyKey);
};

const getContext = async (): Promise<StorageContext | null> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return null;

    const { data, error } = await supabase.rpc('current_empresa_id');
    if (error || !data) return null;

    return {
      empresa_id: String(data),
      user_id: userId,
    };
  } catch {
    return null;
  }
};

const persistToSupabase = async (key: string, value: string): Promise<void> => {
  const context = await getContext();
  if (!context) return;
  try {
    await supabase.from(STORAGE_TABLE).upsert(
      {
        empresa_id: context.empresa_id,
        user_id: context.user_id,
        modulo: STORAGE_MODULE,
        chave: key,
        valor: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'empresa_id,user_id,modulo,chave' },
    );
  } catch {
    // ignore
  }
};

const removeFromSupabase = async (key: string): Promise<void> => {
  const context = await getContext();
  if (!context) return;
  try {
    await supabase
      .from(STORAGE_TABLE)
      .delete()
      .eq('empresa_id', context.empresa_id)
      .eq('user_id', context.user_id)
      .eq('modulo', STORAGE_MODULE)
      .eq('chave', key);
  } catch {
    // ignore
  }
};

const bootstrap = async () => {
  const legacyKeys = getBrowserLegacyKeys();
  hydrateFromLegacy(legacyKeys);

  const context = await getContext();
  if (!context) return;
  currentContext = context;

  const { data, error } = await supabase
    .from(STORAGE_TABLE)
    .select('chave, valor, user_id, modulo')
    .eq('empresa_id', context.empresa_id)
    .eq('user_id', context.user_id)
    .eq('modulo', STORAGE_MODULE);
  if (!error && Array.isArray(data)) {
    const persisted = data as RawPreferenceRow[];
    for (const row of persisted) {
      const parsed = normalizeValue(row.valor);
      if (parsed === null) continue;
      cache.set(row.chave, parsed);
    }
  }

  for (const key of new Set(legacyKeys)) {
    const legacy = window.localStorage.getItem(key);
    const remote = cache.get(key);
    if (legacy !== null && remote === undefined) {
      cache.set(key, legacy);
      await persistToSupabase(key, legacy);
    }
    if (legacy !== null) {
      window.localStorage.removeItem(key);
    }
  }
};

const ensureInitialized = () => {
  if (initPromise) return initPromise;
  initPromise = bootstrap().then(() => {
    if (!currentContext || realtimeChannel) return;
    realtimeChannel = supabase.channel(`app-storage-${currentContext.user_id}-${currentContext.empresa_id}`);
    realtimeChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: STORAGE_TABLE,
          filter: `empresa_id=eq.${currentContext.empresa_id},user_id=eq.${currentContext.user_id}`,
        },
        (payload) => {
          const row = (payload.new as RawPreferenceRow | null) || (payload.old as RawPreferenceRow | null);
          if (!row || row.user_id !== currentContext?.user_id || row.modulo !== STORAGE_MODULE) return;

          if (payload.eventType === 'DELETE') {
            cache.delete(row.chave);
          } else {
            const parsed = normalizeValue(row.valor);
            if (parsed === null) {
              cache.delete(row.chave);
            } else {
              cache.set(row.chave, parsed);
            }
          }
          notify(row.chave);
        },
      )
      .subscribe();
  });
  return initPromise;
};

export const persistedStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    ensureInitialized();
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    return window.localStorage.getItem(key);
  },

  setItem(key: string, value: string) {
    const normalized = String(value);
    cache.set(key, normalized);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
      notify(key);
      void persistToSupabase(key, normalized);
    }
  },

  removeItem(key: string) {
    cache.delete(key);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
      notify(key);
      void removeFromSupabase(key);
    }
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async hydrate() {
    await ensureInitialized();
  },
};
