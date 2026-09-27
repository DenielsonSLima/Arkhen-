export interface EntregaModelo {
  id: string;
  nome: string;
  categoria:
    | 'Fiscal'
    | 'Contábil'
    | 'Trabalhista'
    | 'Departamento Pessoal'
    | 'Financeiro'
    | 'Documentos'
    | 'Obrigações Acessórias'
    | 'Tributos'
    | 'NF-e'
    | 'NFC-e';
  orgao?: string;
  diaLimite: number;
}

export const ENTREGA_CATALOGO: EntregaModelo[] = [
  { id: 'irpj-csll-trimestral', nome: 'IRPJ/CSLL', categoria: 'Tributos', orgao: 'Receita Federal', diaLimite: 31 },
  { id: 'pis-cofins', nome: 'PIS/COFINS', categoria: 'Tributos', orgao: 'Receita Federal', diaLimite: 25 },
  { id: 'iss-iss-retido', nome: 'ISS/ISS Retido', categoria: 'Tributos', orgao: 'Município', diaLimite: 20 },
  { id: 'fecoep-saidas', nome: 'FECOEP Saídas', categoria: 'Tributos', orgao: 'SEFAZ', diaLimite: 20 },
  { id: 'fecoep-entradas', nome: 'FECOEP Entradas', categoria: 'Tributos', orgao: 'SEFAZ', diaLimite: 20 },
  { id: 'icms-difal', nome: 'ICMS Difal', categoria: 'Tributos', orgao: 'SEFAZ', diaLimite: 20 },
  { id: 'icms-normal', nome: 'ICMS Normal', categoria: 'Tributos', orgao: 'SEFAZ', diaLimite: 20 },
  { id: 'icms-antecipado', nome: 'ICMS Antecipação', categoria: 'Tributos', orgao: 'SEFAZ', diaLimite: 20 },
  { id: 'dctfweb', nome: 'DCTFWeb', categoria: 'Obrigações Acessórias', orgao: 'Receita Federal', diaLimite: 25 },
  { id: 'reinf', nome: 'EFD-Reinf', categoria: 'Obrigações Acessórias', orgao: 'Receita Federal', diaLimite: 15 },
  { id: 'sped-fiscal', nome: 'SPED Fiscal', categoria: 'Obrigações Acessórias', orgao: 'Receita/SEFAZ', diaLimite: 20 },
  { id: 'sped-contribuicoes', nome: 'SPED Contribuições', categoria: 'Obrigações Acessórias', orgao: 'Receita Federal', diaLimite: 15 },
  { id: 'mit', nome: 'MIT', categoria: 'Obrigações Acessórias', orgao: 'Receita Federal', diaLimite: 25 },
  { id: 'dirbi', nome: 'DIRBI', categoria: 'Obrigações Acessórias', orgao: 'Receita Federal', diaLimite: 20 },
  { id: 'caixa-postal-rfb', nome: 'Caixa Postal RFB', categoria: 'Obrigações Acessórias', orgao: 'Receita Federal', diaLimite: 20 },
  { id: 'caixa-postal-sefaz', nome: 'Caixa Postal SEFAZ', categoria: 'Obrigações Acessórias', orgao: 'SEFAZ', diaLimite: 20 },
  { id: 'esocial', nome: 'eSocial', categoria: 'Departamento Pessoal', orgao: 'Governo Federal', diaLimite: 15 },
  { id: 'pgdas', nome: 'PGDAS-D / DAS', categoria: 'Tributos', orgao: 'Simples Nacional', diaLimite: 20 },
  { id: 'xml-nfe', nome: 'XML NF-e', categoria: 'NF-e', orgao: 'Nota fiscal eletrônica', diaLimite: 5 },
  { id: 'xml-nfce', nome: 'XML NFC-e', categoria: 'NFC-e', orgao: 'Cupom fiscal eletrônico', diaLimite: 5 },
  { id: 'nfs', nome: 'NFS', categoria: 'Documentos', orgao: 'Cliente', diaLimite: 5 },
  { id: 'notas-fiscais', nome: 'Notas fiscais do mês', categoria: 'Documentos', diaLimite: 5 },
  { id: 'extrato-bancario', nome: 'Extrato bancário', categoria: 'Financeiro', diaLimite: 5 },
  { id: 'folha-pagamento', nome: 'Folha de pagamento', categoria: 'Trabalhista', diaLimite: 7 },
  { id: 'decred-semestral', nome: 'DECRED', categoria: 'Documentos', orgao: 'Receita Federal', diaLimite: 28 },
  { id: 'guias-pagas', nome: 'Guias pagas e comprovantes', categoria: 'Documentos', diaLimite: 28 },
];
