import React, { useMemo, useState } from 'react';
import { Plus, Repeat, Trash2, Edit, X, ClipboardCheck } from 'lucide-react';
import { RotinaProgramadaForm } from '../forms/RotinaProgramadaForm';
import {
  blankRotinaProgramadaForm,
  buildRotinaFromForm,
  rotinaToProgramadaForm,
  validateRotinaProgramadaForm,
} from '../forms/rotinaProgramadaFormModel';
import { useAtividadesModelos } from '../hooks/useAtividadesModelos';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import {
  primaryBtnStyle,
  tabsWrapperStyle,
  tabsContainerStyle,
  tabBtnStyle,
  gridContainerStyle,
  rotinaCardStyle,
  iconBtnStyle,
  cardMetaStyle,
  metaLabelStyle,
  metaValStyle,
  checklistBlockStyle,
  checklistListStyle,
  checklistItemStyle,
  cardFooterStyle,
  badgeStyle,
  emptyCardStyle,
  drawerOverlayStyle,
  drawerContentStyle,
  drawerHeaderStyle,
  closeBtnStyle,
  cancelBtnStyle,
} from './AbaRotinas.styles';
import type { RotinaAtividade } from '../services/rotinasAtividadesService';

type FiltroRotinaTab = 'todas' | 'diarias' | 'semanais' | 'mensais' | 'empresa';

interface AbaRotinasProps {
  onConfigureModels?: () => void;
}

export const AbaRotinas: React.FC<AbaRotinasProps> = ({ onConfigureModels }) => {
  const { rotinas, usuarios, clientes, saveRotinaAsync, deleteRotina, isSaving } = useAtividadesWorkspace();
  const {
    modelos,
    isLoadingModelos,
    isModelosError,
    reloadModelos,
  } = useAtividadesModelos();
  const [form, setForm] = useState(blankRotinaProgramadaForm);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FiltroRotinaTab>('todas');
  const [formError, setFormError] = useState('');

  const handleEditClick = (rotina: RotinaAtividade) => {
    setFormError('');
    setForm(rotinaToProgramadaForm(rotina));
    setIsDrawerOpen(true);
  };

  const handleCreateClick = () => {
    setFormError('');
    setForm(blankRotinaProgramadaForm());
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateRotinaProgramadaForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (!modelos.some((modelo) => modelo.id === form.modeloId)) {
      setFormError('O modelo selecionado não está mais disponível. Recarregue e escolha outro modelo.');
      return;
    }
    setFormError('');
    try {
      await saveRotinaAsync(buildRotinaFromForm(form));
      setForm(blankRotinaProgramadaForm());
      setIsDrawerOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a rotina.');
    }
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
          <Plus size={16} /> Nova rotina
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
              {tab === 'todas' && 'Todas as rotinas'}
              {tab === 'diarias' && 'Diárias'}
              {tab === 'semanais' && 'Semanais'}
              {tab === 'mensais' && 'Mensais'}
              {tab === 'empresa' && 'Por Empresa'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
          {filteredRotinas.length} rotinas encontradas
        </div>
      </div>

      {/* Grid de Cards dos Modelos Cadastrados */}
      {filteredRotinas.length === 0 ? (
        <div className="empty-state-card" style={emptyCardStyle}>
          <Repeat size={40} color="var(--color-gold-primary)" />
          <p style={{ marginTop: '12px', fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
            {rotinas.length === 0
              ? 'Nenhuma rotina programada. Defina a recorrência, o responsável e a primeira execução.'
              : 'Nenhuma rotina encontrada nesta categoria.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" onClick={handleCreateClick} style={primaryBtnStyle}>
              <Plus size={15} /> {rotinas.length === 0 ? 'Criar primeira rotina' : 'Nova rotina'}
            </button>
            {rotinas.length === 0 && onConfigureModels && (
              <button type="button" onClick={onConfigureModels} style={cancelBtnStyle}>
                Revisar modelos de fechamento
              </button>
            )}
            {rotinas.length > 0 && activeTab !== 'todas' && (
              <button type="button" onClick={() => setActiveTab('todas')} style={cancelBtnStyle}>Ver todas</button>
            )}
          </div>
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
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    Modelo: <strong>{modelos.find((modelo) => modelo.id === rotina.modeloId)?.nome || 'Não vinculado'}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button onClick={() => handleEditClick(rotina)} style={iconBtnStyle} title="Editar rotina" type="button">
                    <Edit size={13} />
                  </button>
                  <button onClick={() => deleteRotina(rotina.id)} style={{ ...iconBtnStyle, color: '#ef4444' }} title="Arquivar rotina" type="button">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Informações Centrais do Modelo */}
              <div style={cardMetaStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={metaLabelStyle}>Responsável Padrão</span>
                  <span style={metaValStyle}>{rotina.responsavel || 'Sem responsável'}</span>
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
                    <ClipboardCheck size={12} /> Etapas da rotina:
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
          <div
            style={drawerContentStyle}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rotina-drawer-title"
          >
            <div style={drawerHeaderStyle}>
              <h3 id="rotina-drawer-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Repeat size={18} color="var(--color-gold-primary)" />
                {form.id ? 'Editar rotina programada' : 'Nova rotina programada'}
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={closeBtnStyle}
                type="button"
                aria-label="Fechar formulário de rotina"
              >
                <X size={18} />
              </button>
            </div>

            <RotinaProgramadaForm
              values={form}
              onChange={setForm}
              onSubmit={handleSubmit}
              onCancel={() => setIsDrawerOpen(false)}
              modelos={modelos}
              usuarios={usuarios}
              clientes={clientes}
              isLoadingModelos={isLoadingModelos}
              isModelosError={isModelosError}
              isSaving={isSaving}
              formError={formError}
              onRetryModelos={() => void reloadModelos()}
              onConfigureModels={onConfigureModels}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Estilos Tema Claro
