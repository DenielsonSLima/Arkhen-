import React from 'react';
import { FileDown, FileX2, LoaderCircle } from 'lucide-react';
import { SimuladorRescisao } from './rescisao/SimuladorRescisao';
import { RescisaoPdfModal } from './rescisao/RescisaoPdfModal';
import { useRescisaoCalculator } from './rescisao/useRescisaoCalculator';
import { useRescisaoPdf } from './rescisao/useRescisaoPdf';
import './SimulacoesCalculos.css';

export const SimulacoesCalculosPage: React.FC = () => {
  const calculator = useRescisaoCalculator();
  const selectedTipoLabel = calculator.tiposRescisao.find(
    (tipo) => tipo.id === calculator.params.tipo,
  )?.label;
  const pdf = useRescisaoPdf(
    calculator.params,
    calculator.resultado,
    calculator.envelope,
    selectedTipoLabel,
  );

  return (
    <div className="simulacoes-container animate-fade-in">
      <main className="simulacoes-main">
        <header className="simulacoes-page-header">
          <div>
            <span className="simulacoes-eyebrow"><FileX2 size={15} /> Simulações</span>
            <h1>Calculadora de Rescisão</h1>
            <p>Calcule verbas rescisórias com os parâmetros trabalhistas vigentes.</p>
          </div>
          <button
            type="button"
            className="simulation-report-button"
            onClick={pdf.open}
            disabled={
              calculator.isCalculating
              || pdf.isConfigLoading
              || Boolean(calculator.error)
              || !calculator.envelope
            }
          >
            {calculator.isCalculating
              ? <LoaderCircle size={17} className="simulation-spinner" />
              : <FileDown size={17} />}
            Gerar relatório PDF
          </button>
        </header>

        {calculator.error && (
          <div className="simulation-error" role="alert">{calculator.error}</div>
        )}

        <SimuladorRescisao
          params={calculator.params}
          setParams={calculator.setParams}
          resultado={calculator.resultado}
          tiposRescisao={calculator.tiposRescisao}
        />

        <footer className="simulation-estimate-note">
          Resultado estimativo. Confira documentos, convenção coletiva, médias variáveis e eventos do vínculo antes de emitir o TRCT.
        </footer>
      </main>

      {pdf.isOpen && (
        <RescisaoPdfModal
          bytes={pdf.bytes}
          pageCount={pdf.pageCount}
          loading={pdf.isGenerating}
          error={pdf.error}
          onClose={pdf.close}
          onDownload={() => { void pdf.download(); }}
        />
      )}
    </div>
  );
};
