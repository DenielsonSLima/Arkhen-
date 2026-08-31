import { catalogosService } from '../../parametrizacao/services/catalogosService';
import { TIPOS_PARCEIROS_DEFAULTS } from '../../parametrizacao/services/partnerClassificationCatalogDefaults';

export const isClienteContabilPartnerType = (item?: { codigo: string; nome: string } | null) => (
  item?.codigo === 'tp-1'
  || item?.codigo === 'cliente_contabil'
  || item?.nome === 'Cliente Contábil'
);

export const getClienteContabilPartnerTypeId = async () => {
  const partnerTypes = await catalogosService.list('tipos_parceiros', TIPOS_PARCEIROS_DEFAULTS);
  return partnerTypes.find(isClienteContabilPartnerType)?.id || null;
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
