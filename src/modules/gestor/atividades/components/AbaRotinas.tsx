import React, { useMemo, useState } from 'react';
import { Plus, Repeat, Trash2, Edit, X, ClipboardCheck } from 'lucide-react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import {
  todayKey,
  type CategoriaAtividade,
  type FrequenciaAtividade,
  type PrioridadeAtividade,
  type RotinaAtividade,
} from '../services/rotinasAtividadesService';

const blankRotina = (): RotinaAtividade => ({
  id: '',
  nome: '',
  categoria: 'Interna',
  frequencia: 'Diária',
  intervaloDias: 1,
  responsavel: '',
  cliente: 'Escritório',
  proximaExecucao: todayKey(),
  prioridade: 'Média',
  ativa: true,
  checklist: [''],
  observacoes: '',
});

type FiltroRotinaTab = 'todas' | 'diarias' | 'semanais' | 'mensais' | 'empresa';

export const AbaRotinas: React.FC = () => {
  const { rotinas, usuarios, saveRotina, deleteRotina } = useAtividadesWorkspace();
  const [form, setForm] = useState<RotinaAtividade>(blankRotina());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FiltroRotinaTab>('todas');

  const clientes = useMemo(() => ['Escritório'], []);

  const handleEditClick = (rotina: RotinaAtividade) => {
    setForm(rotina);
    setIsDrawerOpen(true);
  };

  const handleCreateClick = () => {
    setForm(blankRotina());
    setIsDrawerOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim()) return;
    const checklist = form.checklist.map((item) => item.trim()).filter(Boolean);
    saveRotina({
      ...form,
      responsavelUserId: usuarios.find((usuario) => usuario.configUsuarioId === form.responsavelConfigUsuarioId)?.userId,
      id: form.id || `rotina-${Date.now()}`,
      checklist: checklist.length > 0 ? checklist : ['Executar atividade'],
      intervaloDias: form.frequencia === 'Personalizada' ? Math.max(1, form.intervaloDias) : form.intervaloDias,
    });
    setForm(blankRotina());
    setIsDrawerOpen(false);
  };

  const setChecklistText = (value: string) => {
    setForm({ ...form, checklist: value.split('\n') });
  };

  // Filtragem com base nas abas
  const filteredRotinas = useMemo(() => {
    return rotinas.filter((r) => {
      if (activeTab === 'todas') return true;
      if (activeTab === 'diarias') return r.frequencia === 'Diária';
      if (activeTab === 'semanais') return r.frequencia === 'Semanal';
      if (activeTab === 'mensais') return r.frequencia === 'Mensal';
      if (activeTab === 'empresa') return r.cliente !== 'Escritório';
      return true;
    });
  }, [rotinas, activeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Topo com ação principal */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button onClick={handleCreateClick} style={primaryBtnStyle} type="button">
          <Plus size={16} /> Cadastrar Checklist
        </button>
      </div>

      {/* Abas de Categorias */}
      <div style={tabsWrapperStyle}>
        <div style={tabsContainerStyle}>
          {(['todas', 'diarias', 'semanais', 'mensais', 'empresa'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...tabBtnStyle,
                borderBottomColor: activeTab === tab ? 'var(--color-gold-primary)' : 'transparent',
                color: activeTab === tab ? 'var(--color-gold-dark)' : '#64748b',
                fontWeight: activeTab === tab ? 700 : 500,
              }}
            >
              {tab === 'todas' && 'Todos os Modelos'}
              {tab === 'diarias' && 'Diárias'}
              {tab === 'semanais' && 'Semanais'}
              {tab === 'mensais' && 'Mensais'}
              {tab === 'empresa' && 'Por Empresa'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
          {filteredRotinas.length} modelos encontrados
        </div>
      </div>

      {/* Grid de Cards dos Modelos Cadastrados */}
      {filteredRotinas.length === 0 ? (
        <div className="empty-state-card" style={emptyCardStyle}>
          <Repeat size={40} color="var(--color-gold-primary)" />
          <p style={{ marginTop: '12px', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
            Nenhum modelo de checklist cadastrado nesta categoria.
          </p>
        </div>
      ) : (
        <div style={gridContainerStyle}>
          {filteredRotinas.map((rotina) => (
            <article key={rotina.id} style={rotinaCardStyle}>
              {/* Header do Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', lineHeight: '1.3' }}>
                    {rotina.nome}
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    Frequência: <strong>{rotina.frequencia}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button onClick={() => handleEditClick(rotina)} style={iconBtnStyle} title="Editar checklist" type="button">
                    <Edit size={13} />
                  </button>
                  <button onClick={() => deleteRotina(rotina.id)} style={{ ...iconBtnStyle, color: '#ef4444' }} title="Excluir checklist" type="button">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Informações Centrais do Modelo */}
              <div style={cardMetaStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={metaLabelStyle}>Responsável Padrão</span>
                  <span style={metaValStyle}>{rotina.responsavel}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={metaLabelStyle}>Cliente / Vínculo</span>
                  <span style={metaValStyle}>{rotina.cliente}</span>
                </div>
              </div>

              {/* Etapas do Checklist */}
              {rotina.checklist && rotina.checklist.length > 0 && (
                <div style={checklistBlockStyle}>
                  <strong style={{ fontSize: '0.72rem', color: 'var(--color-gold-dark)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <ClipboardCheck size={12} /> Etapas do Checklist:
                  </strong>
                  <ul style={checklistListStyle}>
                    {rotina.checklist.slice(0, 3).map((item, i) => (
                      <li key={i} style={checklistItemStyle}>• {item}</li>
                    ))}
                    {rotina.checklist.length > 3 && (
                      <li style={{ ...checklistItemStyle, color: '#64748b', fontStyle: 'italic' }}>
                        + {rotina.checklist.length - 3} mais etapas...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Footer do Card */}
              <div style={cardFooterStyle}>
                <span style={{
                  ...badgeStyle,
                  backgroundColor: 'rgba(197, 146, 53, 0.1)',
                  color: 'var(--color-gold-dark)',
                }}>
                  {rotina.categoria}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                  Prioridade: <strong>{rotina.prioridade}</strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Gaveta Lateral Flutuante (Quick Drawer) do Formulário */}
      {isDrawerOpen && (
        <div style={drawerOverlayStyle} onClick={() => setIsDrawerOpen(false)}>
          <div style={drawerContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={drawerHeaderStyle}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Repeat size={18} color="var(--color-gold-primary)" />
                {form.id ? 'Editar Checklist Recorrente' : 'Cadastrar Checklist Recorrente'}
              </h3>
              <button onClick={() => setIsDrawerOpen(false)} style={closeBtnStyle} type="button">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Nome do Checklist</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Fechamento Fiscal Mensal"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={rowStyle}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaAtividade })}
                    style={selectStyle}
                  >
                    <option value="Interna">Interna</option>
                    <option value="Cliente">Cliente</option>
                    <option value="Fiscal">Fiscal</option>
                    <option value="Folha">Folha</option>
                    <option value="Contábil">Contábil</option>
                    <option value="Controle">Controle</option>
                  </select>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Recorrência</label>
                  <select
                    value={form.frequencia}
                    onChange={(e) => setForm({ ...form, frequencia: e.target.value as FrequenciaAtividade })}
                    style={selectStyle}
                  >
                    <option value="Diária">Diária</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Quinzenal">Quinzenal</option>
                    <option value="Mensal">Mensal</option>
                    <option value="Personalizada">A cada X dias</option>
                  </select>
                </div>
              </div>

              {form.frequencia === 'Personalizada' && (
                <div style={fieldStyle}>
                  <label style={labelStyle}>Intervalo em dias</label>
                  <input
                    type="number"
                    min={1}
                    value={form.intervaloDias}
                    onChange={(e) => setForm({ ...form, intervaloDias: Number(e.target.value) })}
                    style={inputStyle}
                  />
                </div>
              )}

              <div style={rowStyle}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Responsável Padrão</label>
                  <select
                    value={form.responsavelConfigUsuarioId || ''}
                    onChange={(e) => {
                      const usuario = usuarios.find((item) => item.configUsuarioId === e.target.value);
                      setForm({
                        ...form,
                        responsavel: usuario?.nome || '',
                        responsavelUserId: usuario?.userId,
                        responsavelConfigUsuarioId: usuario?.configUsuarioId,
                      });
                    }}
                    style={selectStyle}
                  >
                    <option value="">Selecione</option>
                    {usuarios.map((usuario) => (
                      <option key={usuario.configUsuarioId} value={usuario.configUsuarioId}>{usuario.nome}</option>
                    ))}
                  </select>
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Cliente / Vínculo</label>
                  <select
                    value={form.cliente}
                    onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                    style={selectStyle}
                  >
                    {clientes.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={rowStyle}>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Próxima Execução</label>
                  <input
                    type="date"
                    value={form.proximaExecucao}
                    onChange={(e) => setForm({ ...form, proximaExecucao: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...fieldStyle, flex: 1 }}>
                  <label style={labelStyle}>Prioridade</label>
                  <select
                    value={form.prioridade}
                    onChange={(e) => setForm({ ...form, prioridade: e.target.value as PrioridadeAtividade })}
                    style={selectStyle}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Etapas do Checklist (Uma por linha)</label>
                <textarea
                  value={form.checklist.join('\n')}
                  onChange={(e) => setChecklistText(e.target.value)}
                  placeholder="Ex: Conciliar caixa&#10;Gerar guias&#10;Enviar e-mail para cliente"
                  rows={4}
                  style={textareaStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Observações / Instruções</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Instruções e links de apoio..."
                  rows={2}
                  style={textareaStyle}
                />
              </div>

              <div style={drawerActionsStyle}>
                <button onClick={() => setIsDrawerOpen(false)} style={cancelBtnStyle} type="button">
                  Cancelar
                </button>
                <button type="submit" style={submitBtnStyle}>
                  {form.id ? 'Salvar Alterações' : 'Salvar Modelo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Estilos Tema Claro
const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 16px',
  color: '#ffffff',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  boxShadow: '0 4px 10px rgba(197, 146, 53, 0.15)',
};

const tabsWrapperStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  flexWrap: 'wrap' as const,
  gap: '12px',
};

const tabsContainerStyle = {
  display: 'flex',
  gap: '16px',
};

const tabBtnStyle = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  padding: '8px 4px',
  fontSize: '0.82rem',
  cursor: 'pointer',
  color: '#64748b',
  outline: 'none',
  transition: 'all 0.18s ease',
};

const gridContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '16px',
};

const rotinaCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.02)',
  justifyContent: 'space-between',
};

const iconBtnStyle = {
  backgroundColor: '#f1f5f9',
  border: 'none',
  borderRadius: '4px',
  padding: '5px',
  color: 'var(--color-gold-dark)',
  cursor: 'pointer',
  display: 'flex',
};

const cardMetaStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  borderTop: '1px solid #f1f5f9',
  borderBottom: '1px solid #f1f5f9',
  padding: '10px 0',
};

const metaLabelStyle = {
  fontSize: '0.66rem',
  color: '#64748b',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const metaValStyle = {
  fontSize: '0.78rem',
  color: '#0f172a',
  fontWeight: 700,
};

const checklistBlockStyle = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '8px 10px',
};

const checklistListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '4px 0 0 0',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '4px',
};

const checklistItemStyle = {
  fontSize: '0.75rem',
  color: '#334155',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

const cardFooterStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '4px',
};

const badgeStyle = {
  fontSize: '0.65rem',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: '4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const emptyCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px dashed #cbd5e1',
  borderRadius: '8px',
  padding: '40px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
};

/* Estilos da Gaveta Lateral (Drawer) */
const drawerOverlayStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(3px)',
  zIndex: 1000,
  display: 'flex',
  justifyContent: 'flex-end',
};

const drawerContentStyle = {
  width: '100%',
  maxWidth: '460px',
  backgroundColor: '#ffffff',
  height: '100%',
  boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16px',
  overflowY: 'auto' as const,
};

const drawerHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: '14px',
};

const closeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
};

const formStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '14px',
};

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '5px',
};

const rowStyle = {
  display: 'flex',
  gap: '12px',
};

const labelStyle = {
  fontSize: '0.75rem',
  color: 'var(--color-gold-dark)',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const inputStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#0f172a',
  fontSize: '0.82rem',
  outline: 'none',
  width: '100%',
};

const selectStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#0f172a',
  fontSize: '0.82rem',
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
};

const textareaStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#0f172a',
  fontSize: '0.82rem',
  outline: 'none',
  resize: 'vertical' as const,
  width: '100%',
};

const drawerActionsStyle = {
  display: 'flex',
  gap: '12px',
  marginTop: '12px',
};

const submitBtnStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 16px',
  color: '#ffffff',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  flex: 1,
  boxShadow: '0 2px 6px rgba(197, 146, 53, 0.2)',
};

const cancelBtnStyle = {
  backgroundColor: 'transparent',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '10px 16px',
  color: '#64748b',
  fontSize: '0.82rem',
  fontWeight: 500,
  cursor: 'pointer',
};
