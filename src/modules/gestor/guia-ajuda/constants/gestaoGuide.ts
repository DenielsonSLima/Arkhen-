import type { GuideModule } from '../types';
import { ANALISES_GUIDE } from './analisesGuide';
import { CONFIGURACOES_GUIDE } from './configuracoesGuide';
import { FATURAMENTO_FINANCEIRO_GUIDE } from './faturamentoFinanceiroGuide';

export const GESTAO_GUIDE: GuideModule[] = [
  ...FATURAMENTO_FINANCEIRO_GUIDE,
  ...ANALISES_GUIDE.filter((module) => module.id !== 'relatorios'),
  CONFIGURACOES_GUIDE,
  ...ANALISES_GUIDE.filter((module) => module.id === 'relatorios'),
];
