import { supabase } from '../../../../lib/supabase';
import { activityWriteError } from './rpcCompatibility';

export const atribuirResponsavelRotinaProtocolo = async (
  rotinaId: string,
  responsavelConfigUsuarioId: string,
) => {
  const { error } = await supabase.rpc('atribuir_responsavel_rotina_protocolo', {
    p_rotina_id: rotinaId,
    p_responsavel_config_usuario_id: responsavelConfigUsuarioId,
  });
  if (error) throw activityWriteError('Não foi possível atribuir o responsável', error);
};

export const getCurrentEmpresaId = async () => {
  const { data, error } = await supabase.rpc('current_empresa_id');
  if (error) throw error;
  if (!data) throw new Error('Empresa atual nao encontrada para salvar atividades.');
  return data as string;
};
