import React from 'react';
import { Percent, BarChart3, BookOpenCheck, History } from 'lucide-react';
import { usePlanejamentoTributario, type AbaAtiva } from './hooks/usePlanejamentoTributario';
import { ComparadorRegimes } from './comparador/ComparadorRegimes';
import { AnaliseCliente } from './analise-cliente/AnaliseCliente';
import { LegislacaoTributaria } from './legislacao-tributaria/LegislacaoTributaria';
import { HistoricoPlanejamentos } from './historico/HistoricoPlanejamentos';
import './PlanejamentoTributario.css';

const ABAS: { id: AbaAtiva; label: string; icon: React.ReactNode }[] = [
  { id: 'comparador', label: 'Comparador de Regimes', icon: <BarChart3 size={16} /> },
  { id: 'analise', label: 'Análise por Cliente', icon: <Percent size={16} /> },
  { id: 'legislacao', label: 'Legislação Tributária', icon: <BookOpenCheck size={16} /> },
  { id: 'historico', label: 'Histórico', icon: <History size={16} /> },
];

export const PlanejamentoTributarioPage: React.FC = () => {
  const {
    abaAtiva, setAbaAtiva,
    faturamentoInput, setFaturamentoInput,
    anexoInput, setAnexoInput,
    comparativo,
    anexosDas,
    clientes, clienteSelecionadoId, setClienteSelecionadoId,
    clienteSelecionado, analiseCliente, diagnosticoCliente, salvarAnalise, salvandoAnalise,
    consultaEmpresaId, setConsultaEmpresaId,
    consultaFaturamentoInput, setConsultaFaturamentoInput,
    consultaEnquadramento,
    anexoTabela, setAnexoTabela, faixasExibidas,
    historico,
  } = usePlanejamentoTributario();

  return (
    <div className="planejamento-container animate-fade-in">
      {/* Header */}
      <div className="planejamento-header">
        <div>
          <h1>Planejamento Tributário</h1>
          <p>Compare regimes, analise clientes e identifique a melhor estratégia fiscal.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="planejamento-tabs">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            className={`planejamento-tab-btn${abaAtiva === aba.id ? ' active' : ''}`}
            onClick={() => setAbaAtiva(aba.id)}
          >
            {aba.icon}
            {aba.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {abaAtiva === 'comparador' && (
        <ComparadorRegimes
          comparativo={comparativo}
          faturamentoInput={faturamentoInput}
          setFaturamentoInput={setFaturamentoInput}
          anexoInput={anexoInput}
          setAnexoInput={setAnexoInput}
          anexosDas={anexosDas}
        />
      )}
      {abaAtiva === 'analise' && (
        <AnaliseCliente
          clientes={clientes}
          clienteSelecionadoId={clienteSelecionadoId}
          setClienteSelecionadoId={setClienteSelecionadoId}
          clienteSelecionado={clienteSelecionado}
          analise={analiseCliente}
          diagnostico={diagnosticoCliente}
          salvarAnalise={salvarAnalise}
          salvandoAnalise={salvandoAnalise}
        />
      )}
      {abaAtiva === 'legislacao' && (
        <LegislacaoTributaria
          clientes={clientes}
          consultaEmpresaId={consultaEmpresaId}
          setConsultaEmpresaId={setConsultaEmpresaId}
          consultaFaturamentoInput={consultaFaturamentoInput}
          setConsultaFaturamentoInput={setConsultaFaturamentoInput}
          consultaEnquadramento={consultaEnquadramento}
          anexoTabela={anexoTabela}
          setAnexoTabela={setAnexoTabela}
          faixasExibidas={faixasExibidas}
          anexosDas={anexosDas}
        />
      )}
      {abaAtiva === 'historico' && (
        <HistoricoPlanejamentos historico={historico} />
      )}
    </div>
  );
};
