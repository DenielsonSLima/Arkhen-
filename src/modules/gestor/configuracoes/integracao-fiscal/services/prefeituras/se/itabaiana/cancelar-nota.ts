import type { FiscalPrefeituraOperacao } from '../../types';

export const itabaianaCancelarNotaOperacoes: FiscalPrefeituraOperacao[] = [
  {
    id: 'itabaiana-cancelar-nota',
    categoria: 'cancelamento',
    titulo: 'Cancelar NFS-e',
    metodoAbraf: 'CancelarNfse',
    soapAction: 'http://nfse.abrasf.org.br/CancelarNfse',
    descricao: 'Solicita o cancelamento de uma NFS-e emitida, conforme regras de prazo da prefeitura.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'A prefeitura de Itabaiana explicita suporte a cancelamento por WebService.',
      'A consulta de cancelamento geralmente exige número/tomador e/ou protocolo conforme regra local.',
    ],
    referencias: ['https://itabaianase.webiss.com.br/ws/nfse.asmx?op=CancelarNfse'],
  },
];
