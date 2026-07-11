import type { RegimeTributario } from '../types';

export const defaultLucroPresumidoData: RegimeTributario = {
  id: 'presumido',
  title: 'Lucro Presumido',
  limit: 'Até R$ 78.000.000,00 / ano',
  desc: 'Regime de tributação em que a Receita Federal presume que um percentual fixo do faturamento da empresa (ex: 32% para serviços, 8% para comércio) corresponde ao seu lucro real.',
  positives: [
    'Menor necessidade de documentação contábil rigorosa para determinação fiscal',
    'Alíquotas de PIS e COFINS reduzidas e fixadas sob regime cumulativo (0,65% e 3%)',
    'Vantajoso se a margem de lucro real da empresa for superior à margem presumida em lei'
  ],
  negatives: [
    'Impostos cobrados mesmo se a empresa estiver registrando prejuízo real',
    'Não permite deduzir despesas operacionais ou custos para abatimento do imposto',
    'Pode se tornar oneroso para prestadores de serviços com margens de lucro baixas'
  ],
  color: 'lucro-presumido'
};
