import React from 'react';
import type { PerfilAcesso } from '../../perfis/services/perfisService';
import type { SaveUsuarioInput, UsuarioAccessInterval, UsuarioStatus } from '../services/usuariosService';

const diasSemana = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

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

  return (
    <form onSubmit={onSubmit} className="config-form popup-form animate-fade-in">
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div className="form-item-group">
          <label>Nome Completo</label>
          <input value={value.nome} onChange={(e) => setField('nome', e.target.value)} disabled={isSaving} required />
        </div>
        <div className="form-item-group">
          <label>CPF</label>
          <input value={value.cpf} onChange={(e) => setField('cpf', e.target.value)} disabled={isSaving} required />
        </div>
        <div className="form-item-group">
          <label>E-mail</label>
          <input type="email" value={value.email} onChange={(e) => setField('email', e.target.value)} disabled={isSaving} required />
        </div>
        <div className="form-item-group">
          <label>Telefone</label>
          <input value={value.telefone} onChange={(e) => setField('telefone', e.target.value)} disabled={isSaving} required />
        </div>
        <div className="form-item-group">
          <label>Perfil de Acesso</label>
          <select value={value.perfil} onChange={(e) => setField('perfil', e.target.value)} disabled={isSaving}>
            {perfis.map((perfil) => (
              <option key={perfil.id} value={perfil.nome}>{perfil.nome}</option>
            ))}
            {perfis.length === 0 && <option value={value.perfil}>{value.perfil}</option>}
          </select>
        </div>
        <div className="form-item-group">
          <label>Status</label>
          <select value={value.status} onChange={(e) => setField('status', e.target.value as UsuarioStatus)} disabled={isSaving}>
            <option value="Ativo">Ativo</option>
            <option value="Pendente">Pendente</option>
            <option value="Inativo">Inativo</option>
          </select>
        </div>
      </div>

      <div className="form-item-group" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={value.accessConfig.enabled}
            onChange={(e) => setAccess({ enabled: e.target.checked })}
            disabled={isSaving}
          />
          Restringir acesso por dia e horário
        </label>
      </div>

      {value.accessConfig.enabled && (
        <>
          <div className="form-item-group">
            <label>Dias permitidos</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {diasSemana.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`btn-back ${value.accessConfig.days.includes(day.value) ? '' : 'btn-cancel'}`}
                  onClick={() => toggleDay(day.value)}
                  disabled={isSaving}
                  style={{ padding: '7px 10px' }}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-item-group">
            <label>Intervalos permitidos</label>
            {value.accessConfig.intervals.map((interval, index) => (
              <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <input type="time" value={interval.start} onChange={(e) => updateInterval(index, { start: e.target.value })} disabled={isSaving} />
                <input type="time" value={interval.end} onChange={(e) => updateInterval(index, { end: e.target.value })} disabled={isSaving} />
              </div>
            ))}
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setAccess({ intervals: [...value.accessConfig.intervals, { start: '08:00', end: '18:00' }] })}
              disabled={isSaving}
            >
              + Adicionar intervalo
            </button>
          </div>

          <div className="form-item-group">
            <label>Mensagem ao tentar acessar fora do período</label>
            <textarea
              value={value.accessConfig.message}
              onChange={(e) => setAccess({ message: e.target.value })}
              rows={3}
              disabled={isSaving}
            />
          </div>
        </>
      )}

      <div className="popup-form-buttons">
        <button type="button" onClick={onCancel} className="btn-cancel" disabled={isSaving}>
          Cancelar
        </button>
        <button type="submit" className="btn-invite" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Usuário'}
        </button>
      </div>
    </form>
  );
};
