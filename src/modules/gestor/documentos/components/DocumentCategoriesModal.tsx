import React, { useState } from 'react';
import { Edit3, EyeOff, Plus, Trash2, X } from 'lucide-react';
import type { DocumentCategory } from '../services/documentosService';

interface DocumentCategoriesModalProps {
  isOpen: boolean;
  categories: DocumentCategory[];
  onClose: () => void;
  onSave: (categories: DocumentCategory[]) => void;
}

const makeId = (name: string) => `${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '-')}-${Date.now()}`;

export const DocumentCategoriesModal: React.FC<DocumentCategoriesModalProps> = ({
  isOpen,
  categories,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!isOpen) return null;

  const addCategory = () => {
    const name = draft.trim();
    if (!name || categories.some((item) => item.nome.toLowerCase() === name.toLowerCase())) return;
    onSave([...categories, { id: makeId(name), nome: name, ativo: true }]);
    setDraft('');
  };

  const saveEdit = (categoryId: string) => {
    const name = editingName.trim();
    if (!name) return;
    onSave(categories.map((item) => (item.id === categoryId ? { ...item, nome: name } : item)));
    setEditingId(null);
    setEditingName('');
  };

  const toggleActive = (categoryId: string) => {
    onSave(categories.map((item) => (
      item.id === categoryId && !item.sistema ? { ...item, ativo: !item.ativo } : item
    )));
  };

  const removeCategory = (categoryId: string) => {
    onSave(categories.filter((item) => item.id !== categoryId || item.sistema));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: '620px' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Categorias de Documentos</h3>
            <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '2px 0 0' }}>Contratos, Procurações e Certidões ficam sempre ativos.</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nova categoria"
            style={{ flex: 1, padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.84rem' }}
          />
          <button type="button" className="btn-add-user" onClick={addCategory} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> Adicionar
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categories.map((category) => (
            <div key={category.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', background: category.ativo ? '#fff' : '#f8fafc' }}>
              {editingId === category.id ? (
                <input
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onBlur={() => saveEdit(category.id)}
                  onKeyDown={(event) => event.key === 'Enter' && saveEdit(category.id)}
                  style={{ padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                  autoFocus
                />
              ) : (
                <div>
                  <strong style={{ color: '#0f172a', fontSize: '0.86rem' }}>{category.nome}</strong>
                  <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: category.ativo ? '#16a34a' : '#94a3b8', fontWeight: 700 }}>
                    {category.ativo ? 'Ativa' : 'Inativa'}{category.sistema ? ' / Sistema' : ''}
                  </span>
                </div>
              )}

              <div style={{ display: 'inline-flex', gap: '4px' }}>
                <button type="button" className="btn-icon-table" onClick={() => { setEditingId(category.id); setEditingName(category.nome); }} title="Editar categoria">
                  <Edit3 size={14} />
                </button>
                <button type="button" className="btn-icon-table" onClick={() => toggleActive(category.id)} disabled={category.sistema} title="Ativar ou inativar">
                  <EyeOff size={14} />
                </button>
                <button type="button" className="btn-icon-table delete" onClick={() => removeCategory(category.id)} disabled={category.sistema} title="Excluir categoria">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
