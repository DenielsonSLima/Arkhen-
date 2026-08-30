import React, { useState, useEffect } from 'react';
import { Download, X, Check, FileDown, Calculator } from 'lucide-react';
import { useSimulacoesCalculos } from './hooks/useSimulacoesCalculos';
import { SimuladorRescisao } from './rescisao/SimuladorRescisao';
import { useEmpresaQuery } from '../configuracoes/empresa/queries/useEmpresaQueries';
import { useMarcaDaguaQuery } from '../configuracoes/marca-dagua/queries/useMarcaDaguaQueries';
import { resolveMarcaDaguaParaRelatorio } from '../configuracoes/marca-dagua/services/marcaDaguaService';
import {
  generateSimulationPdf,
  getImageDetails,
  pdfBytesToDataUrl,
} from './pdf/generateSimulationPdf';
import { SimulationPdfPreview } from './pdf/SimulationPdfPreview';
import { buildLegacyPdfSections } from './pdf/buildLegacyPdfSections';

import './SimulacoesCalculos.css';
import './SimulacoesPdfModal.css';

export const SimulacoesCalculosPage: React.FC = () => {
  const {
    erroCalculo,
    calculando,
    resultadoCarregado,
    rescisaoParams,
    setRescisaoParams,
    resultadoRescisao,
    relatorioDisponivel,
    tiposRescisao,
  } = useSimulacoesCalculos();
  const empresaQuery = useEmpresaQuery();
  const marcaDaguaQuery = useMarcaDaguaQuery();

  // Estados do Modal de PDF e exportação
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [downloadState, setDownloadState] = useState<'idle' | 'generating' | 'done'>('idle');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    if (!isPdfModalOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPdfModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPdfModalOpen]);

  const empresa = empresaQuery.data;
  const marcaDagua = marcaDaguaQuery.data;
  const identidadeComErro = empresaQuery.isError || marcaDaguaQuery.isError;
  const identidadeCarregando = empresaQuery.isLoading || marcaDaguaQuery.isLoading;
  const podeGerarRelatorio = relatorioDisponivel && !identidadeCarregando && !identidadeComErro;

  const handleOpenPdfModal = async () => {
    if (!podeGerarRelatorio) return;
    setIsPdfModalOpen(true);
    setPdfLoading(true);
    setPdfError('');

    try {
      let logoDataUrl = null;
      let logoAspectRatio = 1;
      if (empresa?.logoUrl) {
        try {
          const details = await getImageDetails(empresa.logoUrl);
          logoDataUrl = details.dataUrl;
          logoAspectRatio = details.aspectRatio;
        } catch (e) {
          console.warn('Erro ao carregar logotipo:', e);
        }
      }

      const watermark = resolveMarcaDaguaParaRelatorio(marcaDagua, 'retrato');
      let watermarkDataUrl: string | null = null;
      let watermarkAspectRatio = 1;
      if (watermark.habilitado && watermark.fileUrl) {
        try {
          const details = await getImageDetails(watermark.fileUrl);
          watermarkDataUrl = details.dataUrl;
          watermarkAspectRatio = details.aspectRatio;
        } catch (e) {
          console.warn('Erro ao carregar marca dágua:', e);
        }
      }

      const generatedPdf = await generateSimulationPdf({
        title: 'Calculadora de Rescisão',
        generatedAt: new Date(),
        company: {
          razaoSocial: empresa?.razaoSocial || 'Escritório Contábil',
          nomeFantasia: empresa?.nomeFantasia || '',
          cnpj: empresa?.cnpj || '',
          telefone: empresa?.telefone || '',
          email: empresa?.email || '',
          endereco: empresa?.endereco || '',
          numero: String(empresa?.numero || ''),
          cidade: empresa?.cidade || '',
          estado: empresa?.estado || '',
          cep: empresa?.cep || '',
          logoDataUrl: logoDataUrl,
          logoAspectRatio: logoAspectRatio,
        },
        sections: buildLegacyPdfSections('rescisao', {
          params: rescisaoParams,
          resultado: resultadoRescisao,
        }),
        watermark: {
          enabled: watermark.habilitado,
          dataUrl: watermarkDataUrl,
          opacity: watermark.opacidade,
          size: watermark.tamanho,
          position: watermark.posicao,
          aspectRatio: watermarkAspectRatio,
        },
      });

      setPdfBytes(generatedPdf.bytes);
      setPdfPageCount(generatedPdf.pageCount);
    } catch (err) {
      console.error('Erro ao gerar PDF de rescisão:', err);
      setPdfError('Não foi possível gerar a pré-visualização do PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBytes) return;
    setDownloadState('generating');
    try {
      const pdfBuffer = Uint8Array.from(pdfBytes).buffer;
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Simulacao_Rescisao_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 2500);
    } catch (err) {
      console.error(err);
      setDownloadState('idle');
    }
  };

  return (
    <div className="simulacoes-container">
      <header className="simulacoes-header">
        <div className="simulacoes-header-title">
          <div className="simulacoes-icon-badge">
            <Calculator size={24} color="#c59235" />
          </div>
          <div>
            <h2>Calculadora de Rescisão</h2>
            <p>Verbas rescisórias: saldo de salário, 13º, férias, aviso prévio e multa do FGTS.</p>
          </div>
        </div>

        <div className="simulacoes-header-actions">
          <button
            className="simulacoes-btn secondary"
            onClick={handleOpenPdfModal}
            disabled={!podeGerarRelatorio}
            title={podeGerarRelatorio
              ? 'Gerar relatório em PDF'
              : identidadeComErro
                ? 'Não foi possível carregar os dados da empresa e da marca d’água'
                : 'Aguarde o cálculo e a identidade visual serem carregados'}
          >
            <Download size={16} /> Relatório PDF
          </button>
        </div>
      </header>

      {erroCalculo && (
        <div className="simulacoes-banner-error" style={{ margin: '16px 24px 0 24px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem' }}>
          <strong>Erro no cálculo:</strong> {erroCalculo}
        </div>
      )}

      {identidadeComErro && (
        <div className="simulacoes-banner-error" role="alert" style={{ margin: '16px 24px 0 24px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.85rem' }}>
          Não foi possível carregar os dados da empresa ou a marca d’água. Atualize a página antes de gerar o relatório.
        </div>
      )}

      {calculando && (
        <div
          aria-live="polite"
          style={{ margin: '16px 24px 0', padding: '12px 16px', background: 'rgba(197, 146, 53, 0.08)', border: '1px solid rgba(197, 146, 53, 0.25)', borderRadius: 8, color: '#8a6420', fontSize: '0.85rem' }}
        >
          {resultadoCarregado
            ? 'Atualizando o cálculo no servidor. O resultado anterior permanece visível até a conclusão.'
            : 'Calculando a rescisão no servidor...'}
        </div>
      )}

      <main className="simulacoes-main-content" style={{ padding: 24 }}>
        <SimuladorRescisao
          params={rescisaoParams}
          setParams={setRescisaoParams}
          resultado={resultadoRescisao}
          tiposRescisao={tiposRescisao}
        />
      </main>

      {/* Modal de PDF / Exportação */}
      {isPdfModalOpen && (
        <div className="simulacoes-pdf-backdrop" onClick={() => setIsPdfModalOpen(false)}>
          <div
            className="simulacoes-pdf-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="simulacoes-pdf-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="simulacoes-pdf-modal-header">
              <h3 id="simulacoes-pdf-title">Pré-visualização do Relatório — Rescisão</h3>
              <button className="simulacoes-pdf-close" aria-label="Fechar pré-visualização" onClick={() => setIsPdfModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="simulacoes-pdf-modal-body">
              <div className="simulacoes-pdf-preview-area">
                {pdfLoading ? (
                  <div className="simulacoes-pdf-loading">Gerando pré-visualização em alta qualidade...</div>
                ) : pdfError ? (
                  <div className="simulacoes-pdf-error">{pdfError}</div>
                ) : pdfBytes ? (
                  <SimulationPdfPreview pdfDataUrl={pdfBytesToDataUrl(pdfBytes)} pageCount={pdfPageCount} />
                ) : null}
              </div>

              <div className="simulacoes-pdf-options-sidebar">
                <h4>Ações do Relatório</h4>
                <div className="simulacoes-pdf-actions-stack">
                  <button
                    className="simulacoes-btn primary"
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading || !pdfBytes || downloadState === 'generating'}
                  >
                    {downloadState === 'generating' ? <FileDown size={16} /> : downloadState === 'done' ? <Check size={16} /> : <Download size={16} />}
                    {downloadState === 'generating' ? 'Baixando...' : downloadState === 'done' ? 'Concluído!' : 'Baixar PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
