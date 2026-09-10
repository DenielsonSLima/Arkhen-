import type { FiscalDraftData } from '../../services/faturamentoFiscalTypes';
export const blankFiscalData = (): FiscalDraftData => ({
  competencia: '', dataEmissao: '', descricao: '', valor: '', itemListaServico: '', codigoCnae: '',
  codigoTributacaoMunicipio: '', codigoNbs: '', codigoMunicipio: '', municipioIncidencia: '',
  exigibilidadeIss: '', issRetido: '', responsavelRetencao: '', optanteSimplesNacional: '',
  regimeEspecial: '', incentivoFiscal: '', aliquotaIss: '', tomadorNumero: '', tomadorCodigoMunicipio: '',
});
/** Copia apenas campos editáveis: identidade/numeração/assinatura nunca entram no formulário. */
export function editableFiscalData(source: Partial<FiscalDraftData>): FiscalDraftData {
  const result = blankFiscalData();
  for (const key of Object.keys(result) as (keyof FiscalDraftData)[]) {
    const value = source[key];
    if (typeof value === 'string' || typeof value === 'number') Object.assign(result, { [key]: value });
  }
  return result;
}
export const fiscalFieldLabels: Partial<Record<keyof FiscalDraftData, string>> = {
  competencia: 'Competência', dataEmissao: 'Data de emissão do RPS', descricao: 'Descrição dos serviços', valor: 'Valor dos serviços (R$)',
  itemListaServico: 'Item da lista LC116', codigoCnae: 'CNAE', codigoTributacaoMunicipio: 'Atividade / código municipal',
  codigoNbs: 'NBS', codigoMunicipio: 'Município de prestação (IBGE)', municipioIncidencia: 'Município de incidência (IBGE)',
  exigibilidadeIss: 'Exigibilidade do ISS', issRetido: 'ISS retido', responsavelRetencao: 'Responsável pela retenção',
  optanteSimplesNacional: 'Optante pelo Simples Nacional', regimeEspecial: 'Regime especial', incentivoFiscal: 'Incentivo fiscal',
  aliquotaIss: 'Alíquota ISS (%)', tomadorNumero: 'Número do endereço do tomador', tomadorCodigoMunicipio: 'Município do tomador (IBGE)',
};
