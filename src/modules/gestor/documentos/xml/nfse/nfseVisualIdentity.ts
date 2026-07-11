import { getPrefeituraProfile } from '../../../configuracoes/integracao-fiscal/services/prefeituras';
import type { NfseFiscalData } from '../shared/xmlFiscalTypes';

export interface NfseVisualIdentityOptions {
  emitidaPeloSistema?: boolean;
  empresaLogoUrl?: string;
  empresaNome?: string;
  marcaDaguaTexto?: string;
}

export interface NfseVisualIdentity {
  emitidaPeloSistema: boolean;
  prefeituraLogoUrl?: string;
  prefeituraNome?: string;
  empresaLogoUrl?: string;
  empresaNome?: string;
  marcaDaguaTexto?: string;
}

export const resolveNfseVisualIdentity = (
  nfse: NfseFiscalData,
  options: NfseVisualIdentityOptions = {},
): NfseVisualIdentity => {
  const emitidaPeloSistema = options.emitidaPeloSistema === true;

  if (!emitidaPeloSistema) {
    return { emitidaPeloSistema: false };
  }

  const profile = getPrefeituraProfile(nfse.prestador.uf || 'SE', nfse.prestador.municipio || '');
  const empresaNome = options.empresaNome || nfse.prestador.nome || 'Empresa emitente';

  return {
    emitidaPeloSistema: true,
    prefeituraLogoUrl: profile?.identidadeVisual?.prefeituraLogoUrl,
    prefeituraNome: profile?.identidadeVisual?.prefeituraNome,
    empresaLogoUrl: options.empresaLogoUrl,
    empresaNome,
    marcaDaguaTexto: options.marcaDaguaTexto || empresaNome,
  };
};
