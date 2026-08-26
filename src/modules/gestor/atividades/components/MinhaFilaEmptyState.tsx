import React from 'react';
import { AlertTriangle, CheckCircle2, Link2Off, LoaderCircle, RefreshCw, Repeat } from 'lucide-react';

interface MinhaFilaEmptyStateProps {
  kind: 'loading' | 'error' | 'session' | 'unlinked' | 'company-empty' | 'no-assignment' | 'no-results';
  onConfigureRotinas?: () => void;
  onRetry?: () => void;
}

export const MinhaFilaEmptyState: React.FC<MinhaFilaEmptyStateProps> = ({
  kind,
  onConfigureRotinas,
  onRetry,
}) => {
  const content = {
    loading: {
      icon: <LoaderCircle size={38} color="var(--color-gold-primary)" />,
      title: 'Carregando sua fila',
      description: 'Estamos identificando seu usuário e buscando somente as tarefas atribuídas a você.',
    },
    error: {
      icon: <AlertTriangle size={38} color="#b91c1c" />,
      title: 'Não foi possível carregar sua fila',
      description: 'A consulta falhou. Tente novamente para evitar interpretar uma falha como ausência de trabalho.',
    },
    session: {
      icon: <AlertTriangle size={38} color="#b91c1c" />,
      title: 'Sessão não identificada',
      description: 'Não foi possível confirmar qual usuário está conectado. Atualize a sessão antes de consultar tarefas.',
    },
    unlinked: {
      icon: <Link2Off size={38} color="#c2410c" />,
      title: 'Seu acesso ainda não está vinculado à equipe',
      description: 'Peça a um administrador para vincular este login a um usuário ativo. Sem esse vínculo, a fila pessoal não pode ser determinada com segurança.',
    },
    'company-empty': {
      icon: <CheckCircle2 size={38} color="var(--color-gold-primary)" />,
      title: 'Ainda não existem tarefas programadas',
      description: 'Crie uma rotina a partir de um modelo para gerar os próximos trabalhos automaticamente.',
    },
    'no-assignment': {
      icon: <CheckCircle2 size={38} color="var(--color-gold-primary)" />,
      title: 'Nenhuma tarefa atribuída a você',
      description: 'Há trabalho cadastrado para a empresa, mas nada está vinculado ao seu usuário neste momento.',
    },
    'no-results': {
      icon: <CheckCircle2 size={38} color="var(--color-gold-primary)" />,
      title: 'Nenhuma tarefa neste recorte',
      description: 'Sua fila não possui tarefas que correspondam ao período, categoria ou busca selecionados.',
    },
  }[kind];

  return (
    <div
      className="empty-state-card"
      style={emptyStateStyle}
      role={kind === 'error' || kind === 'session' ? 'alert' : 'status'}
    >
      {content.icon}
      <strong style={titleStyle}>{content.title}</strong>
      <p style={descriptionStyle}>{content.description}</p>
      {(kind === 'error' || kind === 'session') && onRetry && (
        <button type="button" onClick={onRetry} style={actionButtonStyle}>
          <RefreshCw size={15} /> Tentar novamente
        </button>
      )}
      {kind === 'company-empty' && onConfigureRotinas && (
        <button type="button" onClick={onConfigureRotinas} style={actionButtonStyle}>
          <Repeat size={15} /> Ver rotinas programadas
        </button>
      )}
    </div>
  );
};

const emptyStateStyle = {
  padding: '40px',
  textAlign: 'center' as const,
  color: '#64748b',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: '10px',
};
const titleStyle = { color: '#0f172a', fontSize: '0.96rem' };
const descriptionStyle = { maxWidth: '620px', margin: 0, lineHeight: 1.55 };
const actionButtonStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '8px',
  padding: '9px 14px',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
