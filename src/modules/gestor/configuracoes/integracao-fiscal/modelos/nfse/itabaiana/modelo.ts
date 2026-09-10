import type { NfseFiscalData } from '../../../../../documentos/xml/shared/xmlFiscalTypes';
import type { NfseFontes } from './fontes';
import type { NfseMarcaDagua } from './marcaDagua';

export type NfseAmbiente = 'homologacao' | 'producao' | 'nao_identificado';
export interface NfseModeloOptions {
  fontes?: NfseFontes;
  ambiente: NfseAmbiente;
  empresaNome?: string;
  empresaId?: string;
  marcaDagua?: NfseMarcaDagua;
  brasaoImagem?: string | Uint8Array;
  cancelada?: boolean;
  demonstracao?: boolean;
}

export const isItabaiana = (nfse: NfseFiscalData) => nfse.codigoMunicipioGerador
  ? nfse.codigoMunicipioGerador === '2802908'
  : nfse.prestador.codigoMunicipio === '2802908'
    || (nfse.prestador.municipio.toLowerCase() === 'itabaiana' && nfse.prestador.uf.toUpperCase() === 'SE');

export const validationUrl = (ambiente: NfseAmbiente) => ambiente === 'homologacao'
  ? 'https://homologacao.webiss.com.br/externo/nfse/validar'
  : ambiente === 'producao' ? 'https://itabaianase.webiss.com.br/externo/nfse/validar' : '';

export const booleanLabel = (value: string) => ({ '1': 'Sim', '2': 'Não', '0': 'Não', true: 'Sim', false: 'Não' }[value] || value || '-');
export const regimeLabel = (value: string) => ({
  '1': 'Microempresa municipal', '2': 'Estimativa', '3': 'Sociedade de profissionais',
  '4': 'Cooperativa', '5': 'Microempreendedor individual (MEI)', '6': 'Microempresa / Empresa de pequeno porte (ME/EPP)',
}[value] || value || '-');
export const exigibilidadeLabel = (value?: string) => ({
  '1': 'Exigível', '2': 'Não incidência', '3': 'Isenção', '4': 'Exportação', '5': 'Imunidade',
  '6': 'Suspensa por decisão judicial', '7': 'Suspensa por processo administrativo',
}[value || ''] || value || '-');
