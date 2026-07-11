import type { FiscalPrefeituraProfile } from '../../types';
import { aracajuEmitirNotaOperacoes } from './emitir-nota';
import { aracajuCancelarNotaOperacoes } from './cancelar-nota';
import { aracajuConsultarNFSEOperacoes } from './consultar-nfse';
import { aracajuBaixarXmlOperacoes } from './baixar-xml';
import prefeituraLogoUrl from './prefeitura-aracaju-logo.svg';

export const AracajuPrefeituraProfile: FiscalPrefeituraProfile = {
  id: 'SE-Aracaju-WebISS',
  uf: 'SE',
  municipio: 'Aracaju',
  providerId: 'WebISS',
  providerLabel: 'WebISS',
  identidadeVisual: {
    prefeituraNome: 'Prefeitura Municipal de Aracaju',
    prefeituraLogoUrl,
    marcaDaguaTexto: 'ARACAJU',
  },
  ambientes: {
    homologacao: {
      ambiente: 'homologacao',
      url: 'https://homologacao.webiss.com.br/ws/nfse.asmx',
      observacao: 'Ambiente de homologação usado pelo portal municipal.',
    },
    producao: {
      ambiente: 'producao',
      url: 'https://aracajuse.webiss.com.br/ws/nfse.asmx',
      observacao: 'Integração em produção via WebISS.',
    },
  },
  capabilities: {
    cancelamentoWebservice: true,
    consultaSituacao: true,
  },
  notes: [
    'Município de Aracaju utiliza WebISS com acesso por autenticação no portal municipal.',
    'Página de manuais indica endpoint de homologação e suporte técnico em callcenter2@webiss.com.br.',
    'As operações seguem o padrão ABRASF com SOAP 1.1/1.2 conforme WSDL da prefeitura.',
  ],
  operacoes: [
    ...aracajuEmitirNotaOperacoes,
    ...aracajuCancelarNotaOperacoes,
    ...aracajuConsultarNFSEOperacoes,
    ...aracajuBaixarXmlOperacoes,
  ],
  fonte: 'WebISS Aracaju (páginas públicas de autenticação/manuais + WSDL de ws/nfse.asmx).',
};
