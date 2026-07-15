import { useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, LockKeyhole, Save, ShieldCheck } from 'lucide-react';
import { useModulosSistemaQuery, useSaveModulosSistemaMutation } from './hooks/useModulosSistema';
import type { SaveSystemModuleInput, SystemModuleId } from './services/modulosSistemaService';
import './ModulosSistemaConfig.css';

export const ModulosSistemaConfig = () => {
  const modulesQuery = useModulosSistemaQuery();
  const saveMutation = useSaveModulosSistemaMutation();
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!modulesQuery.data || dirty) return;
    setDraft(Object.fromEntries(modulesQuery.data.modulos.map((module) => [module.id, module.habilitado])));
  }, [dirty, modulesQuery.data]);

  const groups = useMemo(() => {
    const modules = modulesQuery.data?.modulos || [];
    return modules.reduce<Record<string, typeof modules>>((acc, module) => {
      acc[module.categoria] = acc[module.categoria] || [];
      acc[module.categoria].push(module);
      return acc;
    }, {});
  }, [modulesQuery.data]);

  const enabledCount = Object.values(draft).filter(Boolean).length;
  const toggle = (id: SystemModuleId, mandatory: boolean) => {
    if (mandatory || !modulesQuery.data?.canManage) return;
    setDraft((current) => ({ ...current, [id]: !current[id] }));
    setDirty(true);
  };

  const save = async () => {
    const input: SaveSystemModuleInput[] = (modulesQuery.data?.modulos || [])
      .filter((module) => !module.obrigatorio)
      .map((module) => ({ id: module.id, habilitado: draft[module.id] !== false }));
    try {
      await saveMutation.mutateAsync(input);
      setDirty(false);
    } catch {
      // O erro da mutation permanece visível no banner abaixo.
    }
  };

  if (modulesQuery.isLoading) {
    return <div className="sub-loading">Carregando módulos do escritório...</div>;
  }

  return (
    <div className="modules-config">
      <section className="modules-config-hero">
        <div className="modules-config-hero-icon"><Boxes size={28} /></div>
        <div>
          <span className="modules-config-kicker">Arquitetura do escritório</span>
          <h2>Módulos do Sistema</h2>
          <p>Escolha o que aparece e pode ser aberto pela equipe. Desativar um módulo não apaga seus dados.</p>
        </div>
        <div className="modules-config-score">
          <strong>{enabledCount}</strong>
          <span>módulos ativos</span>
        </div>
      </section>

      {modulesQuery.data?.available === false && (
        <div className="modules-config-notice">
          <ShieldCheck size={18} /> A migration de módulos ainda não foi aplicada. O sistema permanece com todos os módulos visíveis.
        </div>
      )}
      {modulesQuery.data?.available !== false && !modulesQuery.data?.canManage && (
        <div className="modules-config-notice">
          <ShieldCheck size={18} /> Apenas gestor ou administrador pode alterar esta configuração.
        </div>
      )}
      {modulesQuery.error && <div className="error-banner">Não foi possível carregar os módulos.</div>}
      {saveMutation.error && <div className="error-banner">{saveMutation.error.message}</div>}
      <div className="modules-config-notice">
        <ShieldCheck size={18} /> A disponibilidade de módulos complementa os perfis de acesso; permissões individuais continuam sendo administradas em Usuários e Perfis.
      </div>

      <div className="modules-config-groups">
        {Object.entries(groups).map(([group, modules]) => (
          <section key={group} className="modules-config-group">
            <header><span>{group}</span><small>{modules.filter((module) => draft[module.id] !== false).length}/{modules.length}</small></header>
            <div className="modules-config-grid">
              {modules.map((module) => {
                const enabled = module.obrigatorio || draft[module.id] !== false;
                return (
                  <button
                    type="button"
                    key={module.id}
                    className={`modules-config-card ${enabled ? 'enabled' : 'disabled'}`}
                    onClick={() => toggle(module.id, module.obrigatorio)}
                    disabled={module.obrigatorio || !modulesQuery.data?.canManage}
                    aria-pressed={enabled}
                  >
                    <span className="modules-config-card-state">
                      {module.obrigatorio ? <LockKeyhole size={15} /> : <span className="modules-config-switch"><i /></span>}
                    </span>
                    <strong>{module.nome}</strong>
                    <p>{module.descricao}</p>
                    <small>{module.obrigatorio ? 'Essencial' : enabled ? 'Ativo para a equipe' : 'Oculto para a equipe'}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="modules-config-actions">
        <span>{dirty ? 'Existem alterações não salvas.' : <><CheckCircle2 size={15} /> Configuração sincronizada.</>}</span>
        <button type="button" className="btn-save-settings" disabled={!dirty || saveMutation.isPending} onClick={save}>
          <Save size={16} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar módulos'}
        </button>
      </footer>
    </div>
  );
};
