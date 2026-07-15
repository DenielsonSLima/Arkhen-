import React from 'react';
import type { InternalTabContext } from '../../../stores/internalTabsStore';
import { InicioPage } from '../inicio/InicioPage';
import { RegimesTributariosPage } from '../parametrizacao/regimes/RegimesTributariosPage';
import { CnaePage } from '../parametrizacao/cnae/CnaePage';
import { RegrasApuracaoPage } from '../parametrizacao/regras/RegrasApuracaoPage';
import { ParametrosCalculoPage } from '../parametrizacao/parametros-calculo/ParametrosCalculoPage';
import { TabelasTributariasPage } from '../parametrizacao/tabelas-tributarias/TabelasTributariasPage';
import { PrazosEntregaPage } from '../parametrizacao/prazos-entrega/PrazosEntregaPage';
import { ProtocolosTiposPage } from '../parametrizacao/protocolos/ProtocolosTiposPage';
import { ParametrizacaoPlaceholderPage } from '../parametrizacao/catalogos/ParametrizacaoPlaceholderPage';
import { CategoriaClientePage } from '../parametrizacao/catalogos/CategoriaClientePage';
import { CategoriaFinanceiraPage } from '../parametrizacao/catalogos/CategoriaFinanceiraPage';
import { TiposDocumentosPage } from '../parametrizacao/catalogos/tipos-documentos/TiposDocumentosPage';
import { PastasPadraoPage } from '../parametrizacao/pastas-padrao/PastasPadraoPage';
import { GestaoEmpresarialPage } from '../gestao-empresarial/GestaoEmpresarialPage';
import type { EmpresaDetailTab } from '../gestao-empresarial/hooks/useGestaoEmpresarial';
import { AtividadesPage } from '../atividades/AtividadesPage';
import { ConfigFluxosPage } from '../atividades/config/ConfigFluxosPage';
import { PlanejamentoTributarioPage } from '../planejamento-tributario/PlanejamentoTributarioPage';
import { SimulacoesCalculosPage } from '../simulacoes-calculos/SimulacoesCalculosPage';
import type { DocumentosTab } from '../documentos/hooks/useDocumentos';
import { ConformidadePage } from '../conformidade/ConformidadePage';
import { ProtocolosPage } from '../protocolos/ProtocolosPage';
import { FinanceiroPage } from '../financeiro/FinanceiroPage';
import { FaturamentoPage, type FaturamentoTab, type FaturamentoViewMode } from '../faturamento/FaturamentoPage';
import { AgendaPage } from '../agenda/AgendaPage';
import { RelatoriosPage } from '../relatorios/RelatoriosPage';
import { ConfiguracoesPage } from '../configuracoes/ConfiguracoesPage';
import { GuiaAjudaPage } from '../guia-ajuda/GuiaAjudaPage';
import { ReformaTributariaPage } from '../reforma-tributaria/ReformaTributariaPage';

const DocumentosPage = React.lazy(() => import('../documentos/DocumentosPage')
  .then((module) => ({ default: module.DocumentosPage })));

type GestorModuleContentProps = {
  id: string;
  workspaceId?: string;
  initialContext?: InternalTabContext;
  activeModuleId: string;
  updateTabContext: (tabId: string, context: InternalTabContext) => void;
  onModuleContextChange: (moduleId: string, context: InternalTabContext) => void;
};

export const GestorModuleContent: React.FC<GestorModuleContentProps> = ({
  id,
  workspaceId = id,
  initialContext,
  activeModuleId,
  updateTabContext,
  onModuleContextChange,
}) => {
  const onContextChange = (context: InternalTabContext) => {
    if (workspaceId.includes('__')) updateTabContext(workspaceId, context);
    else onModuleContextChange(id, context);
  };

  switch (id) {
    case 'inicio': return <InicioPage />;
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
      const subTab = activeModuleId.startsWith('financeiro-')
        ? activeModuleId.replace('financeiro-', '')
        : undefined;
      return <FinanceiroPage initialTab={subTab} />;
    }
    case 'relatorios': return <RelatoriosPage />;
    case 'configuracoes': return <ConfiguracoesPage />;
    case 'guia-ajuda': return <GuiaAjudaPage />;
    default: return <InicioPage />;
  }
};
