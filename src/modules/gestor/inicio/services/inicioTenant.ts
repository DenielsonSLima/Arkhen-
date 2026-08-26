import { supabase } from '../../../../lib/supabase';

export const getInicioEmpresaId = async (): Promise<string> => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw new Error(`Erro ao identificar a empresa ativa: ${error.message}`);
  if (typeof data !== 'string' || !data) {
    throw new Error('Empresa ativa não encontrada para o usuário atual.');
  }
  return data;
};
