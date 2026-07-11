export interface EntregaModelo {
  id: string;
  nome: string;
  categoria: 'Fiscal' | 'Contábil' | 'Trabalhista' | 'Financeiro' | 'Documentos' | 'NF-e' | 'NFC-e';
  orgao?: string;
  diaLimite: number;
}

export const ENTREGA_CATALOGO: EntregaModelo[] = [
  { id: 'irpj-csll-trimestral', nome: 'Apuração IRPJ/CSLL', categoria: 'Fiscal', orgao: 'Receita Federal', diaLimite: 31 },
  { id: 'sped-fiscal', nome: 'SPED Fiscal', categoria: 'Fiscal', orgao: 'Receita/SEFAZ', diaLimite: 20 },
  { id: 'sped-contribuicoes', nome: 'SPED Contribuições', categoria: 'Fiscal', orgao: 'Receita Federal', diaLimite: 15 },
  { id: 'dctfweb', nome: 'DCTFWeb', categoria: 'Fiscal', orgao: 'Receita Federal', diaLimite: 25 },
  { id: 'reinf', nome: 'EFD-Reinf', categoria: 'Fiscal', orgao: 'Receita Federal', diaLimite: 15 },
  { id: 'esocial', nome: 'eSocial', categoria: 'Trabalhista', orgao: 'Governo Federal', diaLimite: 15 },
  { id: 'pgdas', nome: 'PGDAS-D / DAS', categoria: 'Fiscal', orgao: 'Simples Nacional', diaLimite: 20 },
  { id: 'xml-nfe', nome: 'XML NF-e', categoria: 'NF-e', orgao: 'Nota fiscal eletrônica', diaLimite: 5 },
  { id: 'xml-nfce', nome: 'XML NFC-e', categoria: 'NFC-e', orgao: 'Cupom fiscal eletrônico', diaLimite: 5 },
  { id: 'notas-fiscais', nome: 'Notas fiscais do mês', categoria: 'Documentos', diaLimite: 5 },
  { id: 'extrato-bancario', nome: 'Extrato bancário', categoria: 'Financeiro', diaLimite: 5 },
  { id: 'folha-pagamento', nome: 'Folha de pagamento', categoria: 'Trabalhista', diaLimite: 7 },
  { id: 'decred-semestral', nome: 'DECRED', categoria: 'Documentos', orgao: 'Receita Federal', diaLimite: 28 },
  { id: 'guias-pagas', nome: 'Guias pagas e comprovantes', categoria: 'Documentos', diaLimite: 28 },
];
