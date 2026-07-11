import React, { useState } from 'react';

type NovoOutroCredito = {
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
};

type OutrosCreditosFormProps = {
  onSubmit: (item: NovoOutroCredito) => void;
  onCancel?: () => void;
};

export const OutrosCreditosForm: React.FC<OutrosCreditosFormProps> = ({ onSubmit, onCancel }) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    data: hoje,
    descricao: '',
    categoria: 'Ajuste',
    valor: '',
  });
  const [erro, setErro] = useState('');

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const reset = () => {
    setForm({ data: hoje, descricao: '', categoria: 'Ajuste', valor: '' });
    setErro('');
  };

  const submit = () => {
    if (!form.descricao.trim()) {
      setErro('Informe a descrição.');
      return;
    }

    const valor = Number(String(form.valor).replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor válido.');
      return;
    }

    onSubmit({
      data: form.data,
      descricao: form.descricao.trim(),
      categoria: form.categoria.trim() || 'Ajuste',
      valor,
    });

    reset();
  };

  return (
    <div className="financeiro-launch-form">
      <div className="financeiro-form-grid">
        <div className="financeiro-field">
          <label>Data</label>
          <input type="date" value={form.data} onChange={update('data')} />
        </div>
        <div className="financeiro-field">
          <label>Descrição</label>
          <input value={form.descricao} onChange={update('descricao')} placeholder="Digite a descrição do crédito" />
        </div>
        <div className="financeiro-field">
          <label>Categoria</label>
          <select value={form.categoria} onChange={update('categoria')}>
            <option>Ajuda</option>
            <option>Ajuste</option>
            <option>Reposição</option>
            <option>Reembolso</option>
            <option>Operacional</option>
          </select>
        </div>
        <div className="financeiro-field">
          <label>Valor</label>
          <input type="number" value={form.valor} onChange={update('valor')} min="0.01" step="0.01" placeholder="0,00" />
        </div>
      </div>
      {erro ? <p className="financeiro-form-error">{erro}</p> : null}
      <div className="financeiro-form-actions">
        {onCancel ? (
          <button className="financeiro-form-btn secondary" type="button" onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
        <button className="financeiro-form-btn" type="button" onClick={submit}>
          Adicionar crédito
        </button>
      </div>
    </div>
  );
};
