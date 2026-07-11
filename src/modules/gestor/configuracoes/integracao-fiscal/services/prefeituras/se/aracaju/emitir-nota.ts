import type { FiscalPrefeituraOperacao } from '../../types';

export const aracajuEmitirNotaOperacoes: FiscalPrefeituraOperacao[] = [
  {
    id: 'aracaju-emitir-nota-sincrono',
    categoria: 'envio',
    titulo: 'Envio de Nota via Lote RPS (síncrono)',
    metodoAbraf: 'RecepcionarLoteRpsSincrono',
    soapAction: 'http://nfse.abrasf.org.br/RecepcionarLoteRpsSincrono',
    descricao:
      'Recebe lote de RPS e converte para NFS-e com retorno imediato.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'Operação padrão ABRASF em ambientes WebISS.',
      'Útil para testes com retorno direto.',
    ],
    referencias: ['https://aracajuse.webiss.com.br/ws/nfse.asmx?op=RecepcionarLoteRpsSincrono'],
  },
  {
    id: 'aracaju-emitir-nota-individual',
    categoria: 'envio',
    titulo: 'Emissão direta de NFS-e',
    metodoAbraf: 'GerarNfse',
    soapAction: 'http://nfse.abrasf.org.br/GerarNfse',
    descricao: 'Converte e emite um RPS individual para NFS-e.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: ['Preferível para depuração e fluxos unificados de lote único.'],
    referencias: ['https://aracajuse.webiss.com.br/ws/nfse.asmx?op=GerarNfse'],
  },
  {
    id: 'aracaju-emitir-lote-rps',
    categoria: 'envio',
    titulo: 'Envio de lote de RPS (assíncrono)',
    metodoAbraf: 'RecepcionarLoteRps',
    soapAction: 'http://nfse.abrasf.org.br/RecepcionarLoteRps',
    descricao: 'Envia lote de RPS com protocolo para consulta posterior.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    referencias: ['https://aracajuse.webiss.com.br/ws/nfse.asmx?op=RecepcionarLoteRps'],
  },
];
