import React, { useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { TarefaGestorList } from '../components/TarefaGestorList';
import {
  RESPONSAVEIS_ATIVIDADES,
  todayKey,
  type CategoriaAtividade,
  type TarefaGestor,
} from '../services/rotinasAtividadesService';

interface AtividadesEquipeProps {
  companyGroups: CompanyActivityGroup[];
}

type EquipeFiltro = 'Todas' | 'Diária' | 'Semanal' | 'Quinzenal' | 'Mensal' | 'Interna' | 'Por Empresa';

const filtros: EquipeFiltro[] = ['Todas', 'Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Interna', 'Por Empresa'];
const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export const AtividadesEquipe: React.FC<AtividadesEquipeProps> = ({ companyGroups }) => {
  const { tarefas, saveTarefa, updateTarefa, deleteTarefa, toggleChecklist } = useAtividadesWorkspace();
  const [selectedUser, setSelectedUser] = useState(RESPONSAVEIS_ATIVIDADES[0]);
  const [filter, setFilter] = useState<EquipeFiltro>('Todas');
  const [form, setForm] = useState({
    titulo: '',
    frequencia: 'Única' as TarefaGestor['frequencia'],
    categoria: 'Interna' as CategoriaAtividade,
    vencimento: todayKey(),
  });

  const users = useMemo(() => {
    const names = new Set(RESPONSAVEIS_ATIVIDADES);
    tarefas.forEach((task) => names.add(task.responsavel));
    companyGroups.forEach((group) => names.add(group.responsavel));
    return Array.from(names);
  }, [companyGroups, tarefas]);

  const selectedTasks = tarefas.filter((task) => {
    if (task.responsavel !== selectedUser) return false;
    if (filter === 'Todas') return true;
    if (filter === 'Interna') return task.categoria === 'Interna';
    if (filter === 'Por Empresa') return task.categoria === 'Cliente' || task.cliente !== 'Escritório';
    return task.frequencia === filter;
  });

  const companyTasks = companyGroups.filter((group) => group.responsavel === selectedUser);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.titulo.trim()) return;
    saveTarefa({
      id: `manual-${Date.now()}`,
      titulo: form.titulo.trim(),
      categoria: form.categoria,
      frequencia: form.frequencia,
      responsavel: selectedUser,
      cliente: form.categoria === 'Interna' ? 'Escritório' : 'Cliente',
      vencimento: form.vencimento,
      prioridade: 'Média',
      status: 'Pendente',
      origem: 'Manual',
      checklist: [{ titulo: 'Executar tarefa', concluida: false }],
      notas: '',
    });
    setForm({ ...form, titulo: '' });
  };

  return (
    <div className="atividades-redesign-page">
      <div className="atividades-redesign-header">
        <div>
          <h2>Atividades - Equipe</h2>
          <p>Gestão por funcionário: distribuição, acompanhamento e execução das tarefas.</p>
        </div>
        <span>{users.length} usuários</span>
      </div>

      <div className="funcionario-user-grid">
        {users.map((user) => {
          const userTasks = tarefas.filter((task) => task.responsavel === user);
          const company = companyGroups.filter((group) => group.responsavel === user);
          const done = userTasks.filter((task) => task.status === 'Concluída').length + company.reduce((acc, group) => acc + group.atividades.filter((activity) => activity.status === 'Concluída').length, 0);
          const total = userTasks.length + company.reduce((acc, group) => acc + group.atividades.length, 0);
          const progress = pct(done, total);
          return (
            <button key={user} type="button" className={`funcionario-user-card ${selectedUser === user ? 'active' : ''}`} onClick={() => setSelectedUser(user)}>
              <span><Users size={16} /> {user}</span>
              <strong>{progress}%</strong>
              <small>{done}/{total} tarefas</small>
              <div className="atividade-period-track"><div style={{ width: `${progress}%` }} /></div>
            </button>
          );
        })}
      </div>

      <div className="atividades-segmented">
        {filtros.map((item) => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}
      </div>

      <div className="atividades-two-column">
        <section className="atividades-panel-card">
          <div className="atividades-section-title"><Users size={18} /><h3>Tarefas de {selectedUser}</h3></div>
          <TarefaGestorList
            tarefas={selectedTasks}
            emptyText="Nenhuma tarefa encontrada para este filtro."
            onUpdate={updateTarefa}
            onDelete={deleteTarefa}
            onToggleChecklist={toggleChecklist}
          />
          {filter === 'Por Empresa' && companyTasks.map((group) => (
            <div key={group.id} className="atividades-company-compact">
              <strong>{group.clienteNome}</strong>
              <span>{group.atividades.length} obrigações • {group.progressoGeral}% concluído</span>
            </div>
          ))}
        </section>

        <form onSubmit={handleCreate} className="atividades-panel-card atividades-equipe-form">
          <div className="atividades-section-title"><Plus size={18} /><h3>Nova tarefa para {selectedUser}</h3></div>
          <div className="calc-field"><label>Tarefa</label><input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} placeholder="Ex: Revisar pendências do e-CAC" /></div>
          <div className="calc-field"><label>Tipo</label><select value={form.frequencia} onChange={(event) => setForm({ ...form, frequencia: event.target.value as TarefaGestor['frequencia'] })}><option value="Única">Única</option><option value="Diária">Diária</option><option value="Semanal">Semanal</option><option value="Quinzenal">Quinzenal</option><option value="Mensal">Mensal</option></select></div>
          <div className="calc-field"><label>Categoria</label><select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value as CategoriaAtividade })}><option value="Interna">Interna</option><option value="Cliente">Cliente</option><option value="Fiscal">Fiscal</option><option value="Folha">Folha</option><option value="Contábil">Contábil</option><option value="Controle">Controle</option></select></div>
          <div className="calc-field"><label>Vencimento</label><input type="date" value={form.vencimento} onChange={(event) => setForm({ ...form, vencimento: event.target.value })} /></div>
          <button type="submit" className="btn-add-user">Distribuir tarefa</button>
        </form>
      </div>
    </div>
  );
};
