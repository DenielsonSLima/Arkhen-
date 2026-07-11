import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getEventoCategoriaConfig,
  getEventoOrigemConfig,
  type CategoriaEventoConfig,
  type Evento,
  type UsuarioAgenda,
} from '../services/agenda.service';

interface AgendaTrimestreAtividadesProps {
  ano: number;
  mes: number;
  eventos: Evento[];
  diaSelecionado: string | null;
  onSelectDia: (dia: string) => void;
  onNavegarMes: (direcao: 1 | -1) => void;
  mesesVisiveis?: number;
  categoriasEvento?: CategoriaEventoConfig[];
  usuariosCores?: UsuarioAgenda[];
}

const COR_PADRAO_RESPONSAVEL = '#64748b';

const gerarCorResponsavel = (chave: string) => {
  let hash = 0;
  for (let i = 0; i < chave.length; i += 1) {
    hash = (hash * 31 + chave.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 70%, 48%)`;
};

const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const normalizeMonth = (ano: number, mes: number) => {
  const date = new Date(ano, mes, 1);
  return { ano: date.getFullYear(), mes: date.getMonth() };
};

const getMonthCells = (ano: number, mes: number) => {
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
  const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();
  const cells: { dia: number; dataStr: string; outroMes: boolean }[] = [];

  for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
    const d = totalDiasMesAnterior - i;
    const date = new Date(ano, mes - 1, d);
    cells.push({
      dia: d,
      dataStr: date.toISOString().split('T')[0],
      outroMes: true,
    });
  }

  for (let d = 1; d <= totalDiasMes; d++) {
    cells.push({
      dia: d,
      dataStr: new Date(ano, mes, d).toISOString().split('T')[0],
      outroMes: false,
    });
  }

  while (cells.length % 7 !== 0) {
    const d = cells.length - primeiroDiaSemana - totalDiasMes + 1;
    const date = new Date(ano, mes + 1, d);
    cells.push({
      dia: d,
      dataStr: date.toISOString().split('T')[0],
      outroMes: true,
    });
  }

  return cells;
};

const getDailyActivityProgress = (dataStr: string) => {
  void dataStr;
  return null;
};

export const AgendaTrimestreAtividades: React.FC<AgendaTrimestreAtividadesProps> = ({
  ano,
  mes,
  eventos,
  diaSelecionado,
  onSelectDia,
  onNavegarMes,
  mesesVisiveis = 3,
  categoriasEvento = [],
  usuariosCores = [],
}) => {
  const hoje = new Date().toISOString().split('T')[0];
  const totalMeses = Math.max(3, Number.isInteger(mesesVisiveis) ? mesesVisiveis : 3);
  const gridColumns = totalMeses > 3 ? 6 : totalMeses;
  const metadeParaTras = Math.floor((totalMeses - 1) / 2);
  const meses = Array.from({ length: totalMeses }, (_, i) => normalizeMonth(ano, mes + (i - metadeParaTras)));
  const eventosMesSelecionado = eventos.filter((evento) => {
    const [eventoAno, eventoMes] = evento.data.split('-').map(Number);
    return eventoAno === ano && eventoMes === mes + 1;
  });
  const responsaveis = new Map<string, { id: string; nome: string; cor: string }>();
  eventosMesSelecionado.forEach((evento) => {
    const responsavelId = evento.responsavelId || 'sem-responsavel';
    if (responsaveis.has(responsavelId)) return;
    const corSalva = usuariosCores.find((usuario) => usuario.id === evento.responsavelId)?.cor;
    responsaveis.set(responsavelId, {
      id: responsavelId,
      nome: evento.responsavelNome || 'Sem responsável',
      cor: corSalva || (responsavelId === 'sem-responsavel' ? '#94a3b8' : gerarCorResponsavel(responsavelId)),
    });
  });

  const categorias = Array.from(new Map(
    eventosMesSelecionado.map((evento) => {
      const config = getEventoCategoriaConfig(evento, categoriasEvento);
      return [config.id, config];
    }),
  ).values());
  const categoriasOrdenadas = categorias.slice(0, 8);

  return (
    <div className="agenda-trimestre-card">
      <div className="agenda-trimestre-card-header">
        <button type="button" className="agenda-trimestre-nav-btn" onClick={() => onNavegarMes(-1)}>
          <ChevronLeft size={16} />
          Voltar mês
        </button>
        <div className="agenda-trimestre-current-label">
          {NOMES_MESES[mes]} <span>{ano}</span>
        </div>
        <button type="button" className="agenda-trimestre-nav-btn" onClick={() => onNavegarMes(1)}>
          Próximo mês
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="agenda-trimestre-grid" style={{ '--agenda-trimestre-cols': String(gridColumns) } as React.CSSProperties}>
        {meses.map((item) => {
          const cells = getMonthCells(item.ano, item.mes);
          const isCurrent = item.mes === mes && item.ano === ano;
          return (
            <div key={`${item.ano}-${item.mes}`} className={`agenda-trimestre-month ${isCurrent ? 'current' : 'adjacent'}`}>
              <div className="agenda-trimestre-title">
                {NOMES_MESES[item.mes]} <span>{item.ano}</span>
              </div>
              <div className="agenda-trimestre-weekdays">
                {DIAS_SEMANA.map((dia, index) => <span key={`${dia}-${index}`}>{dia}</span>)}
              </div>
              <div className="agenda-trimestre-days">
                {cells.map((cell) => {
                    const eventosDia = eventos.filter((evento) => evento.data === cell.dataStr);
                    const atividadePct = getDailyActivityProgress(cell.dataStr);
                    return (
                    <button
                      type="button"
                      key={cell.dataStr}
                      className={[
                        'agenda-trimestre-day',
                        cell.outroMes ? 'muted' : '',
                        cell.dataStr === hoje ? 'today' : '',
                        cell.dataStr === diaSelecionado ? 'selected' : '',
                      ].join(' ')}
                      onClick={() => onSelectDia(cell.dataStr)}
                      title={atividadePct !== null ? `Atividades diárias: ${atividadePct}%` : undefined}
                    >
                      <span>{cell.dia}</span>
                      {atividadePct !== null && <b>{atividadePct}%</b>}
                      <div>
                        {eventosDia.slice(0, 3).map((evento) => {
                          const origem = getEventoOrigemConfig(evento);
                          return <i key={evento.id} className={origem.className} style={{ background: origem.cor }} />;
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="agenda-trimestre-legends">
        <div>
          <strong>Origem</strong>
          <span><i className="manual" /> Manual</span>
          <span><i className="prazo-fiscal" /> Prazo Fiscal</span>
          <span><i className="atividade" /> Atividade</span>
        </div>
        <div>
          <strong>Categorias</strong>
          {categoriasOrdenadas.length === 0 ? (
            <span>Sem categorias no mês.</span>
          ) : (
            categoriasOrdenadas.map((categoria) => (
              <span key={categoria.id}>
                <i style={{ background: categoria.cor }} />
                {categoria.label}
              </span>
            ))
          )}
        </div>
        <div>
          <strong>Por funcionário</strong>
          {Array.from(responsaveis.values()).map((responsavel) => (
            <span key={responsavel.id}>
              <i style={{ background: responsavel.cor || COR_PADRAO_RESPONSAVEL }} />
              {responsavel.nome}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
