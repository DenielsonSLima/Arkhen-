import type { SystemModuleConfig, SystemModuleId } from './modulosSistemaService';

const ROUTE_PARENT: Record<string, SystemModuleId> = {
  inicio: 'inicio',
  clientes: 'clientes',
  'gestao-empresarial': 'clientes',
  atividades: 'atividades',
  conformidade: 'conformidade',
  protocolos: 'protocolos',
  'simulacoes-calculos': 'simulacoes-calculos',
  'planejamento-tributario': 'simulacoes-calculos',
  'reforma-tributaria': 'reforma-tributaria',
  faturamento: 'faturamento',
  financeiro: 'financeiro',
  documentos: 'documentos',
  agenda: 'agenda',
  parametrizacao: 'parametrizacao',
  configuracoes: 'configuracoes',
};

export const getSystemModuleId = (routeId: string): SystemModuleId | null => {
  if (routeId.startsWith('atividades-')) return 'atividades';
  if (routeId.startsWith('financeiro-')) return 'financeiro';
  if (routeId.startsWith('parametrizacao-')) return 'parametrizacao';
  return ROUTE_PARENT[routeId] || null;
};

export const getEnabledModuleIds = (modules: SystemModuleConfig[]) => (
  new Set(modules.filter((module) => module.habilitado).map((module) => module.id))
);

export const isRouteEnabled = (routeId: string, enabled: Set<SystemModuleId>) => {
  const moduleId = getSystemModuleId(routeId);
  return moduleId === null || enabled.has(moduleId);
};
