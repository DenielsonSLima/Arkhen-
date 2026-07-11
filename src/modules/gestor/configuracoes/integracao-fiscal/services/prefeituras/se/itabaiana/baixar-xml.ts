import type { FiscalPrefeituraOperacao } from '../../types';

export const itabaianaBaixarXmlOperacoes: FiscalPrefeituraOperacao[] = [
  {
    id: 'itabaiana-baixar-xml-rps',
    categoria: 'download',
    titulo: 'Baixar XML por RPS',
    metodoAbraf: 'ConsultarNfsePorRps',
    soapAction: 'http://nfse.abrasf.org.br/ConsultarNfsePorRps',
    descricao:
      'Busca a representação XML da NFS-e pelo número do RPS, útil para anexar no histórico fiscal.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'Normalmente usado para reconciliação e emissão de comprovantes para protocolo interno.',
    ],
    referencias: ['https://itabaianase.webiss.com.br/ws/nfse.asmx?op=ConsultarNfsePorRps'],
    formasDeDownload: ['XML', 'PDF (via portal do município)'],
  },
  {
    id: 'itabaiana-baixar-xml-substituicao',
    categoria: 'download',
    titulo: 'Download de XML de substituição (se suportado)',
    metodoAbraf: 'SubstituirNfse',
    soapAction: 'http://nfse.abrasf.org.br/SubstituirNfse',
    descricao:
      'Permite consulta/geração de documento quando a nota é substituída por nova emissão.',
    ativa: true,
    ambientes: { homologacao: true, producao: true },
    observacoes: [
      'Operação de substituição é parte do contrato de serviços e está presente no catálogo WebISS da cidade.',
      'Use esta opção apenas quando a regra de negócio exigir emissão substitutiva.',
    ],
    referencias: ['https://itabaianase.webiss.com.br/ws/nfse.asmx?op=SubstituirNfse'],
    formasDeDownload: ['XML (documento atual)', 'XML (documento anterior)'],
  },
];
