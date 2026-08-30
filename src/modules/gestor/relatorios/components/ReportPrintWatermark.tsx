import React from 'react';
import {
  resolveMarcaDaguaParaRelatorio,
  type MarcaDaguaDados,
} from '../../configuracoes/marca-dagua/services/marcaDaguaService';

interface ReportPrintWatermarkProps {
  config: MarcaDaguaDados | undefined;
}

const positionStyle = (
  position: ReturnType<typeof resolveMarcaDaguaParaRelatorio>['posicao'],
  size: number,
): React.CSSProperties => {
  const common = { width: `${size}%`, height: `${size}%` };

  if (position === 'topo-esquerda') {
    return { ...common, top: '12mm', left: '12mm' };
  }
  if (position === 'topo-direita') {
    return { ...common, top: '12mm', right: '12mm' };
  }
  if (position === 'rodape-direita') {
    return { ...common, right: '12mm', bottom: '12mm' };
  }
  return {
    ...common,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };
};

/** Renders the configured portrait mark above browser-print report pages. */
export const ReportPrintWatermark: React.FC<ReportPrintWatermarkProps> = ({ config }) => {
  const watermark = resolveMarcaDaguaParaRelatorio(config, 'retrato');
  if (!watermark.habilitado || !watermark.fileUrl) return null;

  const opacity = Math.max(0, Math.min(100, watermark.opacidade)) / 100;
  const size = Math.max(0, Math.min(100, watermark.tamanho));
  if (opacity === 0 || size === 0) return null;

  return (
    <div className="report-print-watermark" aria-hidden="true">
      <img
        className="report-print-watermark__image"
        src={watermark.fileUrl}
        alt=""
        style={{
          ...positionStyle(watermark.posicao, size),
          opacity,
        }}
      />
    </div>
  );
};
