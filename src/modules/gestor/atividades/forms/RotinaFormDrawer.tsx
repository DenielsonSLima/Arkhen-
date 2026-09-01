import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, Repeat2, X } from 'lucide-react';
import type { ClienteEmpresa, ModeloAtividade } from '../services/atividadesService';
import {
  todayKey,
  type CategoriaAtividade,
  type FrequenciaAtividade,
  type PrioridadeAtividade,
  type RotinaAtividade,
  type UsuarioAtividade,
} from '../services/rotinasAtividadesService';
import {
  getRotinaEditableExecutionDate,
  getRotinaEditableModelId,
} from '../utils/rotinasWorkspace';
import './RotinaFormDrawer.css';

interface RotinaFormDrawerProps {
  company: ClienteEmpresa;
  modelos: ModeloAtividade[];
  usuarios: UsuarioAtividade[];
  rotina?: RotinaAtividade | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (rotina: RotinaAtividade) => Promise<void>;
}

const FREQUENCIAS: Array<{ value: FrequenciaAtividade; label: string }> = [
  { value: 'Diária', label: 'Diária' },
  { value: 'Semanal', label: 'Semanal' },
  { value: 'Quinzenal', label: 'Quinzenal' },
  { value: 'Mensal', label: 'Mensal' },
  { value: 'Bimestral', label: 'Bimestral (a cada 2 meses)' },
  { value: 'Trimestral', label: 'Trimestral' },
  { value: 'Semestral', label: 'Semestral' },
  { value: 'Anual', label: 'Anual (a cada 12 meses)' },
  { value: 'Personalizada', label: 'Personalizada' },
];

const CATEGORIAS: CategoriaAtividade[] = [
  'Cliente',
  'Fiscal',
  'Folha',
  'Contábil',
  'Controle',
  'Interna',
];

const PRIORIDADES: PrioridadeAtividade[] = ['Baixa', 'Média', 'Alta'];

const getCompanyModels = (company: ClienteEmpresa, modelos: ModeloAtividade[]) => {
  const activeIds = new Set(company.modelosAtivos || []);
  return modelos.filter((modelo) => activeIds.has(modelo.id) || activeIds.has(modelo.codigo || ''));
};

const createInitialForm = (
  company: ClienteEmpresa,
  availableModels: ModeloAtividade[],
  rotina?: RotinaAtividade | null,
): RotinaAtividade => {
  if (rotina) {
    const availableModelIds = new Set(availableModels.map((modelo) => modelo.id));
    return {
      ...rotina,
      modeloId: getRotinaEditableModelId(rotina.modeloId, availableModelIds),
      proximaExecucao: getRotinaEditableExecutionDate(rotina),
      reancorarAgenda: false,
    };
  }

  const firstModel = availableModels[0];
  return {
    id: '',
    modeloId: firstModel?.id,
    clienteId: company.id,
    cliente: company.nome,
    nome: firstModel?.nome || '',
    categoria: 'Cliente',
    frequencia: 'Mensal',
    intervaloDias: 30,
    responsavel: '',
    proximaExecucao: todayKey(),
    reancorarAgenda: true,
    prioridade: 'Média',
    ativa: true,
    checklist: firstModel?.etapas?.length ? firstModel.etapas : ['Executar atividade'],
    observacoes: '',
    incluirFinaisDeSemana: false,
  };
};

export const RotinaFormDrawer: React.FC<RotinaFormDrawerProps> = ({
  company,
  modelos,
  usuarios,
  rotina,
  isSaving,
  onClose,
  onSave,
}) => {
  const availableModels = useMemo(() => getCompanyModels(company, modelos), [company, modelos]);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [form, setForm] = useState(() => createInitialForm(company, availableModels, rotina));
  const [formError, setFormError] = useState('');
  const isProtocolRoutine = Boolean(rotina?.protocoloCodigo);
  const canSubmit = Boolean(
    form.nome.trim()
    && form.responsavelConfigUsuarioId
    && form.proximaExecucao,
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  const handleModelChange = (modeloId: string) => {
    const modelo = availableModels.find((item) => item.id === modeloId);
    setForm((current) => ({
      ...current,
      modeloId: modelo?.id,
      nome: modelo?.nome || current.nome,
      checklist: modelo?.etapas?.length ? modelo.etapas : current.checklist,
    }));
  };

  const handleResponsibleChange = (configUsuarioId: string) => {
    const usuario = usuarios.find((item) => item.configUsuarioId === configUsuarioId);
    setForm((current) => ({
      ...current,
      responsavelConfigUsuarioId: usuario?.configUsuarioId,
      responsavelUserId: usuario?.userId,
      responsavel: usuario?.nome || '',
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!canSubmit) {
      setFormError('Preencha o nome, a primeira execução e o responsável.');
      return;
    }

    const checklist = form.checklist.map((item) => item.trim()).filter(Boolean);
    try {
      await onSave({
        ...form,
        clienteId: company.id,
        cliente: company.nome,
        intervaloDias: form.frequencia === 'Personalizada'
          ? Math.max(1, Number(form.intervaloDias || 1))
          : form.intervaloDias,
        checklist: checklist.length ? checklist : ['Executar atividade'],
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a rotina.');
    }
  };

  return createPortal(
    <div className="rotinas-drawer-backdrop">
      <aside
        ref={drawerRef}
        className="rotinas-drawer rotinas-drawer--fullscreen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rotina-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="rotinas-drawer__header">
          <div className="rotinas-drawer__header-inner">
            <div>
              <span className="rotinas-eyebrow"><Repeat2 size={14} /> {company.nome}</span>
              <h2 id="rotina-form-title">{rotina ? 'Editar rotina' : 'Nova rotina recorrente'}</h2>
            </div>
            <button ref={closeRef} type="button" className="rotinas-icon-button" onClick={onClose} aria-label="Fechar formulário">
              <X size={19} />
            </button>
          </div>
        </header>

        <form className="rotinas-form" onSubmit={handleSubmit}>
          <label className="rotinas-field">
            <span>Checklist base (opcional)</span>
            <select
              value={form.modeloId || ''}
              onChange={(event) => handleModelChange(event.target.value)}
              disabled={isProtocolRoutine}
            >
              <option value="">Rotina manual, sem modelo</option>
              {availableModels.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}
            </select>
          </label>

          <label className="rotinas-field">
            <span>Nome da rotina</span>
            <input
              value={form.nome}
              onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
              disabled={isProtocolRoutine}
              placeholder="Ex.: Conferência da folha"
              required
            />
          </label>

          <div className="rotinas-form__grid">
            <label className="rotinas-field">
              <span>Categoria</span>
              <select
                value={form.categoria}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  categoria: event.target.value as CategoriaAtividade,
                }))}
                disabled={isProtocolRoutine}
              >
                {CATEGORIAS.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
            </label>

            <label className="rotinas-field">
              <span>Frequência</span>
              <select
                value={form.frequencia}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  frequencia: event.target.value as FrequenciaAtividade,
                }))}
                disabled={isProtocolRoutine}
              >
                {FREQUENCIAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          {form.frequencia === 'Personalizada' ? (
            <label className="rotinas-field">
              <span>Intervalo em dias</span>
              <input
                type="number"
                min={1}
                value={form.intervaloDias}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  intervaloDias: Number(event.target.value),
                }))}
                disabled={isProtocolRoutine}
              />
            </label>
          ) : null}

          <div className="rotinas-form__grid">
            <label className="rotinas-field">
              <span><CalendarClock size={14} /> Primeira execução</span>
              <input
                type="date"
                value={form.proximaExecucao}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  proximaExecucao: event.target.value,
                  reancorarAgenda: !rotina
                    || event.target.value !== getRotinaEditableExecutionDate(rotina),
                }))}
                disabled={isProtocolRoutine}
                required
              />
            </label>

            <label className="rotinas-field">
              <span>Prioridade</span>
              <select
                value={form.prioridade}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  prioridade: event.target.value as PrioridadeAtividade,
                }))}
                disabled={isProtocolRoutine}
              >
                {PRIORIDADES.map((prioridade) => <option key={prioridade}>{prioridade}</option>)}
              </select>
            </label>
          </div>

          <label className="rotinas-field">
            <span>Responsável padrão</span>
            <select
              value={form.responsavelConfigUsuarioId || ''}
              onChange={(event) => handleResponsibleChange(event.target.value)}
              required
            >
              <option value="">Selecione um usuário</option>
              {usuarios.map((usuario) => (
                <option key={usuario.configUsuarioId} value={usuario.configUsuarioId}>{usuario.nome}</option>
              ))}
            </select>
          </label>

          {!isProtocolRoutine ? (
            <>
              <label className="rotinas-field">
                <span>Etapas do checklist (uma por linha)</span>
                <textarea
                  rows={5}
                  value={form.checklist.join('\n')}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    checklist: event.target.value.split('\n'),
                  }))}
                />
              </label>

              <label className="rotinas-field">
                <span>Observações</span>
                <textarea
                  rows={3}
                  value={form.observacoes}
                  onChange={(event) => setForm((current) => ({ ...current, observacoes: event.target.value }))}
                />
              </label>

              <label className="rotinas-checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(form.incluirFinaisDeSemana)}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    incluirFinaisDeSemana: event.target.checked,
                  }))}
                />
                Incluir finais de semana na agenda
              </label>
            </>
          ) : (
            <div className="rotinas-inline-info">
              Esta rotina veio do cadastro do parceiro. Aqui você pode alterar o responsável; recorrência e conteúdo continuam sendo definidos no parceiro.
            </div>
          )}

          {formError ? <p className="rotinas-form__error" role="alert">{formError}</p> : null}

          <footer className="rotinas-drawer__footer">
            <button type="button" className="rotinas-button rotinas-button--secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="rotinas-button rotinas-button--primary" disabled={!canSubmit || isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar rotina'}
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body,
  );
};
