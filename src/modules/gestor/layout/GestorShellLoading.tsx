import { LoaderCircle, RefreshCw } from 'lucide-react';
import systemLogoImg from '../../../assets/camada-o.png';
import './GestorShellLoading.css';

type GestorShellLoadingProps = {
  message?: string;
  error?: boolean;
  onRetry?: () => void;
  onExit?: () => void;
  overlay?: boolean;
};

export const GestorShellLoading = ({
  message = 'Preparando seu ambiente de trabalho...',
  error = false,
  onRetry,
  onExit,
  overlay = false,
}: GestorShellLoadingProps) => (
  <div
    className={`gestor-shell-loading${overlay ? ' gestor-shell-loading--overlay' : ''}`}
    role={error ? 'alert' : 'status'}
    aria-live={error ? 'assertive' : 'polite'}
    aria-busy={!error}
  >
    <div className="gestor-shell-loading__glow" aria-hidden="true" />
    <section className="gestor-shell-loading__card">
      <div className="gestor-shell-loading__brand">
        <img src={systemLogoImg} alt="" className="gestor-shell-loading__logo" />
        <div>
          <strong>Arkhen</strong>
          <span>Gestão Contábil</span>
        </div>
      </div>

      {error ? (
        <RefreshCw className="gestor-shell-loading__status-icon" size={26} aria-hidden="true" />
      ) : (
        <LoaderCircle className="gestor-shell-loading__spinner" size={30} aria-hidden="true" />
      )}

      <p>{message}</p>
      <small>{error ? 'Verifique a conexão e tente novamente.' : 'Carregando módulos e permissões'}</small>

      {error ? (
        <div className="gestor-shell-loading__actions">
          {onExit ? <button type="button" className="secondary" onClick={onExit}>Voltar ao login</button> : null}
          {onRetry ? <button type="button" onClick={onRetry}>Tentar novamente</button> : null}
        </div>
      ) : null}
    </section>
  </div>
);
