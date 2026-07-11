import type { FiscalPrefeituraOperacao } from '../../types';

export const aracajuCancelarNotaOperacoes: FiscalPrefeituraOperacao[] = [
  {
    id: 'aracaju-cancelar-nota',
    categoria: 'cancelamento',
    titulo: 'Cancelar NFS-e',
    metodoAbraf: 'CancelarNfse',
    soapAction: 'http://nfse.abrasf.org.br/CancelarNfse',
    descricao: 'Solicita cancelamento direto da NFS-e no município.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'A prefeitura de Aracaju mantém emissão via WebISS e disponibiliza endpoint WebService.',
    ],
    referencias: ['https://aracajuse.webiss.com.br/ws/nfse.asmx?op=CancelarNfse'],
  },
  {
    id: 'aracaju-substituir-nota',
    categoria: 'substituicao',
    titulo: 'Substituir NFS-e',
    metodoAbraf: 'SubstituirNfse',
    soapAction: 'http://nfse.abrasf.org.br/SubstituirNfse',
    descricao:
      'Emite nota substituta para ajustar erro material com rastreabilidade fiscal.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    referencias: ['https://aracajuse.webiss.com.br/ws/nfse.asmx?op=SubstituirNfse'],
  },
];
