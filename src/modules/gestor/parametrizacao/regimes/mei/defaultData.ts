import type { RegimeTributario } from '../types';

export const defaultMeiData: RegimeTributario = {
  id: 'mei',
  title: 'MEI (Microempreendedor Individual)',
  limit: 'R$ 81.000,00 / ano',
  desc: 'Regime simplificado voltado para microempreendedores individuais com foco na formalização e tributação simplificada com custo fixo.',
  positives: [
    'Baixo custo mensal com impostos fixos (Guia DAS)',
    'Isenção de tributos federais (IRPJ, PIS, COFINS, IPI, CSLL)',
    'Processo de abertura rápido e 100% digital',
    'Direito a benefícios previdenciários (aposentadoria, auxílio-doença)'
  ],
  negatives: [
    'Limite de faturamento baixo (R$ 81k/ano)',
    'Permite a contratação de apenas 1 funcionário',
    'Não pode ter filiais ou ser sócio de outra empresa'
  ],
  color: 'mei'
};
