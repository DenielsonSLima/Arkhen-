import React, { useMemo, useState } from 'react';
import type { ClienteEmpresa } from '../services/planejamento.mock';
import {
  type ComparativoRegimes,
  formatCurrency,
  formatPercent,
  rpc_gerarDiagnosticoTributario,
} from '../services/planejamento.service';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Printer,
  Save,
} from 'lucide-react';
import './AnaliseCliente.css';

interface Props {
  clientes: ClienteEmpresa[];
  clienteSelecionadoId: string;
  setClienteSelecionadoId: (id: string) => void;
  clienteSelecionado: ClienteEmpresa;
  analise: ComparativoRegimes;
}

const BARRA_CLS: Record<string, string> = {
  'Simples Nacional': 'sn',
  'Lucro Presumido': 'lp',
  'Lucro Real': 'lr',
};

export const AnaliseCliente: React.FC<Props> = ({
  clientes,
  clienteSelecionadoId,
  setClienteSelecionadoId,
  clienteSelecionado,
  analise,
}) => {
  const [feedbackAcao, setFeedbackAcao] = useState<string | null>(null);
  const maxImposto = Math.max(...analise.resultados.map((r) => r.impostoAnual), 1);
  const isMudancaSugerida = clienteSelecionado.regimeAtual !== analise.regimeSugerido;
  const diagnostico = useMemo(
    () => rpc_gerarDiagnosticoTributario(clienteSelecionado, analise),
    [clienteSelecionado, analise],
  );

  const handleSalvarAnalise = () => {
    localStorage.setItem(`analise-tributaria-${clienteSelecionado.id}`, JSON.stringify({
      clienteId: clienteSelecionado.id,
      clienteNome: clienteSelecionado.nome,
      diagnostico,
      salvoEm: new Date().toISOString(),
    }));
    setFeedbackAcao('Análise salva neste dispositivo.');
  };

  const handlePrint = (acao: string) => {
    setFeedbackAcao(acao);
    window.print();
  };

  return (
    <div className="planejamento-tab-content">
      {/* Seletor */}
      <div className="analise-topbar">
        <div className="analise-toolbar">
          <Building2 size={18} color="#c59235" />
          <label>Empresa Cliente:</label>
          <select
            value={clienteSelecionadoId}
            onChange={(e) => setClienteSelecionadoId(e.target.value)}
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="analise-actions" aria-label="Ações da análise">
          <button type="button" onClick={() => handlePrint('PDF pronto para impressão.')}>
            <FileText size={15} />
            Gerar PDF
          </button>
          <button type="button" onClick={handleSalvarAnalise}>
            <Save size={15} />
            Salvar análise
          </button>
          <button type="button" onClick={() => handlePrint('Enviando análise para impressão.')}>
            <Printer size={15} />
            Imprimir
          </button>
        </div>
      </div>
      {feedbackAcao && <div className="analise-action-feedback">{feedbackAcao}</div>}

      {/* Info card */}
      <div className="analise-info-card">
        <div className="analise-info-item">
          <span>Razão Social</span>
          <strong>{clienteSelecionado.nome}</strong>
        </div>
        <div className="analise-info-item">
          <span>CNPJ</span>
          <strong>{clienteSelecionado.cnpj}</strong>
        </div>
        <div className="analise-info-item">
          <span>Regime Atual</span>
          <strong>{clienteSelecionado.regimeAtual}</strong>
        </div>
        <div className="analise-info-item">
          <span>Fat. Mensal</span>
          <strong>{formatCurrency(clienteSelecionado.faturamentoMensal)}</strong>
        </div>
        <div className="analise-info-item">
          <span>Fat. 12 Meses</span>
          <strong>{formatCurrency(clienteSelecionado.faturamento12Meses)}</strong>
        </div>
        <div className="analise-info-item">
          <span>CNAE</span>
          <strong>{clienteSelecionado.cnaeDescricao}</strong>
        </div>
        <div className="analise-info-item">
          <span>Folha de Pagamento</span>
          <strong>{formatCurrency(clienteSelecionado.folhaPagamentoMensal)}</strong>
        </div>
        <div className="analise-info-item">
          <span>Funcionários</span>
          <strong>{clienteSelecionado.funcionarios}</strong>
        </div>
      </div>

      {/* Alerta de mudança */}
      {isMudancaSugerida && (
        <div className="analise-alerta-mudanca">
          <AlertTriangle size={18} />
          <span>
            Esta empresa está no <strong>{clienteSelecionado.regimeAtual}</strong>, mas a análise sugere migração para o{' '}
            <strong>{analise.regimeSugerido}</strong> com economia estimada de{' '}
            <b>{formatCurrency(diagnostico.economiaAnual)}/ano</b>.
          </span>
        </div>
      )}

      <div className="diagnostico-card">
        <div className="diagnostico-card-title">
          <ClipboardCheck size={20} />
          <h3>Diagnóstico Tributário</h3>
        </div>
        <div className="diagnostico-grid">
          <div>
            <span>Regime atual</span>
            <strong>{diagnostico.regimeAtual}</strong>
          </div>
          <div>
            <span>Regime recomendado</span>
            <strong>{diagnostico.regimeRecomendado}</strong>
          </div>
          <div>
            <span>Economia estimada</span>
            <strong>{formatCurrency(diagnostico.economiaAnual)} por ano</strong>
          </div>
          <div>
            <span>Grau de recomendação</span>
            <strong>
              {'★'.repeat(diagnostico.estrelas)}{'☆'.repeat(5 - diagnostico.estrelas)} ({diagnostico.grauRecomendacao})
            </strong>
          </div>
          <div>
            <span>Confiança da análise</span>
            <strong>{diagnostico.confiancaAnalise}%</strong>
          </div>
        </div>
      </div>

      {/* Barras comparativas */}
      <div className="analise-barras-card">
        <div className="analise-section-title">
          Carga Tributária Estimada por Regime
        </div>
        {analise.resultados.map((r) => {
          const isMelhor = r.regime === analise.regimeSugerido;
          const isAtual = r.regime === clienteSelecionado.regimeAtual;
          const pct = (r.impostoAnual / maxImposto) * 100;
          return (
            <div key={r.regime} className="analise-bar-item">
              <div className="analise-bar-header">
                <div className="analise-bar-regime">
                  {r.regime}
                  {isMelhor && <span>★ Sugerido</span>}
                  {isAtual && !isMelhor && <em>atual</em>}
                </div>
                <div className="analise-bar-values">
                  <strong>{formatCurrency(r.impostoAnual)}</strong>
                  <span>{formatPercent(r.aliquotaEfetiva)}</span>
                </div>
              </div>
              <div className="analise-bar-track">
                <div
                  className={`analise-bar-fill ${isMelhor ? 'melhor' : BARRA_CLS[r.regime]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {isMelhor && diagnostico.economiaAnual > 0 && (
                <div className="analise-bar-economia">
                  Economia: <strong>{formatCurrency(diagnostico.economiaAnual)}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="analise-insights-grid">
        <div className="analise-text-card">
          <h3>Por que o sistema recomenda isso?</h3>
          <div className="analise-text-list">
            {diagnostico.explicacoes.map((explicacao) => (
              <div key={explicacao}>
                <CheckCircle2 size={16} />
                <span>{explicacao}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="analise-text-card atencao">
          <h3>Pontos de Atenção</h3>
          <div className="analise-text-list">
            {diagnostico.pontosAtencao.map((ponto) => (
              <div key={ponto}>
                <AlertTriangle size={16} />
                <span>{ponto}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
