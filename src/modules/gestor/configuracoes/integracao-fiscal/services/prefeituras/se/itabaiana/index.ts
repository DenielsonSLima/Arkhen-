import type { FiscalPrefeituraProfile } from '../../types';
import { itabaianaEmitirNotaOperacoes } from './emitir-nota';
import { itabaianaCancelarNotaOperacoes } from './cancelar-nota';
import { itabaianaConsultarNFSEOperacoes } from './consultar-nfse';
import { itabaianaBaixarXmlOperacoes } from './baixar-xml';
import prefeituraLogoUrl from './prefeitura-itabaiana-logo.svg';

export const ItabaianaPrefeituraProfile: FiscalPrefeituraProfile = {
  id: 'SE-Itabaiana-WebISS',
  uf: 'SE',
  municipio: 'Itabaiana',
  providerId: 'WebISS',
  providerLabel: 'WebISS',
  identidadeVisual: {
    prefeituraNome: 'Prefeitura Municipal de Itabaiana',
    prefeituraLogoUrl,
    marcaDaguaTexto: 'ITABAIANA',
  },
  ambientes: {
    homologacao: {
      ambiente: 'homologacao',
      url: 'https://homologacao.webiss.com.br/ws/nfse.asmx',
      observacao: 'Ambiente de testes indicado para homologação com WebISS.',
    },
    producao: {
      ambiente: 'producao',
      url: 'https://itabaianase.webiss.com.br/ws/nfse.asmx',
      observacao: 'Integração em produção com a prefeitura local via WebISS.',
    },
  },
  capabilities: {
    cancelamentoWebservice: true,
    consultaSituacao: true,
  },
  notes: [
    'Município WebISS com contrato ABRASF 2.02 e operação em produção/homologação.',
    'Manual municipal aponta ajustes para o padrão NFS-e e envio obrigatório ao Ambiente de Dados Nacional.',
    'Para homologação é necessário acesso ao usuário/contador e CeC aprovado no portal municipal.',
  ],
  operacoes: [
    ...itabaianaEmitirNotaOperacoes,
    ...itabaianaCancelarNotaOperacoes,
    ...itabaianaConsultarNFSEOperacoes,
    ...itabaianaBaixarXmlOperacoes,
  ],
  fonte: 'Portal WebISS Itabaiana/SE: WSDL oficial e Manual Técnico de Integração ABRASF 2.02 (consulta em 22/07/2026).',
};
