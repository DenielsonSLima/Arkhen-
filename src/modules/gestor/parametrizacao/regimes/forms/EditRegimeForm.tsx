import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type { RegimeTributario } from '../types';
import './EditRegimeForm.css';

interface EditRegimeFormProps {
  regime: RegimeTributario;
  onSave: (regime: RegimeTributario) => void;
  onCancel: () => void;
  isSaving: boolean;
}

type ListType = 'positive' | 'negative';

export const EditRegimeForm: React.FC<EditRegimeFormProps> = ({
  regime,
  onSave,
  onCancel,
  isSaving,
}) => {
  const [title, setTitle] = useState(regime.title);
  const [limit, setLimit] = useState(regime.limit);
  const [desc, setDesc] = useState(regime.desc);
  const [positives, setPositives] = useState<string[]>([...regime.positives]);
  const [negatives, setNegatives] = useState<string[]>([...regime.negatives]);

  const updateList = (type: ListType, index: number, value: string) => {
    const current = type === 'positive' ? positives : negatives;
    const updated = [...current];
    updated[index] = value;
    if (type === 'positive') setPositives(updated);
    else setNegatives(updated);
  };

  const addItem = (type: ListType) => {
    if (type === 'positive') setPositives([...positives, '']);
    else setNegatives([...negatives, '']);
  };

  const removeItem = (type: ListType, index: number) => {
    if (type === 'positive') setPositives(positives.filter((_, itemIndex) => itemIndex !== index));
    else setNegatives(negatives.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !desc.trim()) return;

    onSave({
      ...regime,
      title: title.trim(),
      limit: limit.trim(),
      desc: desc.trim(),
      positives: positives.map((item) => item.trim()).filter(Boolean),
      negatives: negatives.map((item) => item.trim()).filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="regime-edit-form">
      <div className="regime-editor-intro">
        <div className={`regime-editor-badge ${regime.color}`}>
          {regime.id.toUpperCase()}
        </div>
        <div>
          <strong>Cadastro de enquadramento tributário</strong>
          <span>Atualize o texto que aparece para o contador na consulta de regimes.</span>
        </div>
      </div>

      <section className="regime-editor-section">
        <div className="regime-editor-section-title">
          <FileText size={17} />
          <span>Dados principais</span>
        </div>

        <div className="regime-editor-grid">
          <label className="regime-editor-field">
            <span>Nome do regime *</span>
            <input
              type="text"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isSaving}
            />
          </label>

          <label className="regime-editor-field">
            <span>Limite de faturamento</span>
            <input
              type="text"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              disabled={isSaving}
            />
          </label>
        </div>

        <label className="regime-editor-field">
          <span>Descrição geral *</span>
          <textarea
            required
            rows={4}
            value={desc}
            onChange={(event) => setDesc(event.target.value)}
            disabled={isSaving}
          />
        </label>
      </section>

      <div className="regime-editor-lists">
        <EditableList
          type="positive"
          title="Vantagens"
          subtitle="O que este regime tem"
          icon={<ShieldCheck size={17} />}
          items={positives}
          disabled={isSaving}
          onChange={updateList}
          onAdd={addItem}
          onRemove={removeItem}
        />

        <EditableList
          type="negative"
          title="Restrições"
          subtitle="Pontos de atenção"
          icon={<AlertTriangle size={17} />}
          items={negatives}
          disabled={isSaving}
          onChange={updateList}
          onAdd={addItem}
          onRemove={removeItem}
        />
      </div>

      <div className="regime-editor-footer">
        <button type="button" className="regime-editor-secondary" onClick={onCancel} disabled={isSaving}>
          <X size={15} />
          Cancelar
        </button>
        <button type="submit" className="regime-editor-primary" disabled={isSaving}>
          <Save size={15} />
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </form>
  );
};

interface EditableListProps {
  type: ListType;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: string[];
  disabled: boolean;
  onChange: (type: ListType, index: number, value: string) => void;
  onAdd: (type: ListType) => void;
  onRemove: (type: ListType, index: number) => void;
}

const EditableList: React.FC<EditableListProps> = ({
  type,
  title,
  subtitle,
  icon,
  items,
  disabled,
  onChange,
  onAdd,
  onRemove,
}) => (
  <section className={`regime-editor-list ${type}`}>
    <div className="regime-editor-list-header">
      <div>
        {icon}
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </div>
      <button type="button" onClick={() => onAdd(type)} disabled={disabled}>
        <Plus size={14} />
        Adicionar
      </button>
    </div>

    <div className="regime-editor-items">
      {items.map((item, index) => (
        <div className="regime-editor-item" key={`${type}-${index}`}>
          {type === 'positive' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <input
            type="text"
            placeholder={type === 'positive' ? 'Descreva uma vantagem...' : 'Descreva uma restrição...'}
            value={item}
            onChange={(event) => onChange(type, index, event.target.value)}
            disabled={disabled}
          />
          <button type="button" onClick={() => onRemove(type, index)} disabled={disabled} aria-label="Remover item">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  </section>
);
