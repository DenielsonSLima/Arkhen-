import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCog, CheckCircle2, Plus, Save, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import type { AgendaPadraoEvento } from '../services/agenda.service';

type FiltroPadrao = 'todos' | 'obrigacoes' | 'feriados' | 'datas';

interface AgendaPadroesGestorProps {
  padroes: AgendaPadraoEvento[];
  podeGerenciar: boolean;
  onSalvar: (
    proximos: AgendaPadraoEvento[],
    options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
  ) => void;
  onToast?: (type: 'success' | 'error', message: string) => void;
}

const mesesOptions = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
];

const tipoLabels: Record<string, string> = {
  prazo_fiscal: 'Obrigação',
  feriado: 'Feriado',
  data_especial: 'Data especial',
};

const regraLabels: Record<AgendaPadraoEvento['regraTipo'], string> = {
  fixa: 'Anual fixa',
  pascoa_offset: 'Páscoa +/- dias',
  mensal_dia: 'Todo mês',
  ultimo_dia_util: 'Último dia útil',
};

const novoPadrao = (ordem: number): AgendaPadraoEvento => {
  const now = Date.now();
  return {
    id: `novo-${now}`,
    codigo: `custom-${now}`,
    titulo: 'Novo padrão',
    descricao: '',
    tipo: 'prazo_fiscal',
    categoriaId: 'obrigacao_contabil',
    escopo: 'contabil',
    regraTipo: 'mensal_dia',
    mes: null,
    dia: 10,
    meses: [],
    offsetDias: null,
    hora: '09:00',
    ativo: true,
    editavel: true,
    ordem,
  };
};

export const AgendaPadroesGestor: React.FC<AgendaPadroesGestorProps> = ({
  padroes,
  podeGerenciar,
  onSalvar,
  onToast,
}) => {
  const [itens, setItens] = useState<AgendaPadraoEvento[]>(padroes);
  const [filtro, setFiltro] = useState<FiltroPadrao>('todos');
  const [selecionadoCodigo, setSelecionadoCodigo] = useState<string | null>(padroes[0]?.codigo ?? null);

  useEffect(() => {
    setItens(padroes);
    setSelecionadoCodigo((atual) => atual && padroes.some((item) => item.codigo === atual) ? atual : padroes[0]?.codigo ?? null);
  }, [padroes]);

  const resumo = useMemo(() => ({
    obrigacoes: itens.filter((item) => item.tipo === 'prazo_fiscal').length,
    feriados: itens.filter((item) => item.tipo === 'feriado').length,
    datas: itens.filter((item) => item.tipo === 'data_especial').length,
  }), [itens]);

  const itensFiltrados = useMemo(() => itens.filter((item) => {
    if (filtro === 'obrigacoes') return item.tipo === 'prazo_fiscal';
    if (filtro === 'feriados') return item.tipo === 'feriado';
    if (filtro === 'datas') return item.tipo === 'data_especial';
    return true;
  }), [filtro, itens]);

  const selecionado = itens.find((item) => item.codigo === selecionadoCodigo) || itensFiltrados[0] || null;

  useEffect(() => {
    if (selecionado && itensFiltrados.some((item) => item.codigo === selecionado.codigo)) return;
    setSelecionadoCodigo(itensFiltrados[0]?.codigo ?? null);
  }, [itensFiltrados, selecionado]);

  const updateItem = (codigo: string, patch: Partial<AgendaPadraoEvento>) => {
    setItens((atuais) => atuais.map((item) => (
      item.codigo === codigo ? { ...item, ...patch } : item
    )));
  };

  const updateSelecionado = (patch: Partial<AgendaPadraoEvento>) => {
    if (!selecionado) return;
    updateItem(selecionado.codigo, patch);
  };

  const toggleMes = (item: AgendaPadraoEvento, mes: number) => {
    const atual = new Set(item.meses);
    if (atual.has(mes)) atual.delete(mes);
    else atual.add(mes);
    updateItem(item.codigo, { meses: Array.from(atual).sort((a, b) => a - b) });
  };

  const adicionarPadrao = () => {
    const item = novoPadrao(itens.length + 1);
    setItens((atuais) => [...atuais, item]);
    setSelecionadoCodigo(item.codigo);
    setFiltro('todos');
  };

  const salvar = () => {
    onSalvar(itens, {
      onSuccess: () => onToast?.('success', 'Padrões da agenda salvos.'),
      onError: (error) => onToast?.(
        'error',
        error instanceof Error ? error.message : 'Não foi possível salvar os padrões.',
      ),
    });
  };

  if (!podeGerenciar) {
    return (
      <div className="agenda-padroes-locked">
        <ShieldAlert size={22} />
        <strong>Acesso restrito ao gestor</strong>
      </div>
    );
  }

  return (
    <section className="agenda-padroes-panel">
      <div className="agenda-padroes-header">
        <div>
          <h2><CalendarCog size={18} /> Padrões da agenda</h2>
          <p>Eventos recorrentes, feriados e obrigações exibidos para todas as empresas.</p>
        </div>
        <div className="agenda-padroes-actions">
          <button type="button" className="agenda-secondary-btn" onClick={adicionarPadrao}>
            <Plus size={15} />
            Novo padrão
          </button>
          <button type="button" className="btn-novo-evento" onClick={salvar}>
            <Save size={15} />
            Salvar tudo
          </button>
        </div>
      </div>

      <div className="agenda-padroes-tabs" role="tablist" aria-label="Filtros de padrões">
        <PadraoFiltroButton active={filtro === 'todos'} onClick={() => setFiltro('todos')} label="Todos" count={itens.length} icon />
        <PadraoFiltroButton active={filtro === 'obrigacoes'} onClick={() => setFiltro('obrigacoes')} label="Obrigações" count={resumo.obrigacoes} />
        <PadraoFiltroButton active={filtro === 'feriados'} onClick={() => setFiltro('feriados')} label="Feriados" count={resumo.feriados} />
        <PadraoFiltroButton active={filtro === 'datas'} onClick={() => setFiltro('datas')} label="Datas" count={resumo.datas} />
      </div>

      <div className="agenda-padroes-workspace">
        <div className="agenda-padroes-list" aria-label="Lista de padrões">
          {itensFiltrados.map((item) => (
            <button
              type="button"
              key={item.codigo}
              className={`agenda-padroes-list-item ${item.codigo === selecionado?.codigo ? 'active' : ''}`}
              onClick={() => setSelecionadoCodigo(item.codigo)}
            >
              <span className={`agenda-padroes-state-dot ${item.ativo ? 'active' : ''}`} />
              <span>
                <strong>{item.titulo}</strong>
                <small>{tipoLabels[item.tipo] || item.tipo} • {item.escopo} • {regraLabels[item.regraTipo]}</small>
              </span>
              {item.ativo && <CheckCircle2 size={15} />}
            </button>
          ))}
        </div>

        {selecionado ? (
          <PadraoEditor item={selecionado} onChange={updateSelecionado} onToggleMes={toggleMes} />
        ) : (
          <div className="agenda-padroes-empty">Nenhum padrão encontrado.</div>
        )}
      </div>
    </section>
  );
};

const PadraoFiltroButton: React.FC<{
  active: boolean;
  label: string;
  count: number;
  icon?: boolean;
  onClick: () => void;
}> = ({ active, label, count, icon, onClick }) => (
  <button type="button" className={active ? 'active' : ''} onClick={onClick}>
    {icon && <SlidersHorizontal size={14} />}
    {label} <span>{count}</span>
  </button>
);

const PadraoEditor: React.FC<{
  item: AgendaPadraoEvento;
  onChange: (patch: Partial<AgendaPadraoEvento>) => void;
  onToggleMes: (item: AgendaPadraoEvento, mes: number) => void;
}> = ({ item, onChange, onToggleMes }) => (
  <div className="agenda-padroes-editor">
    <div className="agenda-padroes-editor-header">
      <div>
        <strong>{item.titulo}</strong>
        <span>{tipoLabels[item.tipo] || item.tipo}</span>
      </div>
      <label className="agenda-padroes-active-toggle">
        <input type="checkbox" checked={item.ativo} onChange={(event) => onChange({ ativo: event.target.checked })} />
        Ativo
      </label>
    </div>

    <div className="agenda-padroes-form">
      <label className="span-2">
        Título
        <input value={item.titulo} onChange={(event) => onChange({ titulo: event.target.value })} />
      </label>
      <label className="span-2">
        Descrição
        <textarea value={item.descricao} onChange={(event) => onChange({ descricao: event.target.value })} placeholder="Descrição exibida na agenda" />
      </label>
      <label>
        Tipo
        <select value={item.tipo} onChange={(event) => onChange({ tipo: event.target.value })}>
          <option value="prazo_fiscal">Prazo fiscal</option>
          <option value="feriado">Feriado</option>
          <option value="data_especial">Data especial</option>
        </select>
      </label>
      <label>
        Escopo
        <select value={item.escopo} onChange={(event) => onChange({ escopo: event.target.value })}>
          <option value="brasil">Brasil</option>
          <option value="sergipe">Sergipe</option>
          <option value="contabil">Contábil</option>
          <option value="escritorio">Escritório</option>
        </select>
      </label>
      <label>
        Regra
        <select value={item.regraTipo} onChange={(event) => onChange({ regraTipo: event.target.value as AgendaPadraoEvento['regraTipo'] })}>
          <option value="fixa">Anual fixa</option>
          <option value="pascoa_offset">Páscoa +/- dias</option>
          <option value="mensal_dia">Todo mês</option>
          <option value="ultimo_dia_util">Último dia útil</option>
        </select>
      </label>
      <label>
        Categoria
        <input value={item.categoriaId} onChange={(event) => onChange({ categoriaId: event.target.value })} />
      </label>
      {item.regraTipo === 'pascoa_offset' ? (
        <label>
          Offset da Páscoa
          <input type="number" value={item.offsetDias ?? 0} onChange={(event) => onChange({ offsetDias: Number(event.target.value) })} />
        </label>
      ) : (
        <>
          <label>
            Mês
            <input type="number" min={1} max={12} value={item.mes ?? ''} onChange={(event) => onChange({ mes: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label>
            Dia
            <input type="number" min={1} max={31} value={item.dia ?? ''} onChange={(event) => onChange({ dia: event.target.value ? Number(event.target.value) : null })} />
          </label>
        </>
      )}
      <label>
        Hora
        <input type="time" value={item.hora} onChange={(event) => onChange({ hora: event.target.value })} />
      </label>
      {item.regraTipo === 'ultimo_dia_util' && (
        <div className="agenda-month-pills span-2">
          {mesesOptions.map((mes) => (
            <button key={mes.value} type="button" className={item.meses.includes(mes.value) ? 'active' : ''} onClick={() => onToggleMes(item, mes.value)}>
              {mes.label}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);
