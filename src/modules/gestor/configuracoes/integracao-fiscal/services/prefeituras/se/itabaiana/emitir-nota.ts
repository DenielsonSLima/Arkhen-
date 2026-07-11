import type { FiscalPrefeituraOperacao } from '../../types';

export const itabaianaEmitirNotaOperacoes: FiscalPrefeituraOperacao[] = [
  {
    id: 'itabaiana-emitir-nota-sincrono',
    categoria: 'envio',
    titulo: 'Envio de Nota via Lote RPS (síncrono)',
    metodoAbraf: 'RecepcionarLoteRpsSincrono',
    soapAction: 'http://nfse.abrasf.org.br/RecepcionarLoteRpsSincrono',
    descricao:
      'Recebe lote de RPS e retorna a conversão para NFS-e na mesma chamada, com retorno imediato.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'Ideal para integração com validações imediatas de retorno.',
      'Utiliza método do padrão ABRASF 1.2/2.03 com cabeçalho e XML de dados do RPS.',
    ],
    referencias: [
      'https://itabaianase.webiss.com.br/ws/nfse.asmx?op=RecepcionarLoteRpsSincrono',
    ],
    formasDeDownload: [],
  },
  {
    id: 'itabaiana-emitir-nota-lote',
    categoria: 'envio',
    titulo: 'Envio de Lote RPS (assíncrono)',
    metodoAbraf: 'RecepcionarLoteRps',
    soapAction: 'http://nfse.abrasf.org.br/RecepcionarLoteRps',
    descricao:
      'Recebe lote de RPS para processamento em lote com protocolo para consulta posterior.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'Gera protocolo de recepção do lote para acompanhar status.',
      'É a operação recomendada quando há volume alto de documentos.',
    ],
    referencias: ['https://itabaianase.webiss.com.br/ws/nfse.asmx?op=RecepcionarLoteRps'],
  },
  {
    id: 'itabaiana-emitir-nota-individual',
    categoria: 'envio',
    titulo: 'Emissão direta de NFS-e',
    metodoAbraf: 'GerarNfse',
    soapAction: 'http://nfse.abrasf.org.br/GerarNfse',
    descricao: 'Converte e emite uma nota única diretamente via método GerarNfse.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: ['Útil para emissão pontual e depuração de payloads.', 'Requer payload de RPS validado.'],
    referencias: ['https://itabaianase.webiss.com.br/ws/nfse.asmx?op=GerarNfse'],
  },
];
