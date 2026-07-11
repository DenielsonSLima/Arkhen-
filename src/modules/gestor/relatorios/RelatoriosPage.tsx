import React from 'react';
import {
  DollarSign,
  CheckCircle2,
  Users,
  TrendingUp,
  Printer,
  FileText
} from 'lucide-react';

import { useRelatorios } from './hooks/useRelatorios';
import { FaturamentoRelatorio } from './faturamento/FaturamentoRelatorio';
import { AtividadesRelatorio } from './atividades/AtividadesRelatorio';
import { PessoalRelatorio } from './pessoal/PessoalRelatorio';
import { TributarioRelatorio } from './tributario/TributarioRelatorio';

import './Relatorios.css';

export const RelatoriosPage: React.FC = () => {
  const {
    activeReport,
    setActiveReport,
    companies,
    selectedCompany,
    setSelectedCompany,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    faturamentoAnual,
    setFaturamentoAnual,
    custoFolhaAnual,
    setCustoFolhaAnual,
    isLoading,
    isGenerated,
    faturamentoData,
    conformidadeData,
    pessoalData,
    tributarioData,
    handleGenerateReport,
    handlePrint
  } = useRelatorios();

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const reportOptions = [
    { id: 'faturamento', label: 'Faturamento & Inadimplência', icon: DollarSign, desc: 'Análise de fluxo financeiro, cobranças e taxas de inadimplência.' },
    { id: 'conformidade', label: 'Conformidade de Prazos', icon: CheckCircle2, desc: 'Métricas de entrega de obrigações acessórias e guias fiscais.' },
    { id: 'pessoal', label: 'Quadro de Pessoal & Custos', icon: Users, desc: 'Resumos sobre funcionários ativos, folha de pagamento e pendências admissionais.' },
    { id: 'tributario', label: 'Comparativo de Regimes', icon: TrendingUp, desc: 'Estudos e simulações fiscais comparando regimes tributários.' }
  ] as const;

  const currentReportOption = reportOptions.find(o => o.id === activeReport)!;

  return (
    <div className="relatorios-container animate-fade-in">
      {/* Title Header */}
      <div className="relatorios-header-row">
        <div className="relatorios-title">
          <h1>Relatórios & Análise Contábil</h1>
          <p>Consulte dados estatísticos, simulações fiscais e relatórios gerenciais das suas empresas.</p>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="relatorios-split-layout">
        {/* Left Menu Selection */}
        <div className="relatorios-menu-card">
          <div className="relatorios-menu-title">Selecione o Relatório</div>
          {reportOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                className={`btn-relatorio-option ${activeReport === opt.id ? 'active' : ''}`}
                onClick={() => setActiveReport(opt.id)}
              >
                <Icon size={18} />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Right Report Content */}
        <div className="relatorio-content-card">
          {/* Header Details */}
          <div className="relatorio-details-header">
            <div>
              <h2>{currentReportOption.label}</h2>
              <p>{currentReportOption.desc}</p>
            </div>
            {isGenerated && !isLoading && (
              <button className="btn-print-report" onClick={handlePrint}>
                <Printer size={16} /> Imprimir Relatório
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="relatorio-internal-filters">
            {activeReport !== 'tributario' && (
              <div className="relatorio-filter-item">
                <label>Empresa Cliente</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                >
                  <option value="Todos">Todas as Empresas</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeReport === 'faturamento' && (
              <>
                <div className="relatorio-filter-item">
                  <label>Data Inicial</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="relatorio-filter-item">
                  <label>Data Final</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}

            {activeReport === 'tributario' && (
              <>
                <div className="relatorio-filter-item">
                  <label>Faturamento Anual (R$)</label>
                  <input
                    type="number"
                    value={faturamentoAnual}
                    onChange={(e) => setFaturamentoAnual(e.target.value)}
                    placeholder="Faturamento estimado"
                  />
                </div>
                <div className="relatorio-filter-item">
                  <label>Folha de Pagamento Anual (R$)</label>
                  <input
                    type="number"
                    value={custoFolhaAnual}
                    onChange={(e) => setCustoFolhaAnual(e.target.value)}
                    placeholder="Custo anual da folha"
                  />
                </div>
              </>
            )}

            <button className="btn-generate-report" onClick={handleGenerateReport} disabled={isLoading}>
              <FileText size={16} />
              {isLoading ? 'Processando...' : 'Gerar Relatório'}
            </button>
          </div>

          {/* Report Output Area */}
          <div className="relatorio-output-area" style={{ flex: 1 }}>
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', color: 'var(--color-text-muted)', gap: '8px' }}>
                <span className="sub-loading" style={{ margin: 0 }}>Processando dados e compilando gráficos...</span>
              </div>
            ) : isGenerated ? (
              <>
                {activeReport === 'faturamento' && faturamentoData && (
                  <FaturamentoRelatorio data={faturamentoData} formatCurrency={formatCurrency} />
                )}
                {activeReport === 'conformidade' && conformidadeData && (
                  <AtividadesRelatorio data={conformidadeData} />
                )}
                {activeReport === 'pessoal' && pessoalData && (
                  <PessoalRelatorio data={pessoalData} formatCurrency={formatCurrency} />
                )}
                {activeReport === 'tributario' && tributarioData && (
                  <TributarioRelatorio data={tributarioData} formatCurrency={formatCurrency} />
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
                <FileText size={48} style={{ marginBottom: '12px', strokeWidth: 1 }} />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#64748b' }}>Relatório Pronto para Geração</h4>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', maxWidth: '320px' }}>
                  Configure os filtros acima e clique no botão <strong>Gerar Relatório</strong> para exibir as análises.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
