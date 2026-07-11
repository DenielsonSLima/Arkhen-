import type { RegimeTributario } from '../types';

export const defaultSimplesNacionalData: RegimeTributario = {
  id: 'simples',
  title: 'Simples Nacional',
  limit: 'Até R$ 4,8 milhões / ano',
  desc: 'Regime simplificado que unifica o recolhimento de até oito tributos federais, estaduais e municipais (como IRPJ, CSLL, PIS, COFINS, IPI, ICMS, ISS e CPP) em uma única guia mensal, o DAS.',
  positives: [
    'Unificação de oito impostos em uma única guia de pagamento (DAS)',
    'Redução de burocracia contábil e administrativa',
    'Alíquotas progressivas geralmente menores para empresas em início de operação',
    'Facilidade em processos de licitação pública'
  ],
  negatives: [
    'Limite de faturamento anual restrito a R$ 4,8 milhões',
    'Restrições na transferência de créditos de ICMS e IPI para parceiros comerciais',
    'Alíquotas progressivas baseadas em receita cumulativa de 12 meses (efeito cascata)'
  ],
  color: 'simples-nacional'
};
