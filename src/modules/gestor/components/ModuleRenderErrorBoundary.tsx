import React from 'react';

interface ModuleRenderErrorBoundaryProps {
  onReset: () => void;
  moduleName?: string;
  children: React.ReactNode;
}

interface ModuleRenderErrorBoundaryState {
  hasError: boolean;
  message: string;
  isChunkError: boolean;
}

export class ModuleRenderErrorBoundary extends React.Component<
  ModuleRenderErrorBoundaryProps,
  ModuleRenderErrorBoundaryState
> {
  constructor(props: ModuleRenderErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '', isChunkError: false };
  }

  static getDerivedStateFromError(error: Error) {
    const message = error?.message || '';
    const isChunkError = /failed to fetch|chunk|dynamically imported|module script failed/i.test(message);
    
    return {
      hasError: true,
      message: isChunkError 
        ? 'Uma nova versão do sistema está disponível. O sistema precisa ser atualizado.'
        : 'O módulo encontrou uma falha temporária. Tente novamente ou volte para o início.',
      isChunkError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Erro no módulo ${this.props.moduleName || 'desconhecido'}:`, error, errorInfo);
    
    const message = error?.message || '';
    const isChunkError = /failed to fetch|chunk|dynamically imported|module script failed/i.test(message);
    
    if (isChunkError) {
      try {
        const chunkReloadKey = 'arkhen_chunk_reload_attempts';
        const attempts = JSON.parse(sessionStorage.getItem(chunkReloadKey) || '{}');
        const currentPath = window.location.pathname + window.location.hash;
        
        if (!attempts[currentPath]) {
          attempts[currentPath] = true;
          sessionStorage.setItem(chunkReloadKey, JSON.stringify(attempts));
          window.location.reload();
        }
      } catch (e) {
        console.error('Erro ao recarregar a página automaticamente:', e);
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, message: '', isChunkError: false });
  };

  handleReset = () => {
    this.setState({ hasError: false, message: '', isChunkError: false });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="submodule-content-card" style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '1.25rem', fontWeight: 600 }}>
            {this.state.isChunkError ? 'Nova Versão Disponível' : 'Não foi possível abrir este módulo'}
          </h3>
          <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {this.state.message}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {this.state.isChunkError ? (
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-save-settings"
                style={{ padding: '10px 20px', fontWeight: 600 }}
              >
                Atualizar Sistema
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="btn-save-settings"
                  style={{ padding: '10px 20px', fontWeight: 600 }}
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="btn-save-settings"
                  style={{ 
                    padding: '10px 20px', 
                    fontWeight: 600, 
                    background: '#f1f5f9', 
                    border: '1px solid #cbd5e1', 
                    color: '#334155' 
                  }}
                >
                  Voltar para Início
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
