import type { SystemModuleConfig, SystemModuleId } from './modulosSistemaService';

const ROUTE_PARENT: Record<string, SystemModuleId> = {
  inicio: 'inicio',
  clientes: 'clientes',
  'gestao-empresarial': 'clientes',
  atividades: 'atividades',
  conformidade: 'atividades',
  protocolos: 'protocolos',
  'simulacoes-calculos': 'simulacoes-calculos',
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
  // Abas persistidas de um módulo removido não devem ser reabertas.
  if (routeId === 'reforma-tributaria' || routeId.startsWith('reforma-tributaria__')) return false;
  const moduleId = getSystemModuleId(routeId);
  return moduleId === null || enabled.has(moduleId);
};
