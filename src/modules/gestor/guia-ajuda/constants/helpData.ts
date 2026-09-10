import { CADASTROS_GUIDE } from './cadastrosGuide';
import { OPERACAO_GUIDE } from './operacaoGuide';
import { GESTAO_GUIDE } from './gestaoGuide';

const MODULE_ORDER = ['inicio', 'parceiros', 'parametrizacao', 'atividades', 'acompanhamento',
  'simulacoes', 'reforma-tributaria', 'faturamento', 'financeiro', 'documentos', 'agenda', 'configuracoes', 'relatorios'];

export const HELP_DATA = [...CADASTROS_GUIDE, ...OPERACAO_GUIDE, ...GESTAO_GUIDE]
  .sort((a, b) => MODULE_ORDER.indexOf(a.id) - MODULE_ORDER.indexOf(b.id));

export const GUIDE_ARTICLES = HELP_DATA.flatMap((module) => module.articles.map((article) => ({ module, article })));

export const normalizeGuideText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

const SEARCH_INDEX = GUIDE_ARTICLES.map((entry) => ({
  ...entry,
  text: normalizeGuideText([entry.module.title, entry.article.title, entry.article.summary, entry.article.path,
    ...entry.article.prerequisites, ...entry.article.steps.flatMap((step) => [step.title, step.description]),
    ...entry.article.verification, ...(entry.article.tips || [])].join(' ')),
}));

export function searchGuide(query: string) {
  const words = normalizeGuideText(query).trim().split(/\s+/).filter(Boolean);
  return words.length ? SEARCH_INDEX.filter((entry) => words.every((word) => entry.text.includes(word))) : [];
}
