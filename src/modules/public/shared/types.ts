export interface SharedDocumentForPublicView {
  id: string;
  documento: string;
  storage_bucket: string | null;
  storage_path: string | null;
}

export interface PublicSharedDocumentPayload {
  shareGroupId: string;
  empresa: string;
  empresaCnpj: string | null;
  empresaLogo?: string | null;
  geradoPor: string;
  tempoLimite: string;
  dataGeracao: string;
  dataGeracaoIso: string;
  dataExpiracao: string;
  dataExpiracaoIso: string;
  senhaObrigatoria: boolean;
  documents: SharedDocumentForPublicView[];
  legacyUrl?: string;
  isLegacy?: boolean;
}
