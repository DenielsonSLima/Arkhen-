import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { PerfilAcesso } from '../services/perfisService';
import { permissoesCatalog } from '../services/permissoesCatalog';

interface PerfilFormModalProps {
  perfil: PerfilAcesso | null;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (input: { nome: string; descricao: string; permissoes: string[] }) => Promise<void>;
}

export const PerfilFormModal: React.FC<PerfilFormModalProps> = ({ perfil, isSaving, onCancel, onSubmit }) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [permissoes, setPermissoes] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setNome(perfil?.nome || '');
    setDescricao(perfil?.descricao || '');
    setPermissoes(perfil?.permissoes || []);
    setLocalError(null);
  }, [perfil]);

  const grouped = useMemo(() => {
    return permissoesCatalog.reduce<Record<string, typeof permissoesCatalog>>((acc, item) => {
      acc[item.grupo] = acc[item.grupo] || [];
      acc[item.grupo].push(item);
      return acc;
    }, {});
  }, []);

  const togglePermissao = (chave: string) => {
    setPermissoes((current) => current.includes(chave) ? current.filter((item) => item !== chave) : [...current, chave]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nome.trim() || !descricao.trim()) {
      setLocalError('Preencha nome e descrição.');
      return;
    }
    await onSubmit({ nome, descricao, permissoes });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container perfil-access-modal">
        <div className="perfil-access-modal-header">
          <div>
            <h3>{perfil ? 'Editar Perfil de Acesso' : 'Criar Perfil de Acesso'}</h3>
            {perfil?.sistema && (
              <span className="perfil-access-modal-subtitle">Perfil de sistema: nome bloqueado, permissões ajustáveis.</span>
            )}
          </div>
          <button type="button" className="btn-icon-plain" onClick={onCancel} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {localError && <div className="error-banner">{localError}</div>}

        <form onSubmit={handleSubmit} className="config-form perfil-access-form">
          <div className="perfil-access-scroll">
            <div className="form-row-grid">
              <div className="form-item-group">
                <label>Nome do perfil</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  disabled={isSaving || perfil?.sistema}
                />
              </div>
              <div className="form-item-group">
                <label>Permissões ativas</label>
                <input type="text" value={`${permissoes.length} permissões selecionadas`} disabled />
              </div>
            </div>

            <div className="form-item-group">
              <label>Descrição operacional</label>
              <textarea
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                disabled={isSaving}
                rows={2}
              />
            </div>

            <div className="perfil-permissoes-grid">
              {Object.entries(grouped).map(([grupo, items]) => (
                <div key={grupo} className="perfil-permissoes-group">
                  <strong>{grupo}</strong>
                  {items.map((item) => (
                    <label key={item.chave} className="checkbox-container perfil-permissao-check">
                      <input
                        type="checkbox"
                        checked={permissoes.includes(item.chave)}
                        onChange={() => togglePermissao(item.chave)}
                        disabled={isSaving}
                      />
                      <span className="checkbox-checkmark"></span>
                      {item.nome}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions-row perfil-access-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" className="btn-save-settings" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
