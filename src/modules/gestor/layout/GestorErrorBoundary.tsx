import { Component, type ErrorInfo, type ReactNode } from 'react';

interface GestorErrorBoundaryProps {
  onReset: () => void;
  children: ReactNode;
}

interface GestorErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class GestorErrorBoundary extends Component<GestorErrorBoundaryProps, GestorErrorBoundaryState> {
  state: GestorErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'Erro inesperado ao carregar o sistema.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro ao renderizar área do Gestor:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          alignItems: 'center',
          background: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', color: '#f97316' }}>
            Falha ao abrir o sistema
          </h2>
          <p style={{ margin: 0 }}>{this.state.message || 'Aconteceu um erro inesperado.'}</p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: '14px',
              border: 'none',
              background: '#c59235',
              color: '#fff',
              borderRadius: '8px',
              padding: '10px 18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }
}
