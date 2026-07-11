import React, { useMemo, useState } from 'react';
import { Plus, Repeat, Trash2 } from 'lucide-react';
import type { CompanyActivityGroup } from '../hooks/useAtividades';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import {
  RESPONSAVEIS_ATIVIDADES,
  todayKey,
  type CategoriaAtividade,
  type FrequenciaAtividade,
  type PrioridadeAtividade,
  type RotinaAtividade,
} from '../services/rotinasAtividadesService';

interface AtividadesRotinasProps {
  companyGroups: CompanyActivityGroup[];
}

const blankRotina = (): RotinaAtividade => ({
  id: '',
  nome: '',
  categoria: 'Interna',
  frequencia: 'Diária',
  intervaloDias: 1,
  responsavel: 'Karine',
  cliente: 'Escritório',
  proximaExecucao: todayKey(),
  prioridade: 'Média',
  ativa: true,
  checklist: [''],
  observacoes: '',
});

export const AtividadesRotinas: React.FC<AtividadesRotinasProps> = ({ companyGroups }) => {
  const { rotinas, saveRotina, deleteRotina } = useAtividadesWorkspace();
  const [form, setForm] = useState<RotinaAtividade>(blankRotina());

  const clientes = useMemo(() => {
    const nomes = companyGroups.map((group) => group.clienteNome);
    return ['Escritório', 'Clientes fiscais', 'Clientes de folha', ...Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b))];
  }, [companyGroups]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim()) return;
    const checklist = form.checklist.map((item) => item.trim()).filter(Boolean);
    saveRotina({
      ...form,
      id: form.id || `rotina-${Date.now()}`,
      checklist: checklist.length > 0 ? checklist : ['Executar atividade'],
      intervaloDias: form.frequencia === 'Personalizada' ? Math.max(1, form.intervaloDias) : form.intervaloDias,
    });
    setForm(blankRotina());
  };

  const setChecklistText = (value: string) => {
    setForm({ ...form, checklist: value.split('\n') });
  };

  return (
    <div className="atividades-redesign-page">
      <div className="atividades-redesign-header">
        <div>
          <h2>Atividades - Rotinas</h2>
          <p>Cadastre modelos recorrentes que geram tarefas para a agenda e para a equipe.</p>
        </div>
        <span>{rotinas.filter((rotina) => rotina.ativa).length} ativas</span>
      </div>

      <div className="atividades-rotinas-grid">
        <form onSubmit={handleSubmit} className="atividades-panel-card atividades-rotina-form">
          <div className="atividades-section-title"><Plus size={18} /><h3>{form.id ? 'Editar rotina' : 'Nova rotina'}</h3></div>
          <div className="calc-field"><label>Nome da rotina</label><input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex: Conferir notas fiscais" /></div>
          <div className="atividades-form-grid">
            <div className="calc-field"><label>Categoria</label><select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value as CategoriaAtividade })}><option value="Interna">Interna</option><option value="Cliente">Cliente</option><option value="Fiscal">Fiscal</option><option value="Folha">Folha</option><option value="Contábil">Contábil</option><option value="Controle">Controle</option></select></div>
            <div className="calc-field"><label>Recorrência</label><select value={form.frequencia} onChange={(event) => setForm({ ...form, frequencia: event.target.value as FrequenciaAtividade })}><option value="Diária">Diária</option><option value="Semanal">Semanal</option><option value="Quinzenal">Quinzenal</option><option value="Mensal">Mensal</option><option value="Personalizada">A cada X dias</option></select></div>
          </div>
          {form.frequencia === 'Personalizada' && <div className="calc-field"><label>Intervalo em dias</label><input type="number" min={1} value={form.intervaloDias} onChange={(event) => setForm({ ...form, intervaloDias: Number(event.target.value) })} /></div>}
          <div className="atividades-form-grid">
            <div className="calc-field"><label>Responsável padrão</label><select value={form.responsavel} onChange={(event) => setForm({ ...form, responsavel: event.target.value })}>{RESPONSAVEIS_ATIVIDADES.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></div>
            <div className="calc-field"><label>Cliente / origem</label><select value={form.cliente} onChange={(event) => setForm({ ...form, cliente: event.target.value })}>{clientes.map((cliente) => <option key={cliente} value={cliente}>{cliente}</option>)}</select></div>
          </div>
          <div className="atividades-form-grid">
            <div className="calc-field"><label>Próxima execução</label><input type="date" value={form.proximaExecucao} onChange={(event) => setForm({ ...form, proximaExecucao: event.target.value })} /></div>
            <div className="calc-field"><label>Prioridade</label><select value={form.prioridade} onChange={(event) => setForm({ ...form, prioridade: event.target.value as PrioridadeAtividade })}><option value="Baixa">Baixa</option><option value="Média">Média</option><option value="Alta">Alta</option></select></div>
          </div>
          <div className="calc-field"><label>Checklist padrão</label><textarea value={form.checklist.join('\n')} onChange={(event) => setChecklistText(event.target.value)} placeholder="Uma etapa por linha" /></div>
          <div className="calc-field"><label>Observações</label><textarea value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} placeholder="Regras, exceções ou instruções para a equipe" /></div>
          <button type="submit" className="btn-add-user">{form.id ? 'Salvar rotina' : 'Criar rotina'}</button>
        </form>

        <section className="atividades-panel-card">
          <div className="atividades-section-title"><Repeat size={18} /><h3>Rotinas cadastradas</h3></div>
          <div className="atividades-rotina-list">
            {rotinas.map((rotina) => (
              <article key={rotina.id}>
                <div>
                  <strong>{rotina.nome}</strong>
                  <span>{rotina.frequencia} • {rotina.responsavel} • {rotina.cliente}</span>
                </div>
                <small>{rotina.categoria} / {rotina.prioridade}</small>
                <button type="button" onClick={() => setForm(rotina)}>Editar</button>
                <button type="button" onClick={() => deleteRotina(rotina.id)} title="Excluir rotina"><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
