import React, { useCallback } from 'react';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import { InicioPage } from '../inicio/InicioPage';
import type { EmpresaDetailTab } from '../gestao-empresarial/hooks/useGestaoEmpresarial';
import type { DocumentosTab } from '../documentos/hooks/useDocumentos';
import type { FaturamentoTab, FaturamentoViewMode } from '../faturamento/FaturamentoPage';
import { resolveFinanceiroInitialTab } from './gestorModuleContext';

const RegimesTributariosPage = React.lazy(() => import('../parametrizacao/regimes/RegimesTributariosPage').then((module) => ({ default: module.RegimesTributariosPage })));
const CnaePage = React.lazy(() => import('../parametrizacao/cnae/CnaePage').then((module) => ({ default: module.CnaePage })));
const RegrasApuracaoPage = React.lazy(() => import('../parametrizacao/regras/RegrasApuracaoPage').then((module) => ({ default: module.RegrasApuracaoPage })));
const ParametrosCalculoPage = React.lazy(() => import('../parametrizacao/parametros-calculo/ParametrosCalculoPage').then((module) => ({ default: module.ParametrosCalculoPage })));
const TabelasTributariasPage = React.lazy(() => import('../parametrizacao/tabelas-tributarias/TabelasTributariasPage').then((module) => ({ default: module.TabelasTributariasPage })));
const PrazosEntregaPage = React.lazy(() => import('../parametrizacao/prazos-entrega/PrazosEntregaPage').then((module) => ({ default: module.PrazosEntregaPage })));
const ProtocolosTiposPage = React.lazy(() => import('../parametrizacao/protocolos/ProtocolosTiposPage').then((module) => ({ default: module.ProtocolosTiposPage })));
const ParametrizacaoPlaceholderPage = React.lazy(() => import('../parametrizacao/catalogos/ParametrizacaoPlaceholderPage').then((module) => ({ default: module.ParametrizacaoPlaceholderPage })));
const CategoriaClientePage = React.lazy(() => import('../parametrizacao/catalogos/CategoriaClientePage').then((module) => ({ default: module.CategoriaClientePage })));
const CategoriaFinanceiraPage = React.lazy(() => import('../parametrizacao/catalogos/CategoriaFinanceiraPage').then((module) => ({ default: module.CategoriaFinanceiraPage })));
const TiposDocumentosPage = React.lazy(() => import('../parametrizacao/catalogos/tipos-documentos/TiposDocumentosPage').then((module) => ({ default: module.TiposDocumentosPage })));
const PastasPadraoPage = React.lazy(() => import('../parametrizacao/pastas-padrao/PastasPadraoPage').then((module) => ({ default: module.PastasPadraoPage })));
const GestaoEmpresarialPage = React.lazy(() => import('../gestao-empresarial/GestaoEmpresarialPage').then((module) => ({ default: module.GestaoEmpresarialPage })));
const AtividadesPage = React.lazy(() => import('../atividades/AtividadesPage').then((module) => ({ default: module.AtividadesPage })));
const ConfigFluxosPage = React.lazy(() => import('../atividades/config/ConfigFluxosPage').then((module) => ({ default: module.ConfigFluxosPage })));
const PlanejamentoTributarioPage = React.lazy(() => import('../planejamento-tributario/PlanejamentoTributarioPage').then((module) => ({ default: module.PlanejamentoTributarioPage })));
const SimulacoesCalculosPage = React.lazy(() => import('../simulacoes-calculos/SimulacoesCalculosPage').then((module) => ({ default: module.SimulacoesCalculosPage })));
const ConformidadePage = React.lazy(() => import('../conformidade/ConformidadePage').then((module) => ({ default: module.ConformidadePage })));
const ProtocolosPage = React.lazy(() => import('../protocolos/ProtocolosPage').then((module) => ({ default: module.ProtocolosPage })));
const FinanceiroPage = React.lazy(() => import('../financeiro/FinanceiroPage').then((module) => ({ default: module.FinanceiroPage })));
const FaturamentoPage = React.lazy(() => import('../faturamento/FaturamentoPage').then((module) => ({ default: module.FaturamentoPage })));
const AgendaPage = React.lazy(() => import('../agenda/AgendaPage').then((module) => ({ default: module.AgendaPage })));
const RelatoriosPage = React.lazy(() => import('../relatorios/RelatoriosPage').then((module) => ({ default: module.RelatoriosPage })));
const ConfiguracoesPage = React.lazy(() => import('../configuracoes/ConfiguracoesPage').then((module) => ({ default: module.ConfiguracoesPage })));
const GuiaAjudaPage = React.lazy(() => import('../guia-ajuda/GuiaAjudaPage').then((module) => ({ default: module.GuiaAjudaPage })));
const ReformaTributariaPage = React.lazy(() => import('../reforma-tributaria/ReformaTributariaPage').then((module) => ({ default: module.ReformaTributariaPage })));
const DocumentosPage = React.lazy(() => import('../documentos/DocumentosPage')
  .then((module) => ({ default: module.DocumentosPage })));

type GestorModuleContentProps = {
  id: string;
  workspaceId?: string;
  initialContext?: InternalTabContext;
  updateTabContext: (tabId: string, context: InternalTabContext) => void;
  onModuleContextChange: (moduleId: string, context: InternalTabContext) => void;
  onInitialReady?: () => void;
};

export const GestorModuleContent: React.FC<GestorModuleContentProps> = ({
  id,
  workspaceId = id,
  initialContext,
  updateTabContext,
  onModuleContextChange,
  onInitialReady,
}) => {
  const onContextChange = useCallback((context: InternalTabContext) => {
    if (workspaceId.includes('__')) updateTabContext(workspaceId, context);
    else onModuleContextChange(id, context);
  }, [id, onModuleContextChange, updateTabContext, workspaceId]);

  switch (id) {
    case 'inicio': return <InicioPage onInitialReady={onInitialReady} />;
    case 'clientes':
      return (
        <GestaoEmpresarialPage
          initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
          initialDetailTab={initialContext?.data?.activeDetailTab as EmpresaDetailTab | undefined}
          onViewContextChange={onContextChange}
        />
      );
    case 'parametrizacao-regimes': return <RegimesTributariosPage />;
    case 'parametrizacao-tipos-empresa': return <ParametrizacaoPlaceholderPage kind="tipos-empresa" />;
    case 'parametrizacao-natureza-juridica': return <ParametrizacaoPlaceholderPage kind="natureza-juridica" />;
    case 'parametrizacao-tipos-parceiros': return <ParametrizacaoPlaceholderPage kind="tipos-parceiros" />;
    case 'parametrizacao-categorias-clientes': return <CategoriaClientePage />;
    case 'parametrizacao-categoria-financeira': return <CategoriaFinanceiraPage />;
    case 'parametrizacao-cnae': return <CnaePage />;
    case 'parametrizacao-regras': return <RegrasApuracaoPage />;
    case 'parametrizacao-documentos': return <TiposDocumentosPage />;
    case 'parametrizacao-pastas-padrao': return <PastasPadraoPage />;
    case 'parametrizacao-parametros-calculo': return <ParametrosCalculoPage />;
    case 'parametrizacao-tabelas-tributarias': return <TabelasTributariasPage />;
    case 'parametrizacao-prazos-entrega': return <PrazosEntregaPage />;
    case 'parametrizacao-protocolos': return <ProtocolosTiposPage />;
    case 'parametrizacao-checklists': return <ConfigFluxosPage />;
    case 'atividades':
      return (
        <AtividadesPage
          view={(initialContext?.data?.activeView as string | undefined) || 'minha-fila'}
          initialQueueFilter={initialContext?.data?.queueFilter as any}
          initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
          initialCompetencia={initialContext?.data?.selectedCompetencia as string | undefined}
        />
      );
    case 'atividades-diarias':
    case 'atividades-painel':
    case 'atividades-resumo':
      return <AtividadesPage view="minha-fila" initialQueueFilter="hoje" />;
    case 'atividades-semanais':
    case 'atividades-agenda':
      return <AtividadesPage view="minha-fila" initialQueueFilter="semana" />;
    case 'atividades-mensais': return <AtividadesPage view="minha-fila" initialQueueFilter="mes" />;
    case 'atividades-internas': return <AtividadesPage view="minha-fila" initialQueueFilter="internas" />;
    case 'atividades-fechamentos':
    case 'atividades-empresa':
      return (
        <AtividadesPage
          view="fechamentos"
          initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined}
          initialCompetencia={initialContext?.data?.selectedCompetencia as string | undefined}
        />
      );
    case 'atividades-equipe':
    case 'atividades-funcionario': return <AtividadesPage view="equipe" />;
    case 'atividades-modelos':
    case 'atividades-rotinas': return <AtividadesPage view="modelos" />;
    case 'atividades-painel-operacional':
    case 'atividades-controle':
    case 'atividades-controle-andamento': return <AtividadesPage view="painel" />;
    case 'gestao-empresarial': return <GestaoEmpresarialPage />;
    case 'planejamento-tributario': return <PlanejamentoTributarioPage />;
    case 'simulacoes-calculos': return <SimulacoesCalculosPage />;
    case 'reforma-tributaria': return <ReformaTributariaPage />;
    case 'agenda': return <AgendaPage />;
    case 'protocolos': return <ProtocolosPage />;
    case 'conformidade':
      return <ConformidadePage initialCompanyId={initialContext?.data?.selectedCompanyId as string | undefined} />;
    case 'documentos':
      return (
        <React.Suspense fallback={<div className="submodule-content-card">Carregando documentos...</div>}>
          <DocumentosPage
            initialActiveTab={initialContext?.data?.activeTab as DocumentosTab | undefined}
            initialPersonalFolder={initialContext?.data?.personalFolder as string | null | undefined}
            initialCompanyId={initialContext?.data?.selectedCompanyId as string | null | undefined}
            onViewContextChange={onContextChange}
          />
        </React.Suspense>
      );
    case 'faturamento':
      return (
        <FaturamentoPage
          initialActiveTab={initialContext?.data?.activeTab as FaturamentoTab | undefined}
          initialViewMode={initialContext?.data?.viewMode as FaturamentoViewMode | undefined}
          onViewContextChange={onContextChange}
        />
      );
    case 'financeiro':
    case 'financeiro-caixa':
    case 'financeiro-receber':
    case 'financeiro-pagar':
    case 'financeiro-transferencias':
    case 'financeiro-creditos':
    case 'financeiro-debitos': {
      const subTab = resolveFinanceiroInitialTab(id, initialContext);
      return <FinanceiroPage initialTab={subTab} onViewContextChange={onContextChange} />;
    }
    case 'relatorios': return <RelatoriosPage />;
    case 'configuracoes': return <ConfiguracoesPage />;
    case 'guia-ajuda': return <GuiaAjudaPage />;
    default: return <InicioPage onInitialReady={onInitialReady} />;
  }
};
