export interface InicioSetupTarget {
  moduleId: string;
  configSubTab?: 'empresa' | 'marca-dagua' | 'usuarios';
}

export const navigateToInicioTarget = (
  target: InicioSetupTarget,
  activateModule: (moduleId: string) => void,
  storage: Pick<Storage, 'setItem'> = window.sessionStorage,
) => {
  if (target.configSubTab) {
    try {
      storage.setItem('contabil_config_initial_subtab', target.configSubTab);
    } catch {
      // A navegação principal continua disponível quando o navegador bloqueia storage.
    }
    window.dispatchEvent(new CustomEvent('open_config_subtab', {
      detail: { subTab: target.configSubTab },
    }));
  }
  activateModule(target.moduleId);
};
