import type { FiscalPrefeituraOperacao } from '../../types';

export const aracajuBaixarXmlOperacoes: FiscalPrefeituraOperacao[] = [
  {
    id: 'aracaju-baixar-xml-rps',
    categoria: 'download',
    titulo: 'Baixar XML por RPS',
    metodoAbraf: 'ConsultarNfsePorRps',
    soapAction: 'http://nfse.abrasf.org.br/ConsultarNfsePorRps',
    descricao: 'Obtém XML da nota pelo número do RPS para anexos e trilha de auditoria.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'Na prática, o XML pode ser buscado também por métodos de busca por faixa e serviço.',
      'A emissão de PDF de exibição normalmente ocorre por recurso do portal municipal.',
    ],
    referencias: ['https://aracajuse.webiss.com.br/ws/nfse.asmx?op=ConsultarNfsePorRps'],
    formasDeDownload: ['XML', 'Consulta por link no portal'],
  },
  {
    id: 'aracaju-baixar-xml-lote',
    categoria: 'download',
    titulo: 'Baixar XML do lote processado',
    metodoAbraf: 'ConsultarNfsePorFaixa',
    soapAction: 'http://nfse.abrasf.org.br/ConsultarNfsePorFaixa',
    descricao: 'Extrai XML de notas emitidas por intervalo para sincronização massiva.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    referencias: ['https://aracajuse.webiss.com.br/ws/nfse.asmx?op=ConsultarNfsePorFaixa'],
    formasDeDownload: ['XML por lote'],
  },
];
