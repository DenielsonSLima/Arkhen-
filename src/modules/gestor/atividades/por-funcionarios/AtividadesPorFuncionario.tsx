import React, { useMemo, useState } from 'react';
import { BarChart3, BriefcaseBusiness, Calendar, CalendarDays, ClipboardList, Layers, ListChecks, Plus, Trash2, User } from 'lucide-react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';

type FuncionarioTab = 'atividades' | 'diarias' | 'semanais' | 'mensais' | 'empresa' | 'internas' | 'controle' | 'gerir';
type StatusGestao = 'Pendente' | 'Em andamento' | 'Concluída';
type TipoTarefa = 'Diária' | 'Semanal' | 'Mensal' | 'Interna' | 'Cliente' | 'Controle';

interface AtividadeGerenciada {
  id: string;
  titulo: string;
  tipo: TipoTarefa;
  responsavel: string;
  cliente: string;
  prazo: string;
  status: StatusGestao;
}

interface Props {
  companyGroups: CompanyActivityGroup[];
  handleToggleStep: (instanciaId: string, etapa: string, value: boolean) => Promise<void>;
}

const BASE_RESPONSAVEIS = ['Karine', 'João Silva', 'Pedro', 'Fernanda'];

const tabs: Array<{ id: FuncionarioTab; label: string; icon: React.ReactNode }> = [
  { id: 'atividades', label: 'Atividades', icon: <ClipboardList size={16} /> },
  { id: 'diarias', label: 'Diárias', icon: <CalendarDays size={16} /> },
  { id: 'semanais', label: 'Semanal', icon: <Calendar size={16} /> },
  { id: 'mensais', label: 'Mensal', icon: <BarChart3 size={16} /> },
  { id: 'empresa', label: 'Por Empresa', icon: <BriefcaseBusiness size={16} /> },
  { id: 'internas', label: 'Internas', icon: <ListChecks size={16} /> },
  { id: 'controle', label: 'Controle Andamento', icon: <Layers size={16} /> },
  { id: 'gerir', label: 'Gerir Tarefas', icon: <Plus size={16} /> },
];

const getPct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export const AtividadesPorFuncionario: React.FC<Props> = ({ companyGroups, handleToggleStep }) => {
  const [selectedResponsavel, setSelectedResponsavel] = useState('Karine');
  const [activeTab, setActiveTab] = useState<FuncionarioTab>('atividades');
  const [atividades, setAtividades] = useState<AtividadeGerenciada[]>([]);
  const [form, setForm] = useState({
    titulo: '',
    tipo: 'Diária' as TipoTarefa,
    responsavel: 'Karine',
    cliente: 'Escritório',
    prazo: 'Hoje',
  });

  const clientes = useMemo(() => {
    const nomes = companyGroups.map((group) => group.clienteNome);
    return ['Escritório', ...Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b))];
  }, [companyGroups]);

  const responsaveis = useMemo(() => {
    const nomes = new Set(BASE_RESPONSAVEIS);
    companyGroups.forEach((group) => nomes.add(group.responsavel));
    atividades.forEach((atividade) => nomes.add(atividade.responsavel));
    return Array.from(nomes);
  }, [atividades, companyGroups]);

  const assignedGroups = companyGroups.filter((group) => group.responsavel === selectedResponsavel);
  const managedByUser = atividades.filter((atividade) => atividade.responsavel === selectedResponsavel);
  const companyTotal = assignedGroups.reduce((acc, group) => acc + group.atividades.length, 0);
  const companyDone = assignedGroups.reduce((acc, group) => acc + group.atividades.filter((atv) => atv.status === 'Concluída').length, 0);
  const managedDone = managedByUser.filter((atividade) => atividade.status === 'Concluída').length;
  const totalTasks = companyTotal + managedByUser.length;
  const completedTasks = companyDone + managedDone;

  const saveAtividades = (next: AtividadeGerenciada[]) => {
    setAtividades(next);
  };

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.titulo.trim()) return;
    saveAtividades([
      { id: `gestao-${Date.now()}`, titulo: form.titulo.trim(), tipo: form.tipo, responsavel: form.responsavel, cliente: form.cliente, prazo: form.prazo, status: 'Pendente' },
      ...atividades,
    ]);
    setForm((current) => ({ ...current, titulo: '' }));
  };

  const updateTask = (id: string, patch: Partial<AtividadeGerenciada>) => {
    saveAtividades(atividades.map((atividade) => (atividade.id === id ? { ...atividade, ...patch } : atividade)));
  };

  const deleteTask = (id: string) => {
    saveAtividades(atividades.filter((atividade) => atividade.id !== id));
  };

  const getTasksForTab = () => {
    if (activeTab === 'diarias') return managedByUser.filter((atividade) => atividade.tipo === 'Diária');
    if (activeTab === 'semanais') return managedByUser.filter((atividade) => atividade.tipo === 'Semanal');
    if (activeTab === 'mensais') return managedByUser.filter((atividade) => atividade.tipo === 'Mensal');
    if (activeTab === 'internas') return managedByUser.filter((atividade) => atividade.tipo === 'Interna');
    if (activeTab === 'controle') return managedByUser.filter((atividade) => atividade.tipo === 'Controle');
    return managedByUser;
  };

  const renderManagedTasks = (items = getTasksForTab()) => (
    <div className="funcionario-task-list">
      {items.map((atividade) => (
        <div key={atividade.id} className="funcionario-task-card">
          <input value={atividade.titulo} onChange={(event) => updateTask(atividade.id, { titulo: event.target.value })} />
          <select value={atividade.tipo} onChange={(event) => updateTask(atividade.id, { tipo: event.target.value as TipoTarefa })}>
            <option value="Diária">Diária</option>
            <option value="Semanal">Semanal</option>
            <option value="Mensal">Mensal</option>
            <option value="Interna">Interna</option>
            <option value="Cliente">Cliente</option>
            <option value="Controle">Controle</option>
          </select>
          <select value={atividade.status} onChange={(event) => updateTask(atividade.id, { status: event.target.value as StatusGestao })}>
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluída">Concluída</option>
          </select>
          <span>{atividade.cliente} • {atividade.prazo}</span>
          <button type="button" onClick={() => deleteTask(atividade.id)} title="Excluir tarefa"><Trash2 size={15} /></button>
        </div>
      ))}
      {items.length === 0 && <div className="empty-state-card"><ClipboardList size={36} className="empty-state-icon" /><p>Nenhuma tarefa nessa aba para {selectedResponsavel}.</p></div>}
    </div>
  );

  const renderCompanyTasks = () => (
    <div className="funcionario-company-list">
      {assignedGroups.map((group) => (
        <div key={group.id} className="tab-pane funcionario-company-card">
          <div className="funcionario-company-head">
            <div>
              <strong>{group.clienteNome}</strong>
              <span>CNPJ: {group.cnpj}</span>
            </div>
            <span className={`table-badge ${group.statusGeral === 'Concluída' ? 'badge-status-concl' : 'badge-status-and'}`}>{group.statusGeral} ({group.progressoGeral}%)</span>
          </div>
          {group.atividades.map((atv) => (
            <div key={atv.instanciaId} className="funcionario-company-activity">
              <div className="funcionario-company-activity-head">
                <span>{atv.modeloNome}</span>
                <b>{atv.status} ({atv.progresso}%)</b>
              </div>
              <div className="funcionario-check-grid">
                {Object.keys(atv.checklists).map((etapa) => (
                  <label key={etapa}>
                    <input type="checkbox" checked={atv.checklists[etapa]} onChange={(event) => handleToggleStep(atv.instanciaId, etapa, event.target.checked)} />
                    <span>{etapa}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      {assignedGroups.length === 0 && <div className="empty-state-card"><BriefcaseBusiness size={36} className="empty-state-icon" /><p>Nenhuma empresa vinculada a {selectedResponsavel}.</p></div>}
    </div>
  );

  const renderContent = () => {
    if (activeTab === 'empresa') return renderCompanyTasks();
    if (activeTab === 'gerir') {
      return (
        <div className="funcionario-gerir-grid">
          <form onSubmit={handleAdd} className="calc-form-card funcionario-gerir-form">
            <h3><Plus size={16} color="#c59235" /> Nova tarefa para funcionário</h3>
            <div className="calc-field"><label>Tarefa</label><input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} placeholder="Ex: Validar pendências fiscais" /></div>
            <div className="calc-field"><label>Tipo</label><select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value as TipoTarefa })}><option value="Diária">Diária</option><option value="Semanal">Semanal</option><option value="Mensal">Mensal</option><option value="Interna">Interna</option><option value="Cliente">Cliente</option><option value="Controle">Controle</option></select></div>
            <div className="calc-field"><label>Responsável</label><select value={form.responsavel} onChange={(event) => setForm({ ...form, responsavel: event.target.value })}>{responsaveis.map((responsavel) => <option key={responsavel} value={responsavel}>{responsavel}</option>)}</select></div>
            <div className="calc-field"><label>Cliente / Origem</label><select value={form.cliente} onChange={(event) => setForm({ ...form, cliente: event.target.value })}>{clientes.map((cliente) => <option key={cliente} value={cliente}>{cliente}</option>)}</select></div>
            <div className="calc-field"><label>Prazo</label><select value={form.prazo} onChange={(event) => setForm({ ...form, prazo: event.target.value })}><option value="Hoje">Hoje</option><option value="Esta semana">Esta semana</option><option value="Este mês">Este mês</option><option value="Sem prazo">Sem prazo</option></select></div>
            <button type="submit" className="btn-add-user">Criar e distribuir</button>
          </form>
          <div>{renderManagedTasks(atividades)}</div>
        </div>
      );
    }
    if (activeTab === 'controle') return renderManagedTasks(getTasksForTab());
    return renderManagedTasks();
  };

  return (
    <div className="funcionario-atividades-page">
      <div className="atividades-filter-header" style={{ marginTop: 0 }}>
        <div>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Atividades por Funcionários</h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0 0' }}>Gestor acompanha usuários, distribui tarefas e filtra por tipo de rotina.</p>
        </div>
      </div>

      <div className="funcionario-user-grid">
        {responsaveis.map((resp) => {
          const groups = companyGroups.filter((group) => group.responsavel === resp);
          const managed = atividades.filter((atividade) => atividade.responsavel === resp);
          const done = groups.reduce((acc, group) => acc + group.atividades.filter((atv) => atv.status === 'Concluída').length, 0) + managed.filter((atividade) => atividade.status === 'Concluída').length;
          const total = groups.reduce((acc, group) => acc + group.atividades.length, 0) + managed.length;
          const active = selectedResponsavel === resp;
          return (
            <button key={resp} type="button" className={`funcionario-user-card ${active ? 'active' : ''}`} onClick={() => setSelectedResponsavel(resp)}>
              <span><User size={16} /> {resp}</span>
              <strong>{getPct(done, total)}%</strong>
              <small>{done}/{total} tarefas</small>
              <div className="atividade-period-track"><div style={{ width: `${getPct(done, total)}%` }} /></div>
            </button>
          );
        })}
      </div>

      <div className="funcionario-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="atividades-metrics-grid funcionario-metrics">
        <div className="atividade-metric-card"><span className="metric-label-small">Funcionário</span><span className="metric-value-large">{selectedResponsavel}</span></div>
        <div className="atividade-metric-card"><span className="metric-label-small">Empresas</span><span className="metric-value-large">{assignedGroups.length}</span></div>
        <div className="atividade-metric-card"><span className="metric-label-small">Tarefas</span><span className="metric-value-large">{totalTasks}</span></div>
        <div className="atividade-metric-card"><span className="metric-label-small">Progresso</span><span className="metric-value-large gold-text">{getPct(completedTasks, totalTasks)}%</span></div>
      </div>

      {renderContent()}
    </div>
  );
};
