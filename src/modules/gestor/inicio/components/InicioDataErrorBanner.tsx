import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface InicioDataErrorBannerProps {
  sources: string[];
  onRetry: () => void;
}

export const InicioDataErrorBanner: React.FC<InicioDataErrorBannerProps> = ({ sources, onRetry }) => (
  <section className="inicio-data-error" role="alert">
    <AlertTriangle size={20} aria-hidden />
    <div>
      <strong>Parte do painel não pôde ser atualizada</strong>
      <p>Dados indisponíveis: {sources.join(', ')}. Os demais resultados continuam visíveis.</p>
    </div>
    <button type="button" onClick={onRetry}>
      <RefreshCw size={16} aria-hidden />
      Tentar novamente
    </button>
  </section>
);
