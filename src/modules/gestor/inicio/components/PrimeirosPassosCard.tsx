import React, { useMemo } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  CircleDot,
  ClipboardCheck,
  Image,
  ListTodo,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import type { InicioSetupStatus } from '../services/inicioSetupService';
import type { InicioSetupTarget } from '../services/inicioNavigation';

interface PrimeirosPassosCardProps {
  status?: InicioSetupStatus;
  isLoading: boolean;
  isError: boolean;
  onNavigate: (target: InicioSetupTarget) => void;
  onRetry: () => void;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  action: string;
  complete: boolean;
  recommended?: boolean;
  icon: React.ReactNode;
  target: InicioSetupTarget;
}

export const PrimeirosPassosCard: React.FC<PrimeirosPassosCardProps> = ({
  status,
  isLoading,
  isError,
  onNavigate,
  onRetry,
}) => {
  const steps = useMemo<SetupStep[]>(() => status ? [
    {
      id: 'empresa',
      title: 'Dados do escritório',
      description: status.empresaCompleta
        ? 'Cadastro fiscal, contato e endereço conferidos.'
        : 'Complete CNPJ, contato e endereço para emitir documentos corretos.',
      action: status.empresaCompleta ? 'Revisar cadastro' : 'Completar cadastro',
      complete: status.empresaCompleta,
      icon: <Building2 size={20} />,
      target: { moduleId: 'configuracoes', configSubTab: 'empresa' },
    },
    {
      id: 'clientes',
      title: 'Primeiro cliente',
      description: status.clientesAtivos > 0
        ? `${status.clientesAtivos} ${status.clientesAtivos === 1 ? 'cliente ativo' : 'clientes ativos'} no escritório.`
        : 'Cadastre a primeira empresa atendida para iniciar a operação.',
      action: status.clientesAtivos > 0 ? 'Ver clientes' : 'Cadastrar cliente',
      complete: status.clientesAtivos > 0,
      icon: <Users size={20} />,
      target: { moduleId: 'clientes' },
    },
    {
      id: 'modelos',
      title: 'Modelos de fechamento',
      description: status.modelosVinculados
        ? `${status.clientesComModelos}/${status.clientesAtivos} clientes com checklists vinculados.`
        : 'Revise os checklists e vincule os modelos adequados a cada regime.',
      action: status.modelosVinculados ? 'Revisar modelos' : 'Configurar modelos',
      complete: status.modelosVinculados,
      icon: <ClipboardCheck size={20} />,
      target: { moduleId: 'parametrizacao-checklists' },
    },
    {
      id: 'operacao',
      title: 'Rotina operacional',
      description: status.operacaoPlanejada
        ? `${status.rotinasAtivas} rotinas e ${status.tarefasAtivas} tarefas ativas.`
        : 'Cadastre tarefas recorrentes para alimentar a fila da equipe.',
      action: status.operacaoPlanejada ? 'Revisar rotinas' : 'Planejar rotina',
      complete: status.operacaoPlanejada,
      icon: <ListTodo size={20} />,
      target: { moduleId: 'atividades-modelos' },
    },
    {
      id: 'identidade',
      title: 'Identidade visual',
      description: status.identidadeCompleta
        ? 'Logo e marcas d’água configuradas.'
        : status.logoConfigurado
          ? 'Adicione as marcas d’água para personalizar os documentos.'
          : 'Adicione o logotipo do escritório antes de personalizar os documentos.',
      action: status.identidadeCompleta
        ? 'Revisar identidade'
        : status.logoConfigurado ? 'Configurar marca d’água' : 'Adicionar logotipo',
      complete: status.identidadeCompleta,
      recommended: true,
      icon: <Image size={20} />,
      target: {
        moduleId: 'configuracoes',
        configSubTab: status.logoConfigurado ? 'marca-dagua' : 'empresa',
      },
    },
    {
      id: 'equipe',
      title: 'Equipe e acessos',
      description: status.usuariosAtivos > 0
        ? `${status.usuariosAtivos} ${status.usuariosAtivos === 1 ? 'usuário ativo' : 'usuários ativos'} com acesso ao sistema.`
        : 'Cadastre os responsáveis e defina os acessos de cada função.',
      action: status.usuariosAtivos > 0 ? 'Revisar equipe' : 'Configurar equipe',
      complete: status.usuariosAtivos > 0,
      recommended: true,
      icon: <Users size={20} />,
      target: { moduleId: 'configuracoes', configSubTab: 'usuarios' },
    },
  ] : [], [status]);

  if (isLoading) {
    return (
      <section className="inicio-setup-card inicio-setup-card--loading" role="status" aria-live="polite">
        <div className="inicio-setup-loading-icon"><Sparkles size={22} /></div>
        <div>
          <strong>Preparando seus primeiros passos...</strong>
          <span>Verificando o que já está configurado.</span>
        </div>
      </section>
    );
  }

  if (isError || !status) {
    return (
      <section className="inicio-setup-card inicio-setup-card--error" role="alert">
        <div>
          <strong>Não foi possível verificar a configuração agora.</strong>
          <span>O painel continua disponível; tente atualizar somente este guia.</span>
        </div>
        <button type="button" onClick={onRetry}><RefreshCw size={15} /> Tentar novamente</button>
      </section>
    );
  }

  const nextRequiredStep = steps.find((step) => !step.recommended && !step.complete)?.id;
  const progress = Math.round((status.essenciaisConcluidos / status.essenciaisTotal) * 100);
  const allDone = status.configuracaoEssencialCompleta && status.configuracaoRecomendadaCompleta;

  return (
    <section className={`inicio-setup-card ${allDone ? 'inicio-setup-card--complete' : ''}`} aria-labelledby="inicio-setup-title">
      <header className="inicio-setup-header">
        <div className="inicio-setup-heading">
          <div className="inicio-setup-heading-icon"><Sparkles size={22} /></div>
          <div>
            <span className="inicio-setup-eyebrow">Primeiros passos</span>
            <h2 id="inicio-setup-title">
              {status.configuracaoEssencialCompleta ? 'Seu escritório está pronto para operar' : 'Comece por aqui'}
            </h2>
            <p>
              {status.configuracaoEssencialCompleta
                ? 'A configuração essencial foi concluída. Revise os itens quando precisar.'
                : 'Siga esta ordem para deixar a operação organizada desde o primeiro acesso.'}
            </p>
          </div>
        </div>
        <div className="inicio-setup-progress-summary" aria-label={`${status.essenciaisConcluidos} de ${status.essenciaisTotal} etapas essenciais concluídas`}>
          <strong>{status.essenciaisConcluidos}/{status.essenciaisTotal}</strong>
          <span>essenciais</span>
        </div>
      </header>

      <div className="inicio-setup-progress" aria-hidden="true">
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="inicio-setup-steps">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={`inicio-setup-step ${step.complete ? 'is-complete' : ''}`}
            onClick={() => onNavigate(step.target)}
            aria-current={step.id === nextRequiredStep ? 'step' : undefined}
          >
            <span className="inicio-setup-step-icon">{step.icon}</span>
            <span className="inicio-setup-step-copy">
              <span className="inicio-setup-step-meta">
                {step.complete ? <><Check size={12} /> Concluído</> : step.recommended ? 'Recomendado' : 'Essencial'}
              </span>
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </span>
            <span className="inicio-setup-step-action">
              {step.action} {step.id === nextRequiredStep ? <CircleDot size={13} /> : <ArrowRight size={13} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
