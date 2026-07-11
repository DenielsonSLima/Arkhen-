import React from 'react';
import { CalendarDays, Clock3, LockKeyhole, Plus, ShieldCheck, X } from 'lucide-react';
import type { PerfilAcesso } from '../../perfis/services/perfisService';
import type { SaveUsuarioInput, UsuarioAccessInterval, UsuarioStatus } from '../services/usuariosService';
import { getPermissaoLabel } from '../../perfis/services/permissoesCatalog';
import './UsuarioForm.css';

const diasSemana = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const weekdays = [1, 2, 3, 4, 5];
const allDays = [0, 1, 2, 3, 4, 5, 6];
const defaultMessage = 'Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor.';

interface UsuarioFormProps {
  value: SaveUsuarioInput;
  perfis: PerfilAcesso[];
  isSaving: boolean;
  onChange: (value: SaveUsuarioInput) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

export const UsuarioForm: React.FC<UsuarioFormProps> = ({
  value,
  perfis,
  isSaving,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const setField = <K extends keyof SaveUsuarioInput>(field: K, fieldValue: SaveUsuarioInput[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const setAccess = (patch: Partial<SaveUsuarioInput['accessConfig']>) => {
    onChange({ ...value, accessConfig: { ...value.accessConfig, ...patch } });
  };

  const updateInterval = (index: number, patch: Partial<UsuarioAccessInterval>) => {
    const intervals = value.accessConfig.intervals.map((interval, currentIndex) => (
      currentIndex === index ? { ...interval, ...patch } : interval
    ));
    setAccess({ intervals });
  };

  const toggleDay = (day: number) => {
    const days = value.accessConfig.days.includes(day)
      ? value.accessConfig.days.filter((item) => item !== day)
      : [...value.accessConfig.days, day].sort();
    setAccess({ days });
  };

  const removeInterval = (index: number) => {
    const intervals = value.accessConfig.intervals.filter((_, currentIndex) => currentIndex !== index);
    setAccess({ intervals: intervals.length > 0 ? intervals : [{ start: '08:00', end: '18:00' }] });
  };

  const applyAccessPreset = (preset: 'livre' | 'comercial' | 'personalizado') => {
    if (preset === 'livre') {
      setAccess({ enabled: false, days: weekdays, intervals: [{ start: '08:00', end: '18:00' }], message: value.accessConfig.message || defaultMessage });
      return;
    }
    if (preset === 'comercial') {
      setAccess({ enabled: true, days: weekdays, intervals: [{ start: '08:00', end: '18:00' }], message: value.accessConfig.message || defaultMessage });
      return;
    }
    setAccess({
      enabled: true,
      days: value.accessConfig.days.length > 0 ? value.accessConfig.days : weekdays,
      intervals: value.accessConfig.intervals.length > 0 ? value.accessConfig.intervals : [{ start: '08:00', end: '18:00' }],
      message: value.accessConfig.message || defaultMessage,
    });
  };

  const setIntervalPreset = (preset: 'comercial' | 'almoco') => {
    setAccess({
      intervals: preset === 'almoco'
        ? [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }]
        : [{ start: '08:00', end: '18:00' }],
    });
  };

  const isWeekdays = value.accessConfig.days.length === weekdays.length
    && weekdays.every((day) => value.accessConfig.days.includes(day));
  const isCommercialHours = value.accessConfig.intervals.length === 1
    && value.accessConfig.intervals[0]?.start === '08:00'
    && value.accessConfig.intervals[0]?.end === '18:00';
  const activePreset = !value.accessConfig.enabled
    ? 'livre'
    : isWeekdays && isCommercialHours
      ? 'comercial'
      : 'personalizado';
  const selectedDaysLabel = value.accessConfig.days.length === 0
    ? 'Nenhum dia selecionado'
    : value.accessConfig.days.length === 7
      ? 'Todos os dias'
      : diasSemana.filter((day) => value.accessConfig.days.includes(day.value)).map((day) => day.label).join(', ');
  const selectedIntervalsLabel = value.accessConfig.enabled
    ? value.accessConfig.intervals.map((interval) => `${interval.start} às ${interval.end}`).join(' / ')
    : 'Sem bloqueio por horário';

  const selectedPerfilObj = perfis.find((p) => p.nome === value.perfil);

  const isEdit = !!value.id;
  const title = isEdit ? 'Editar Usuário' : 'Cadastrar Usuário';
  const subtitle = isEdit
    ? 'Clique em salvar para aplicar os dados e regras de acesso.'
    : 'O usuário ficará pendente até confirmar o acesso no Supabase Auth.';

  return (
    <div className="usuario-modal-wrapper animate-fade-in">
      <div className="usuario-modal-header">
        <div>
          <h3>{title}</h3>
          <span className="usuario-modal-subtitle">{subtitle}</span>
        </div>
        <button
          type="button"
          className="usuario-modal-close-btn"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="usuario-modal-form">
        <div className="usuario-modal-content-scroll">
          <div className="usuario-modal-columns">
            {/* Coluna Esquerda: Dados Gerais */}
            <div className="usuario-modal-col-left">
              <div className="usuario-section-title-wrapper">
                <span className="usuario-access-eyebrow">Identificação</span>
                <h4>Dados do Usuário</h4>
              </div>

              <div className="usuario-fields-grid">
                <div className="form-item-group span-2">
                  <label>Nome Completo</label>
                  <input
                    value={value.nome}
                    onChange={(e) => setField('nome', e.target.value)}
                    disabled={isSaving}
                    required
                    placeholder="Digite o nome completo"
                  />
                </div>

                <div className="form-item-group span-2">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={value.email}
                    onChange={(e) => setField('email', e.target.value)}
                    disabled={isSaving}
                    required
                    placeholder="exemplo@email.com"
                  />
                </div>

                <div className="form-item-group">
                  <label>CPF</label>
                  <input
                    value={value.cpf}
                    onChange={(e) => setField('cpf', e.target.value)}
                    disabled={isSaving}
                    required
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="form-item-group">
                  <label>Telefone</label>
                  <input
                    value={value.telefone}
                    onChange={(e) => setField('telefone', e.target.value)}
                    disabled={isSaving}
                    required
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="form-item-group">
                  <label>Perfil de Acesso</label>
                  <select
                    value={value.perfil}
                    onChange={(e) => setField('perfil', e.target.value)}
                    disabled={isSaving}
                  >
                    {perfis.map((perfil) => (
                      <option key={perfil.id} value={perfil.nome}>
                        {perfil.nome}
                      </option>
                    ))}
                    {perfis.length === 0 && (
                      <option value={value.perfil}>{value.perfil}</option>
                    )}
                  </select>
                </div>

                <div className="form-item-group">
                  <label>Status</label>
                  <select
                    value={value.status}
                    onChange={(e) => setField('status', e.target.value as UsuarioStatus)}
                    disabled={isSaving}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {selectedPerfilObj && (
                <div className="usuario-perfil-permissoes-info animate-fade-in">
                  <div className="usuario-perfil-info-header">
                    <span className="usuario-access-eyebrow">Acesso Liberado</span>
                    <h5>
                      {selectedPerfilObj.nome} —{' '}
                      {selectedPerfilObj.permissoes?.length || 0}{' '}
                      {selectedPerfilObj.permissoes?.length === 1 ? 'permissão' : 'permissões'}
                    </h5>
                  </div>
                  {selectedPerfilObj.descricao && (
                    <p className="usuario-perfil-info-desc">
                      {selectedPerfilObj.descricao}
                    </p>
                  )}
                  <div className="usuario-perfil-permissoes-list">
                    {selectedPerfilObj.permissoes && selectedPerfilObj.permissoes.length > 0 ? (
                      selectedPerfilObj.permissoes.map((permKey) => {
                        const label = getPermissaoLabel(permKey);
                        return (
                          <span key={permKey} className="usuario-permissao-badge">
                            {label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="usuario-permissao-empty">
                        Nenhuma permissão associada a este perfil.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Coluna Direita: Controle de Acesso */}
            <div className="usuario-modal-col-right">
              <section className="usuario-access-section">
                <div className="usuario-access-header">
                  <div>
                    <span className="usuario-access-eyebrow">Controle de acesso</span>
                    <h4>Defina um padrão de entrada</h4>
                  </div>
                  <span
                    className={`usuario-access-status ${
                      value.accessConfig.enabled ? 'restricted' : 'open'
                    }`}
                  >
                    {value.accessConfig.enabled ? (
                      <LockKeyhole size={13} />
                    ) : (
                      <ShieldCheck size={13} />
                    )}
                    {value.accessConfig.enabled ? 'Restrito' : 'Livre'}
                  </span>
                </div>

                <div
                  className="usuario-access-presets"
                  role="group"
                  aria-label="Padrões de acesso do usuário"
                >
                  <button
                    type="button"
                    className={`usuario-preset-card ${
                      activePreset === 'livre' ? 'active' : ''
                    }`}
                    onClick={() => applyAccessPreset('livre')}
                    disabled={isSaving}
                  >
                    <ShieldCheck size={18} />
                    <strong>Acesso livre</strong>
                    <span>Sem bloqueio por dia ou horário.</span>
                  </button>
                  <button
                    type="button"
                    className={`usuario-preset-card ${
                      activePreset === 'comercial' ? 'active' : ''
                    }`}
                    onClick={() => applyAccessPreset('comercial')}
                    disabled={isSaving}
                  >
                    <Clock3 size={18} />
                    <strong>Horário comercial</strong>
                    <span>Segunda a sexta, das 08:00 às 18:00.</span>
                  </button>
                  <button
                    type="button"
                    className={`usuario-preset-card ${
                      activePreset === 'personalizado' ? 'active' : ''
                    }`}
                    onClick={() => applyAccessPreset('personalizado')}
                    disabled={isSaving}
                  >
                    <CalendarDays size={18} />
                    <strong>Personalizado</strong>
                    <span>Escolha dias, faixas e mensagem.</span>
                  </button>
                </div>

                <div className="usuario-access-summary">
                  <span>{selectedDaysLabel}</span>
                  <strong>{selectedIntervalsLabel}</strong>
                </div>
              </section>

              {value.accessConfig.enabled && (
                <section className="usuario-access-editor">
                  <div className="usuario-editor-row">
                    <div>
                      <label>Dias permitidos</label>
                      <p>Marque os dias em que o login poderá ser realizado.</p>
                    </div>
                    <div className="usuario-quick-actions">
                      <button
                        type="button"
                        onClick={() => setAccess({ days: weekdays })}
                        disabled={isSaving}
                      >
                        Dias úteis
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccess({ days: allDays })}
                        disabled={isSaving}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccess({ days: [] })}
                        disabled={isSaving}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="usuario-days-grid">
                    {diasSemana.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        className={`usuario-day-button ${
                          value.accessConfig.days.includes(day.value) ? 'active' : ''
                        }`}
                        onClick={() => toggleDay(day.value)}
                        disabled={isSaving}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>

                  <div className="usuario-editor-row">
                    <div>
                      <label>Intervalos permitidos</label>
                      <p>Use um ou mais períodos no mesmo dia.</p>
                    </div>
                    <div className="usuario-quick-actions">
                      <button
                        type="button"
                        onClick={() => setIntervalPreset('comercial')}
                        disabled={isSaving}
                      >
                        08-18
                      </button>
                      <button
                        type="button"
                        onClick={() => setIntervalPreset('almoco')}
                        disabled={isSaving}
                      >
                        Com almoço
                      </button>
                    </div>
                  </div>

                  <div className="usuario-interval-list">
                    {value.accessConfig.intervals.map((interval, index) => (
                      <div key={index} className="usuario-interval-row">
                        <div className="usuario-time-field">
                          <span>Início</span>
                          <input
                            type="time"
                            value={interval.start}
                            onChange={(e) =>
                              updateInterval(index, { start: e.target.value })
                            }
                            disabled={isSaving}
                          />
                        </div>
                        <div className="usuario-time-field">
                          <span>Fim</span>
                          <input
                            type="time"
                            value={interval.end}
                            onChange={(e) =>
                              updateInterval(index, { end: e.target.value })
                            }
                            disabled={isSaving}
                          />
                        </div>
                        <button
                          type="button"
                          className="usuario-remove-interval"
                          onClick={() => removeInterval(index)}
                          disabled={isSaving}
                          aria-label="Remover intervalo"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="usuario-add-interval"
                      onClick={() =>
                        setAccess({
                          intervals: [
                            ...value.accessConfig.intervals,
                            { start: '08:00', end: '18:00' },
                          ],
                        })
                      }
                      disabled={isSaving}
                    >
                      <Plus size={14} />
                      Adicionar intervalo
                    </button>
                  </div>

                  <div className="form-item-group">
                    <label>Mensagem ao tentar acessar fora do período</label>
                    <textarea
                      className="usuario-access-message"
                      value={value.accessConfig.message}
                      onChange={(e) => setAccess({ message: e.target.value })}
                      rows={3}
                      disabled={isSaving}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        <div className="usuario-modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="btn-cancel"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-invite" disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Usuário'}
          </button>
        </div>
      </form>
    </div>
  );
};
