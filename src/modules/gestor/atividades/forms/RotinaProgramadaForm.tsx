import React, { useEffect } from 'react';
import type { ModeloAtividade } from '../services/atividadesService';
import {
  todayKey,
  type CategoriaAtividade,
  type ClienteRotina,
  type FrequenciaAtividade,
  type PrioridadeAtividade,
  type UsuarioAtividade,
} from '../services/rotinasAtividadesService';
import {
  cancelBtnStyle,
  drawerActionsStyle,
  fieldStyle,
  formStyle,
  inputStyle,
  labelStyle,
  rowStyle,
  selectStyle,
  submitBtnStyle,
  textareaStyle,
} from '../components/AbaRotinas.styles';
import {
  ESCRITORIO_SCOPE_ID,
  applyModeloToRotinaForm,
  getModelosDisponiveisParaVinculo,
  isModeloPermitidoParaVinculo,
  type RotinaProgramadaFormValues,
} from './rotinaProgramadaFormModel';

interface RotinaProgramadaFormProps {
  values: RotinaProgramadaFormValues;
  onChange: React.Dispatch<React.SetStateAction<RotinaProgramadaFormValues>>;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  modelos: ModeloAtividade[];
  usuarios: UsuarioAtividade[];
  clientes: ClienteRotina[];
  isLoadingModelos: boolean;
  isModelosError: boolean;
  isSaving: boolean;
  formError: string;
  onRetryModelos: () => void;
  onConfigureModels?: () => void;
}

export const RotinaProgramadaForm: React.FC<RotinaProgramadaFormProps> = ({
  values,
  onChange,
  onSubmit,
  onCancel,
  modelos,
  usuarios,
  clientes,
  isLoadingModelos,
  isModelosError,
  isSaving,
  formError,
  onRetryModelos,
  onConfigureModels,
}) => {
  const modelosDisponiveis = getModelosDisponiveisParaVinculo(
    modelos,
    clientes,
    values.clienteScopeId,
  );
  const selectedModelo = modelosDisponiveis.find((modelo) => modelo.id === values.modeloId);

  useEffect(() => {
    if (!values.modeloId || !values.clienteScopeId) return;
    if (isModeloPermitidoParaVinculo(values.modeloId, values.clienteScopeId, clientes)) return;
    onChange((current) => current.modeloId === values.modeloId
      ? { ...current, modeloId: '', checklistText: '' }
      : current);
  }, [clientes, onChange, values.clienteScopeId, values.modeloId]);

  const handleModeloChange = (modeloId: string) => {
    const modelo = modelosDisponiveis.find((item) => item.id === modeloId);
    if (!modelo) {
      onChange((current) => ({ ...current, modeloId: '', checklistText: '' }));
      return;
    }
    onChange((current) => applyModeloToRotinaForm(current, modelo));
  };

  const handleResponsavelChange = (configUsuarioId: string) => {
    const usuario = usuarios.find((item) => item.configUsuarioId === configUsuarioId);
    onChange((current) => ({
      ...current,
      responsavel: usuario?.nome || '',
      responsavelUserId: usuario?.userId,
      responsavelConfigUsuarioId: usuario?.configUsuarioId || '',
    }));
  };

  const handleClienteChange = (clienteScopeId: string) => {
    const cliente = clientes.find((item) => item.id === clienteScopeId);
    onChange((current) => {
      const modeloContinuaPermitido = !current.modeloId
        || isModeloPermitidoParaVinculo(current.modeloId, clienteScopeId, clientes);
      return {
        ...current,
        clienteScopeId,
        clienteNome: clienteScopeId === ESCRITORIO_SCOPE_ID
          ? 'Escritório'
          : cliente?.nome || '',
        modeloId: modeloContinuaPermitido ? current.modeloId : '',
        checklistText: modeloContinuaPermitido ? current.checklistText : '',
      };
    });
  };

  return (
    <form onSubmit={onSubmit} style={formStyle} noValidate>
      {formError && (
        <div className="error-banner" role="alert" style={{ padding: '10px 12px' }}>
          {formError}
        </div>
      )}

      <div style={fieldStyle}>
        <label htmlFor="rotina-vinculo" style={labelStyle}>1. Cliente ou escritório</label>
        <select
          id="rotina-vinculo"
          value={values.clienteScopeId}
          onChange={(event) => handleClienteChange(event.target.value)}
          style={selectStyle}
          required
        >
          <option value="">Selecione o vínculo</option>
          <option value={ESCRITORIO_SCOPE_ID}>Escritório — rotina interna</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
          ))}
        </select>
        <small style={helpTextStyle}>A escolha do vínculo define quais modelos podem ser usados nesta rotina.</small>
      </div>

      <div style={fieldStyle}>
        <label htmlFor="rotina-modelo" style={labelStyle}>2. Modelo base do checklist</label>
        <select
          id="rotina-modelo"
          value={values.modeloId}
          onChange={(event) => handleModeloChange(event.target.value)}
          style={selectStyle}
          required
          disabled={!values.clienteScopeId || isLoadingModelos || isModelosError || modelosDisponiveis.length === 0}
        >
          <option value="">{values.clienteScopeId ? 'Selecione um modelo vinculado' : 'Escolha primeiro o vínculo'}</option>
          {modelosDisponiveis.map((modelo) => (
            <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
          ))}
        </select>
        <small style={helpTextStyle}>
          Para clientes, aparecem somente os modelos definidos em Modelos de fechamento › Vínculos por cliente.
        </small>
        {isLoadingModelos && <small style={statusTextStyle}>Carregando modelos disponíveis...</small>}
        {isModelosError && (
          <button type="button" onClick={onRetryModelos} style={inlineActionStyle}>
            Não foi possível carregar os modelos. Tentar novamente
          </button>
        )}
        {!isLoadingModelos && !isModelosError && modelos.length === 0 && (
          <div style={modelWarningStyle} role="status">
            <span>Nenhum modelo ativo. Cadastre o checklist técnico antes de programar a rotina.</span>
            {onConfigureModels && (
              <button type="button" onClick={onConfigureModels} style={inlineActionStyle}>
                Cadastrar modelo
              </button>
            )}
          </div>
        )}
        {!isLoadingModelos && !isModelosError && valoresTemVinculoSemModelo(values.clienteScopeId, modelos, modelosDisponiveis) && (
          <div style={modelWarningStyle} role="status">
            <span>Nenhum modelo está vinculado a este cliente.</span>
            {onConfigureModels && (
              <button type="button" onClick={onConfigureModels} style={inlineActionStyle}>
                Revisar vínculos por cliente
              </button>
            )}
          </div>
        )}
        {selectedModelo && (
          <div style={modelSummaryStyle} role="status">
            <strong>{selectedModelo.etapas.length} etapas herdadas</strong>
            <span>{selectedModelo.descricao || 'Checklist técnico selecionado.'}</span>
          </div>
        )}
      </div>

      <div style={fieldStyle}>
        <label htmlFor="rotina-nome" style={labelStyle}>3. Nome da rotina</label>
        <input
          id="rotina-nome"
          value={values.nome}
          onChange={(event) => onChange((current) => ({ ...current, nome: event.target.value }))}
          placeholder="Ex: Fechamento fiscal mensal"
          required
          style={inputStyle}
        />
      </div>

      <div style={rowStyle}>
        <div style={{ ...fieldStyle, flex: 1 }}>
          <label htmlFor="rotina-categoria" style={labelStyle}>4. Categoria</label>
          <select
            id="rotina-categoria"
            value={values.categoria}
            onChange={(event) => onChange((current) => ({
              ...current,
              categoria: event.target.value as CategoriaAtividade | '',
            }))}
            style={selectStyle}
            required
          >
            <option value="">Selecione</option>
            <option value="Interna">Interna</option>
            <option value="Cliente">Cliente</option>
            <option value="Fiscal">Fiscal</option>
            <option value="Folha">Folha</option>
            <option value="Contábil">Contábil</option>
            <option value="Controle">Controle</option>
          </select>
        </div>
        <div style={{ ...fieldStyle, flex: 1 }}>
          <label htmlFor="rotina-frequencia" style={labelStyle}>5. Recorrência</label>
          <select
            id="rotina-frequencia"
            value={values.frequencia}
            onChange={(event) => onChange((current) => ({
              ...current,
              frequencia: event.target.value as FrequenciaAtividade | '',
              intervaloDias: event.target.value === 'Personalizada' ? current.intervaloDias : '',
            }))}
            style={selectStyle}
            required
          >
            <option value="">Selecione</option>
            <option value="Diária">Diária</option>
            <option value="Semanal">Semanal</option>
            <option value="Quinzenal">Quinzenal</option>
            <option value="Mensal">Mensal</option>
            <option value="Personalizada">A cada X dias</option>
          </select>
        </div>
      </div>

      {values.frequencia === 'Personalizada' && (
        <div style={fieldStyle}>
          <label htmlFor="rotina-intervalo" style={labelStyle}>Intervalo em dias</label>
          <input
            id="rotina-intervalo"
            type="number"
            min={1}
            value={values.intervaloDias}
            onChange={(event) => onChange((current) => ({ ...current, intervaloDias: event.target.value }))}
            style={inputStyle}
            required
          />
        </div>
      )}

      <div style={rowStyle}>
        <div style={{ ...fieldStyle, flex: 1 }}>
          <label htmlFor="rotina-responsavel" style={labelStyle}>6. Responsável</label>
          <select
            id="rotina-responsavel"
            value={values.responsavelConfigUsuarioId}
            onChange={(event) => handleResponsavelChange(event.target.value)}
            style={selectStyle}
            required
          >
            <option value="">Selecione</option>
            {usuarios.map((usuario) => (
              <option key={usuario.configUsuarioId} value={usuario.configUsuarioId}>{usuario.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={rowStyle}>
        <div style={{ ...fieldStyle, flex: 1 }}>
          <label htmlFor="rotina-primeira-execucao" style={labelStyle}>7. Primeira execução</label>
          <input
            id="rotina-primeira-execucao"
            type="date"
            value={values.proximaExecucao}
            min={values.id ? undefined : todayKey()}
            onChange={(event) => onChange((current) => ({ ...current, proximaExecucao: event.target.value }))}
            style={inputStyle}
            required
          />
        </div>
        <div style={{ ...fieldStyle, flex: 1 }}>
          <label htmlFor="rotina-prioridade" style={labelStyle}>8. Prioridade</label>
          <select
            id="rotina-prioridade"
            value={values.prioridade}
            onChange={(event) => onChange((current) => ({
              ...current,
              prioridade: event.target.value as PrioridadeAtividade | '',
            }))}
            style={selectStyle}
            required
          >
            <option value="">Selecione</option>
            <option value="Baixa">Baixa</option>
            <option value="Média">Média</option>
            <option value="Alta">Alta</option>
          </select>
        </div>
      </div>

      <label style={checkboxStyle}>
        <input
          type="checkbox"
          checked={values.incluirFinaisDeSemana}
          onChange={(event) => onChange((current) => ({
            ...current,
            incluirFinaisDeSemana: event.target.checked,
          }))}
        />
        Permitir execuções em sábados e domingos
      </label>

      <div style={fieldStyle}>
        <label htmlFor="rotina-checklist" style={labelStyle}>Checklist herdado do modelo</label>
        <textarea
          id="rotina-checklist"
          value={values.checklistText}
          onChange={(event) => onChange((current) => ({ ...current, checklistText: event.target.value }))}
          placeholder="Selecione um modelo para carregar as etapas"
          rows={5}
          style={textareaStyle}
          required
        />
        <small style={helpTextStyle}>
          Esta é uma cópia para a rotina. Ajustes aqui não alteram o modelo técnico original.
        </small>
      </div>

      <div style={fieldStyle}>
        <label htmlFor="rotina-observacoes" style={labelStyle}>Observações e instruções</label>
        <textarea
          id="rotina-observacoes"
          value={values.observacoes}
          onChange={(event) => onChange((current) => ({ ...current, observacoes: event.target.value }))}
          placeholder="Regras, exceções e links de apoio"
          rows={2}
          style={textareaStyle}
        />
      </div>

      <div style={drawerActionsStyle}>
        <button onClick={onCancel} style={cancelBtnStyle} type="button">Cancelar</button>
        <button
          type="submit"
          disabled={isSaving || isLoadingModelos || isModelosError || modelosDisponiveis.length === 0}
          style={{ ...submitBtnStyle, opacity: isSaving ? 0.65 : 1 }}
        >
          {isSaving ? 'Salvando...' : values.id ? 'Salvar alterações' : 'Criar rotina'}
        </button>
      </div>
    </form>
  );
};

const valoresTemVinculoSemModelo = (
  clienteScopeId: string,
  modelos: ModeloAtividade[],
  modelosDisponiveis: ModeloAtividade[],
) => Boolean(
  clienteScopeId
  && clienteScopeId !== ESCRITORIO_SCOPE_ID
  && modelos.length > 0
  && modelosDisponiveis.length === 0,
);

const helpTextStyle = { color: '#64748b', fontSize: '0.74rem', lineHeight: 1.45 };
const statusTextStyle = { ...helpTextStyle, color: '#78571d', fontWeight: 700 };
const inlineActionStyle = {
  border: 0,
  background: 'transparent',
  color: '#946d25',
  padding: 0,
  cursor: 'pointer',
  fontWeight: 700,
  textAlign: 'left' as const,
};
const modelWarningStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
  padding: '10px',
  borderRadius: '8px',
  background: '#fff7ed',
  color: '#9a3412',
  fontSize: '0.76rem',
};
const modelSummaryStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '3px',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#475569',
  fontSize: '0.76rem',
};
const checkboxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: '#475569',
  fontSize: '0.8rem',
  cursor: 'pointer',
};
