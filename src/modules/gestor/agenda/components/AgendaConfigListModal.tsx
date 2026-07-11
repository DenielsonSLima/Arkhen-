import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { type EventoConfigItem } from '../services/agenda.service';

interface AgendaConfigListModalProps {
  aberto: boolean;
  titulo: string;
  itens: EventoConfigItem[];
  onClose: () => void;
  onSalvar: (itens: EventoConfigItem[]) => void;
}

const COR_PADRAO = '#64748b';

const normalizarCor = (valor: string) => {
  if (!valor || typeof valor !== 'string') return COR_PADRAO;
  const cor = valor.trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cor)) {
    return COR_PADRAO;
  }
  return cor.length === 4
    ? `#${cor[1]}${cor[1]}${cor[2]}${cor[2]}${cor[3]}${cor[3]}`
    : cor;
};

const normalizarHex = (valor: string) => normalizarCor(valor).toUpperCase();

const gerarCorFundo = (cor: string) => {
  const normalizado = normalizarCor(cor).replace('#', '');
  const r = parseInt(normalizado.slice(0, 2), 16);
  const g = parseInt(normalizado.slice(2, 4), 16);
  const b = parseInt(normalizado.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.14)`;
};

const removerAcentos = (valor: string) => valor.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const gerarIdBase = (valor: string) => removerAcentos(valor)
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const AgendaConfigListModal: React.FC<AgendaConfigListModalProps> = ({
  aberto,
  titulo,
  itens,
  onClose,
  onSalvar,
}) => {
  const [itensEditaveis, setItensEditaveis] = useState<EventoConfigItem[]>([]);
  const [novoItem, setNovoItem] = useState({ label: '', cor: COR_PADRAO });

  useEffect(() => {
    if (!aberto) {
      return;
    }
    setItensEditaveis(itens.map((item) => ({
      ...item,
      label: item.label,
      cor: normalizarHex(item.cor),
      corFundo: gerarCorFundo(item.cor),
      ativo: item.ativo,
    })));
    setNovoItem({ label: '', cor: COR_PADRAO });
  }, [aberto, itens]);

  const idsExistentes = useMemo(() => new Set(itensEditaveis.map((item) => item.id)), [itensEditaveis]);

  const atualizarItem = (id: string, patch: Partial<EventoConfigItem>) => {
    setItensEditaveis((anterior) => anterior.map((item) => (
      item.id === id
        ? {
          ...item,
          ...patch,
          cor: patch.cor ? normalizarHex(patch.cor) : item.cor,
          corFundo: patch.cor ? gerarCorFundo(patch.cor) : patch.ativo === false ? item.corFundo : item.corFundo,
        }
        : item
    )));
  };

  const adicionarItem = () => {
    const valor = novoItem.label.trim();
    if (!valor) return;

    const base = gerarIdBase(valor) || `item_${Date.now().toString(36).slice(-6)}`;
    const tentativa = (sufixo?: string) => (sufixo ? `${base}-${sufixo}` : base);
    let candidato = tentativa();
    let i = 1;
    while (idsExistentes.has(candidato)) {
      candidato = tentativa(i.toString());
      i += 1;
    }

    const novo: EventoConfigItem = {
      id: candidato,
      label: valor,
      cor: normalizarHex(novoItem.cor),
      corFundo: gerarCorFundo(novoItem.cor),
      ativo: true,
    };

    setItensEditaveis((anterior) => [...anterior, novo]);
    setNovoItem({ label: '', cor: COR_PADRAO });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSalvar(itensEditaveis.map((item) => ({
      ...item,
      cor: normalizarHex(item.cor),
      corFundo: gerarCorFundo(item.cor),
    })));
    onClose();
  };

  if (!aberto) return null;

  return (
    <div className="agenda-config-modal-backdrop" onClick={onClose}>
      <div className="agenda-config-modal" onClick={(event) => event.stopPropagation()}>
        <div className="agenda-config-modal-header">
          <h2>{titulo}</h2>
          <button type="button" className="agenda-config-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p className="agenda-config-subtitle">
          Cadastre, renomeie, mude a cor e ative/inative itens conforme a necessidade da agenda.
        </p>

        <form className="agenda-config-form" onSubmit={handleSubmit}>
          <div className="agenda-config-inline">
            <input
              type="text"
              placeholder="Novo item"
              value={novoItem.label}
              onChange={(event) => setNovoItem((anterior) => ({ ...anterior, label: event.target.value }))}
            />
            <input
              type="color"
              value={novoItem.cor}
              onChange={(event) => setNovoItem((anterior) => ({ ...anterior, cor: normalizarHex(event.target.value) }))}
            />
            <button type="button" className="agenda-config-add-btn" onClick={adicionarItem}>
              <Plus size={12} />
              Adicionar
            </button>
          </div>

          <div className="agenda-config-list">
            {itensEditaveis.map((item) => (
              <div key={item.id} className="agenda-config-item">
                <div className="agenda-config-item-title">
                  <span className="filtro-dot" style={{ backgroundColor: item.cor }} />
                  <input
                    type="text"
                    value={item.label}
                    onChange={(event) => atualizarItem(item.id, { label: event.target.value })}
                  />
                </div>
                <input
                  type="color"
                  value={item.cor}
                  onChange={(event) => atualizarItem(item.id, { cor: normalizarHex(event.target.value) })}
                />
                <label className="agenda-config-toggle">
                  <input
                    type="checkbox"
                    checked={item.ativo}
                    onChange={(event) => atualizarItem(item.id, { ativo: event.target.checked })}
                  />
                  <span>Ativo</span>
                </label>
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
