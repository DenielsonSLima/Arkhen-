import type { GuideModule } from '../types';
import { PARCEIROS_ARTICLES } from './parceirosGuide';
import { PARAMETRIZACAO_ARTICLES } from './parametrizacaoGuide';

export const CADASTROS_GUIDE: GuideModule[] = [
  {
    id: 'parceiros', title: 'Parceiros', icon: 'Users',
    description: 'Cadastre pessoas e empresas, mantenha os dados da carteira e configure filiais e obrigações por unidade.',
    articles: PARCEIROS_ARTICLES,
  },
  {
    id: 'parametrizacao', title: 'Parametrização', icon: 'Database',
    description: 'Prepare os cadastros de apoio, os modelos de obrigações, as classificações, as pastas e os parâmetros usados nas operações.',
    articles: PARAMETRIZACAO_ARTICLES,
  },
];
