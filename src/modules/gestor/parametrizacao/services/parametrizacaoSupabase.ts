import { supabase } from '../../../../lib/supabase';

export const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada para o usuario autenticado.');
  return data as string;
};

export const assertSupabase = (error: unknown) => {
  if (error) throw error;
};
