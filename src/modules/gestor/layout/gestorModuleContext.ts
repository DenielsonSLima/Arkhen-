import type { InternalTabContext } from '../../../stores/internalTabsStore';

export const resolveFinanceiroInitialTab = (
  moduleId: string,
  context?: InternalTabContext,
) => {
  if (moduleId.startsWith('financeiro-')) return moduleId.replace('financeiro-', '');
  const activeTab = context?.data?.activeTab;
  return typeof activeTab === 'string' ? activeTab : undefined;
};
