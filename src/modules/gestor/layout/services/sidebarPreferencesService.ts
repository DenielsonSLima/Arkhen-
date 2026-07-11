import { supabase } from '../../../../lib/supabase';

const TABLE = 'preferencias_sidebar_menu';

const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada.');
  return data as string;
};

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Usuario autenticado nao encontrado.');
  return data.user.id;
};

const normalizeMenuOrder = (order: string[] | null | undefined, allowedItems: string[], defaultOrder: string[]) => {
  const allowed = new Set(allowedItems);
  const base = Array.isArray(order) ? order : defaultOrder;
  const filtered = base.filter((item) => allowed.has(item));
  const missing = defaultOrder.filter((item) => allowed.has(item) && !filtered.includes(item));
  return [...filtered, ...missing];
};

export const sidebarPreferencesService = {
  normalizeMenuOrder,

  async getMenuOrder(allowedItems: string[], defaultOrder: string[]): Promise<string[] | null> {
    const [empresaId, userId] = await Promise.all([getCurrentEmpresaId(), getCurrentUserId()]);
    const { data, error } = await supabase
      .from(TABLE)
      .select('menu_order')
      .eq('empresa_id', empresaId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data?.menu_order) return null;
    return normalizeMenuOrder(data.menu_order as string[], allowedItems, defaultOrder);
  },

  async saveMenuOrder(order: string[], allowedItems: string[], defaultOrder: string[]): Promise<void> {
    const [empresaId, userId] = await Promise.all([getCurrentEmpresaId(), getCurrentUserId()]);
    const menuOrder = normalizeMenuOrder(order, allowedItems, defaultOrder);
    const { error } = await supabase.from(TABLE).upsert(
      {
        empresa_id: empresaId,
        user_id: userId,
        menu_order: menuOrder,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'empresa_id,user_id' },
    );

    if (error) throw error;
  },
};
