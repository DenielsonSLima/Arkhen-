import type { RegimeTributario } from '../types';

export const defaultLucroRealData: RegimeTributario = {
  id: 'real',
  title: 'Lucro Real',
  limit: 'Obrigatório acima de R$ 78M / ano',
  desc: 'Regime de tributação geral em que o IRPJ e a CSLL são calculados com base no lucro líquido apurado na contabilidade (receitas menos despesas comprovadas) após os ajustes de adições e exclusões previstos na legislação.',
  positives: [
    'Justiça tributária: a empresa só paga IRPJ e CSLL se houver lucro líquido contábil efetivo',
    'Em caso de prejuízo fiscal, a empresa fica isenta do pagamento desses impostos federais',
    'Permite compensar prejuízos acumulados de exercícios anteriores (limite de 30%)',
    'Permite creditar despesas operacionais no regime não-cumulativo de PIS/COFINS'
  ],
  negatives: [
    'Altíssima complexidade e exigência de controle contábil e fiscal rigoroso',
    'Alíquotas de PIS/COFINS elevadas (1,65% e 7,6% não-cumulativo)',
    'Qualquer divergência ou erro de apuração acarreta sérios riscos de multas do fisco'
  ],
  color: 'lucro-real'
};
