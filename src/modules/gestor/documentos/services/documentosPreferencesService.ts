import { supabase } from '../../../../lib/supabase';
import { getCurrentEmpresaId } from '../../parametrizacao/services/parametrizacaoSupabase';
import type { DocumentCategory } from './documentosService';

const TABLE = 'preferencias_usuario_modulos';
const MODULO = 'documentos';
const MEUS_DOCUMENTOS_CHAVE = 'meus-documentos';
const MOVEDRAWER_CHAVE = 'documentos-move-drawers';
const PAGE_LAST_ACCESS_CHAVE = 'documentos-page-last-access';
const DOCUMENTS_LAST_OPENED_CHAVE = 'documentos-last-opened';

interface PreferenceRow {
  valor: unknown;
}

type MeusDocumentosPersisted = {
  pastas?: string[];
  categorias?: DocumentCategory[];
};

type DrawerStateMap = Record<string, boolean>;
type DocumentsLastOpenMap = Record<string, number>;

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Usuario autenticado nao encontrado.');
  return data.user.id;
};

const normalizeRows = <T>(value: unknown): T | null => {
  if (!value || typeof value !== 'object') return null;
  return value as T;
};

const getBaseFilter = async (chave: string) => {
  const [empresaId, userId] = await Promise.all([getCurrentEmpresaId(), getCurrentUserId()]);
  return {
    empresaId,
    userId,
    chave,
  };
};

const readPreference = async <T>(chave: string): Promise<T | null> => {
  const { empresaId, userId } = await getBaseFilter(chave);

  const { data, error } = await supabase
    .from(TABLE)
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('user_id', userId)
    .eq('modulo', MODULO)
    .eq('chave', chave)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeRows<T>((data as PreferenceRow).valor);
};

const savePreference = async <T>(chave: string, valor: T): Promise<void> => {
  const [empresaId, userId] = await Promise.all([getCurrentEmpresaId(), getCurrentUserId()]);

  const { error } = await supabase.from(TABLE).upsert(
    {
      empresa_id: empresaId,
      user_id: userId,
      modulo: MODULO,
      chave,
      valor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'empresa_id,user_id,modulo,chave' },
  );

  if (error) throw error;
};

const normalizeDocumentAccessMap = (raw: unknown): DocumentsLastOpenMap => {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>);
  const normalized = entries.reduce((acc, [key, value]) => {
    if (!Number.isFinite(Number(value))) return acc;
    acc[key] = Number(value);
    return acc;
  }, {} as DocumentsLastOpenMap);
  return normalized;
};

const normalizeDrawerMap = (raw: unknown): DrawerStateMap => {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>);
  return entries.reduce((acc, [key, value]) => {
    if (typeof value === 'boolean') acc[key] = value;
    return acc;
  }, {} as DrawerStateMap);
};

const readMeusDocumentosPreferences = async (): Promise<MeusDocumentosPersisted | null> => {
  return readPreference<MeusDocumentosPersisted>(MEUS_DOCUMENTOS_CHAVE);
};

export const documentosPreferencesService = {
  async getMeusDocumentosPreferences(): Promise<MeusDocumentosPersisted | null> {
    return readMeusDocumentosPreferences();
  },

  async saveMeusDocumentosPreferences(payload: MeusDocumentosPersisted): Promise<void> {
    await savePreference(MEUS_DOCUMENTOS_CHAVE, payload);
  },

  async getDrawerState(drawerKey: string): Promise<boolean | null> {
    const raw = await readPreference<DrawerStateMap>(MOVEDRAWER_CHAVE);
    const drawers = normalizeDrawerMap(raw);
    return Object.prototype.hasOwnProperty.call(drawers, drawerKey)
      ? drawers[drawerKey]
      : null;
  },

  async setDrawerState(drawerKey: string, isOpen: boolean): Promise<void> {
    const raw = await readPreference<DrawerStateMap>(MOVEDRAWER_CHAVE);
    const drawers = normalizeDrawerMap(raw);
    const next: DrawerStateMap = { ...drawers, [drawerKey]: isOpen };
    await savePreference(MOVEDRAWER_CHAVE, next);
  },

  async getPageLastAccess(): Promise<string | null> {
    const raw = await readPreference<string>(PAGE_LAST_ACCESS_CHAVE);
    return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
  },

  async setPageLastAccess(value: string): Promise<void> {
    await savePreference(PAGE_LAST_ACCESS_CHAVE, value);
  },

  async getDocumentsLastOpenMap(): Promise<DocumentsLastOpenMap> {
    const raw = await readPreference<unknown>(DOCUMENTS_LAST_OPENED_CHAVE);
    return normalizeDocumentAccessMap(raw);
  },

  async setDocumentsLastOpenMap(map: DocumentsLastOpenMap): Promise<void> {
    await savePreference(DOCUMENTS_LAST_OPENED_CHAVE, map);
  },
};
