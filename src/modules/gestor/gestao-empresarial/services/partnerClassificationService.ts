import { supabase } from '../../../../lib/supabase';

export const isClienteContabilPartnerType = (item?: { codigo: string; nome: string } | null) => (
  item?.codigo === 'tp-1'
  || item?.codigo === 'cliente_contabil'
  || item?.nome === 'Cliente Contábil'
);

export const getClienteContabilPartnerTypeId = async () => {
  const { data, error } = await supabase.rpc('obter_tipo_parceiro_cliente_contabil');
  if (error) throw error;
  return typeof data === 'string' && data ? data : null;
};

export const isPartnerClassificationSchemaError = (message?: string | null) => {
  if (!message) return false;
  return [
    'tipo_parceiro_id',
    'tipo_empresa_id',
    'natureza_juridica_id',
  ].some((column) => (
    message.includes(`Could not find the '${column}' column`)
    || message.includes(`Could not find the "${column}" column`)
    || message.includes(`column "${column}"`)
    || message.includes(`column '${column}'`)
  ));
};
