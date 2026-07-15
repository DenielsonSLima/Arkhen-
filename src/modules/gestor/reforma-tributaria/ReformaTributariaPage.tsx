import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardCheck, FileCheck2, Landmark, Scale, WalletCards } from 'lucide-react';
import { useReformaPainelQuery } from './hooks/useReformaTributariaQueries';
import { useReformaTributariaRealtime } from './hooks/useReformaTributariaRealtime';
import { VisaoGeralTab } from './components/VisaoGeralTab';
import { AdequacaoTab } from './components/AdequacaoTab';
import { ValidadorXmlTab } from './components/ValidadorXmlTab';
import { SimuladorIbsCbsTab } from './components/SimuladorIbsCbsTab';
import { DecisoesTab } from './components/DecisoesTab';
import { SplitPaymentTab } from './components/SplitPaymentTab';
import './ReformaTributaria.css';

type RtcTab = 'visao-geral' | 'adequacao' | 'xml' | 'simulador' | 'decisoes' | 'split';

const TABS: Array<{ id: RtcTab; label: string; icon: typeof Scale; requiresManage?: boolean }> = [
  { id: 'visao-geral', label: 'Visão Geral', icon: BarChart3 },
  { id: 'adequacao', label: 'Adequação Fiscal', icon: ClipboardCheck, requiresManage: true },
  { id: 'xml', label: 'Validador XML', icon: FileCheck2, requiresManage: true },
  { id: 'simulador', label: 'Simulador IBS/CBS', icon: Scale, requiresManage: true },
  { id: 'decisoes', label: 'Decisões e Relatórios', icon: Landmark, requiresManage: true },
  { id: 'split', label: 'Split Payment', icon: WalletCards, requiresManage: true },
];

export const ReformaTributariaPage = () => {
  const painelQuery = useReformaPainelQuery();
  const [activeTab, setActiveTab] = useState<RtcTab>('visao-geral');
  const [clienteId, setClienteId] = useState('');
  useReformaTributariaRealtime();

  useEffect(() => {
    if (!clienteId && painelQuery.data?.clientes[0]?.id) setClienteId(painelQuery.data.clientes[0].id);
  }, [clienteId, painelQuery.data]);

  const selectedClient = useMemo(() => (
    painelQuery.data?.clientes.find((cliente) => cliente.id === clienteId) || null
  ), [clienteId, painelQuery.data]);

  if (painelQuery.isLoading) return <div className="rtc-loading">Preparando central da Reforma Tributária...</div>;
  if (painelQuery.error || !painelQuery.data) {
    return <div className="rtc-error">Não foi possível carregar o módulo. Verifique se as migrações foram aplicadas.</div>;
  }

  return (
    <div className="rtc-page animate-fade-in">
      <header className="rtc-hero">
        <div className="rtc-hero-mark"><Scale size={28} /></div>
        <div><span>Central RTC 2026–2033</span><h1>Reforma Tributária</h1><p>Adequação documental, decisão IBS/CBS e impacto de caixa em uma única carteira.</p></div>
        <aside><small>Próximo marco</small><strong>03.08.2026</strong><span>Validação de campos IBS/CBS</span></aside>
      </header>

      <nav className="rtc-tabs" aria-label="Seções da Reforma Tributária">
        {TABS.map(({ id, label, icon: Icon, requiresManage }) => (
          <button type="button" key={id} disabled={requiresManage && !painelQuery.data.podeGerenciar} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      {!painelQuery.data.podeGerenciar && <div className="rtc-readonly-notice">Acesso somente para consulta. Solicite a permissão “Gerenciar Reforma Tributária” ao gestor.</div>}

      {activeTab === 'visao-geral' && <VisaoGeralTab painel={painelQuery.data} podeGerenciar={painelQuery.data.podeGerenciar} onSelectClient={setClienteId} onOpenAdequacao={() => setActiveTab('adequacao')} />}
      {activeTab === 'adequacao' && <AdequacaoTab clientes={painelQuery.data.clientes} cliente={selectedClient} clienteId={clienteId} onClientChange={setClienteId} />}
      {activeTab === 'xml' && <ValidadorXmlTab clientes={painelQuery.data.clientes} clienteId={clienteId} onClientChange={setClienteId} />}
      {activeTab === 'simulador' && <SimuladorIbsCbsTab clientes={painelQuery.data.clientes} clienteId={clienteId} onClientChange={setClienteId} />}
      {activeTab === 'decisoes' && <DecisoesTab clientes={painelQuery.data.clientes} clienteId={clienteId} onClientChange={setClienteId} />}
      {activeTab === 'split' && <SplitPaymentTab clientes={painelQuery.data.clientes} clienteId={clienteId} onClientChange={setClienteId} />}
    </div>
  );
};
