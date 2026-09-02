import type { Company } from './gestaoEmpresarialService';

export const getEffectiveTaxRegime = (regime: Company['tipo']): Company['tipo'] => (
  regime === 'MEI' ? 'Simples Nacional' : regime
);
