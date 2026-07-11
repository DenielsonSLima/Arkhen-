import React, { useEffect, useState } from 'react';
import { Check, Palette, X } from 'lucide-react';
import type { UsuarioAgenda } from '../services/agenda.service';

interface AgendaResponsavelCorModalProps {
  aberto: boolean;
  onClose: () => void;
  onSalvar: (usuarios: UsuarioAgenda[]) => void;
  usuarios: UsuarioAgenda[];
}

const normalizarCor = (valor: string) => {
  if (!valor || typeof valor !== 'string') return '#64748b';
  const cor = valor.trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cor)) {
    return '#64748b';
  }
  return cor.length === 4 ? `#${cor[1]}${cor[1]}${cor[2]}${cor[2]}${cor[3]}${cor[3]}` : cor;
};

const COR_DEF = '#64748b';

export const AgendaResponsavelCorModal: React.FC<AgendaResponsavelCorModalProps> = ({
  aberto,
  onClose,
  onSalvar,
  usuarios,
}) => {
  const [edicao, setEdicao] = useState<UsuarioAgenda[]>([]);

  useEffect(() => {
    if (!aberto) return;
    setEdicao(usuarios.map((usuario) => ({
      ...usuario,
      cor: normalizarCor(usuario.cor || COR_DEF),
    })));
  }, [aberto, usuarios]);

  const atualizar = (usuarioId: string, cor: string) => {
    setEdicao((atual) => atual.map((usuario) => (
      usuario.id === usuarioId ? { ...usuario, cor: normalizarCor(cor) } : usuario
    )));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSalvar(edicao);
    onClose();
  };

  if (!aberto) return null;

  return (
    <div className="agenda-config-modal-backdrop" onClick={onClose}>
      <div className="agenda-config-modal agenda-usuario-color-modal" onClick={(event) => event.stopPropagation()}>
        <div className="agenda-config-modal-header">
          <h2>
            <Palette size={16} />
            Cores dos Funcionários
          </h2>
          <button type="button" className="agenda-config-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="agenda-config-subtitle">
          Defina a cor que representa cada funcionário na visão do calendário e na legenda.
        </p>

        <form className="agenda-config-form" onSubmit={handleSubmit}>
          <div className="agenda-config-list">
            {edicao.map((usuario) => (
              <div key={usuario.id} className="agenda-config-item">
                <div className="agenda-config-item-title">
                  <span className="filtro-dot" style={{ backgroundColor: usuario.cor }} />
                  <div>
                    <strong>{usuario.nome}</strong>
                    <small>{usuario.perfil} • {usuario.status}</small>
                  </div>
                </div>
                <input
                  type="color"
                  value={usuario.cor}
                  onChange={(event) => atualizar(usuario.id, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="agenda-config-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-modal-save" type="submit">
              <Check size={14} />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
