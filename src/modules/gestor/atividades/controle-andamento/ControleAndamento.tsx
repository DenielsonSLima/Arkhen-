import React, { useMemo, useState } from 'react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import { TarefaGestorList } from '../components/TarefaGestorList';

interface Props {
  companyGroups: CompanyActivityGroup[];
}

export const ControleAndamento: React.FC<Props> = ({ companyGroups }) => {
  const { tarefas, updateTarefa, deleteTarefa, toggleChecklist } = useAtividadesWorkspace();
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [responsavelFilter, setResponsavelFilter] = useState('Todos');
  const milestoneModels = [
    { id: 'folha', label: 'Folha' },
    { id: 'prolabore', label: 'Pró-Labore' },
    { id: 'dctfweb', label: 'DCTFWeb' },
    { id: 'obrigacoes', label: 'Faturas/Obrigações' },
    { id: 'obras', label: 'Obras' }
  ];
  const responsaveis = useMemo(() => Array.from(new Set(tarefas.map((task) => task.responsavel))).sort(), [tarefas]);
  const filteredTasks = tarefas.filter((task) => (
    (statusFilter === 'Todos' || task.status === statusFilter) &&
    (responsavelFilter === 'Todos' || task.responsavel === responsavelFilter)
  ));

  return (
    <div className="atividades-redesign-page">
      <div className="atividades-redesign-header">
        <div>
          <h2>Atividades - Controle</h2>
          <p>Visão geral de status, responsáveis, prazos e andamento por empresa.</p>
        </div>
        <span>{filteredTasks.length} tarefas</span>
      </div>

      <div className="atividades-toolbar">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="Todos">Todos os status</option>
          <option value="Pendente">Pendentes</option>
          <option value="Em andamento">Em andamento</option>
          <option value="Concluída">Concluídas</option>
        </select>
        <select value={responsavelFilter} onChange={(event) => setResponsavelFilter(event.target.value)}>
          <option value="Todos">Todos os responsáveis</option>
          {responsaveis.map((responsavel) => <option key={responsavel} value={responsavel}>{responsavel}</option>)}
        </select>
      </div>

      <section className="atividades-panel-card">
        <TarefaGestorList
          tarefas={filteredTasks}
          emptyText="Nenhuma tarefa encontrada com esses filtros."
          onUpdate={updateTarefa}
          onDelete={deleteTarefa}
          onToggleChecklist={toggleChecklist}
        />
      </section>

      <div className="submodule-content-card" style={{ padding: '20px' }}>
        <div className="atividades-section-title"><h3>Matriz por empresa</h3></div>
        <div className="table-responsive" style={{ marginTop: 0 }}>
          <table className="config-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '12px 10px' }}>Cliente / CNPJ</th>
                <th style={{ textAlign: 'left', padding: '12px 10px' }}>Regime</th>
                {milestoneModels.map((m) => (
                  <th key={m.id} style={{ textAlign: 'center', padding: '12px 10px' }}>{m.label}</th>
                ))}
                <th style={{ textAlign: 'center', padding: '12px 10px', width: '180px' }}>Progresso Geral</th>
              </tr>
            </thead>
            <tbody>
              {companyGroups.map((group) => (
                <tr key={group.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{group.clienteNome}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{group.cnpj}</div>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <span className={`partner-badge ${group.regime === 'Simples Nacional' ? 'mei' : group.regime === 'Lucro Presumido' ? 'lucro-presumido' : 'lucro-real'}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                      {group.regime}
                    </span>
                  </td>

                  {/* Milestones status */}
                  {milestoneModels.map((m) => {
                    const atv = group.atividades.find((a) => a.modeloId === m.id);
                    if (!atv) {
                      return (
                        <td key={m.id} style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.75rem', fontStyle: 'italic' }}>
                          —
                        </td>
                      );
                    }

                    let badgeColor = '#94a3b8'; // pending
                    let bg = '#f1f5f9';
                    if (atv.status === 'Concluída') {
                      badgeColor = '#10b981';
                      bg = '#ecfdf5';
                    } else if (atv.status === 'Em andamento') {
                      badgeColor = '#f59e0b';
                      bg = '#fffbeb';
                    }

                    return (
                      <td key={m.id} style={{ textAlign: 'center', padding: '8px 5px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: badgeColor,
                            backgroundColor: bg,
                            border: `1px solid ${badgeColor}22`
                          }}
                        >
                          {atv.progresso}%
                        </span>
                      </td>
                    );
                  })}

                  {/* Progresso Geral Bar */}
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${group.progressoGeral}%`,
                            backgroundColor: group.progressoGeral === 100 ? '#10b981' : 'var(--color-gold-primary)',
                            height: '100%',
                            borderRadius: '4px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <strong style={{ minWidth: '35px', textAlign: 'right', fontSize: '0.78rem', color: group.progressoGeral === 100 ? '#10b981' : '#0f172a' }}>
                        {group.progressoGeral}%
                      </strong>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
