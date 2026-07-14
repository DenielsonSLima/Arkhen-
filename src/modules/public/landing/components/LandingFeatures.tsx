import React, { useState } from 'react';
import { Calendar, FolderLock, FileCheck, Calculator, CreditCard, Building2, Check, Lock, Download, Copy, AlertTriangle } from 'lucide-react';

type FeatureKey = 'financeiro' | 'nfse' | 'documentos' | 'protocolos' | 'calculos' | 'prazos';

interface FeatureDetail {
  icon: React.ReactNode;
  tabLabel: string;
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  visualContent: React.ReactNode;
}

export const LandingFeatures: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FeatureKey>('financeiro');
  const [copiedPix, setCopiedPix] = useState(false);
  const [typedPassword, setTypedPassword] = useState('');
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);

  const handleCopyPix = () => {
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const handleUnlockDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedPassword.trim() === '123456') {
      setPasswordUnlocked(true);
    } else {
      alert('Senha incorreta! Digite a senha padrão de demonstração: 123456');
    }
  };

  const features: Record<FeatureKey, FeatureDetail> = {
    financeiro: {
      icon: <CreditCard size={18} />,
      tabLabel: 'Faturamento Asaas',
      title: 'Faturamento de Honorários Contábeis com Asaas',
      subtitle: 'Automação completa de cobrança via Pix, Boleto e Cartão de Crédito.',
      description: (
        <span>
          Esqueça o controle de cobranças manual. O Arkhen é integrado diretamente ao Asaas, permitindo gerar links de pagamento, emitir boletos registrados e controlar o fluxo de caixa com régua de cobrança automática.
          <br /><br />
          <strong style={{ color: '#c59235' }}>Atenção:</strong> A conta Asaas possui custos e tarifas operacionais próprias sobre as cobranças liquidadas. Você pode conferir os valores diretamente no site oficial:{' '}
          <a href="https://www.asaas.com" target="_blank" rel="noopener noreferrer" style={{ color: '#c59235', textDecoration: 'underline', fontWeight: 600 }}>
            www.asaas.com
          </a>.
        </span>
      ) as any,
      benefits: [
        'Links de cobrança e boletos gerados e enviados de forma automática.',
        'Envio de alertas automáticos antes, no dia e após o vencimento.',
        'Liquidação e conciliação bancária direta sem arquivos de retorno.',
        'Controle total da inadimplência do escritório em um só painel.'
      ],
      visualContent: (
        <div className="widget-asaas">
          <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 6px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>FATURA DE HONORÁRIOS</span>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>LIQUIDADA</span>
            </div>

            {/* Body */}
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.65rem', marginBottom: '2px' }}>Valor</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#c59235' }}>R$ 1.200,00</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '0.65rem', marginBottom: '2px' }}>Referência</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>Julho / 2026</div>
                </div>
              </div>

              {/* Payment Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                {[{ label: 'Pix', active: !copiedPix }, { label: 'Boleto', active: false }, { label: 'Cartão', active: false }].map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    style={{
                      padding: '4px 10px', fontSize: '0.68rem', fontWeight: 600, border: 'none', borderRadius: '4px', cursor: 'pointer',
                      background: i === 0 ? '#c59235' : '#f1f5f9',
                      color: i === 0 ? '#fff' : '#64748b',
                    }}
                    onClick={i === 0 ? handleCopyPix : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', marginBottom: '10px', fontFamily: 'monospace', fontSize: '0.68rem', color: '#334155', wordBreak: 'break-all' }}>
                00020126580014br.gov.bcb.pix0136a41e5e6a-9b2c-4f18-bc80-2ae8f01d3ac2
              </div>

              <button type="button" className="btn-pix-copy" style={{ width: '100%', justifyContent: 'center', background: copiedPix ? '#10b981' : undefined, color: copiedPix ? '#fff' : undefined }} onClick={handleCopyPix}>
                <Copy size={12} />
                {copiedPix ? 'Chave Copiada!' : 'Copiar Chave Pix'}
              </button>
            </div>
          </div>
        </div>
      )
    },
    nfse: {
      icon: <Building2 size={18} />,
      tabLabel: 'Emissão de NFS-e',
      title: 'Emissão Automatizada de NFS-e',
      subtitle: 'Faturamento integrado às prefeituras locais por meio de homologação API.',
      description: 'Para emitir Notas Fiscais de Serviço de forma automatizada, o sistema conecta-se diretamente à API da sua prefeitura municipal. Como cada município possui requisitos específicos (certificado A1, chaves de autenticação), nossa equipe técnica auxilia o seu escritório em todo o processo de parametrização e homologação inicial. Consulte a disponibilidade de integração para o seu município antes da ativação.',
      benefits: [
        'Emissão de notas fiscais automática após liquidação de boletos.',
        'Suporte para homologação e cadastros das APIs municipais de serviço.',
        'Cálculo e retenção automática de impostos municipais e federais.',
        'Arquivamento automático dos XMLs e PDFs de NFS-e emitidos.'
      ],
      visualContent: (
        <div className="widget-nfse-box">
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontWeight: 700, fontSize: '0.82rem', marginBottom: '12px' }}>
              <Building2 size={16} style={{ color: '#c59235' }} />
              <span>Conector de Nota Fiscal Municipal</span>
            </div>
            
            <div className="widget-nfse-alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                <AlertTriangle size={14} style={{ color: '#a16207' }} />
                Aviso de Homologação
              </div>
              Cada prefeitura exige parâmetros específicos e certificados de segurança de API. Nossa equipe técnica auxilia na parametrização inicial para ativar o conector.
            </div>

            <div style={{ marginTop: '12px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Status da API Municipal</span>
                <strong style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }}></span>Integrada e Homologada</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Município Sede</span>
                <strong>São Paulo / SP</strong>
              </div>
            </div>
          </div>
        </div>
      )
    },
    documentos: {
      icon: <FolderLock size={18} />,
      tabLabel: 'Arquivos com Senha',
      title: 'Compartilhamento de Documentos com Senha',
      subtitle: 'Links seguros protegidos por criptografia e controle de validade (LGPD).',
      description: 'Envie balanços, folhas de pagamento, relatórios fiscais e guias para seus clientes por links externos públicos. Para total segurança e conformidade com a LGPD, o portal exige uma senha exclusiva definida por você.',
      benefits: [
        'Links externos protegidos contra acessos não autorizados.',
        'Configuração de data de expiração para o link expirar sozinho.',
        'Upload com senha individualizada por cliente ou documento.',
        'Layout profissional que eleva a credibilidade do seu escritório.'
      ],
      visualContent: (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          {!passwordUnlocked ? (
            <form onSubmit={handleUnlockDocument} className="widget-secure-portal">
              <div className="widget-lock-circle">
                <Lock size={20} />
              </div>
              <h4 style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700, marginBottom: '6px' }}>Documento Protegido</h4>
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '12px' }}>
                Digite a senha de demonstração <strong>123456</strong> para acessar.
              </p>
              <input
                type="password"
                placeholder="Senha de Acesso"
                className="widget-input"
                value={typedPassword}
                onChange={(e) => setTypedPassword(e.target.value)}
              />
              <button type="submit" className="btn-gold" style={{ width: '100%', padding: '8px', fontSize: '0.8rem' }}>
                Desbloquear Arquivo
              </button>
            </form>
          ) : (
            <div style={{ width: '100%', maxWidth: '280px', backgroundColor: '#ffffff', border: '1.5px solid #10b981', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <Check size={20} />
              </div>
              <h4 style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 700, marginBottom: '6px' }}>Acesso Permitido</h4>
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '12px' }}>
                Balancete_Consolidado_2026.pdf
              </p>
              <button type="button" className="btn-pix-copy" style={{ background: '#10b981', color: '#fff', border: 'none', width: '100%', justifyContent: 'center' }} onClick={() => setPasswordUnlocked(false)}>
                <Download size={14} /> Download PDF
              </button>
            </div>
          )}
        </div>
      )
    },
    protocolos: {
      icon: <FileCheck size={18} />,
      tabLabel: 'Protocolos de Entrega',
      title: 'Protocolos de Entrega Digitais e Auditados',
      subtitle: 'Carimbo de data, hora e IP do cliente como comprovante com validade jurídica.',
      description: 'Acabe com o argumento de "não recebi o e-mail da guia". Cada envio gera um rastro completo de visualização e download. Você sabe exatamente o segundo e o dispositivo pelo qual a guia foi baixada.',
      benefits: [
        'Notificação em tempo real de visualização e download pelo cliente.',
        'Registro detalhado de IP, navegador e sistema operacional.',
        'Histórico completo de auditoria para cada documento compartilhado.',
        'Emissão de recibos de entrega eletrônicos com valor de protocolo.'
      ],
      visualContent: (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>
              <span>AÇÃO DO CLIENTE</span>
              <span>CARIMBO DE DATA/IP</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block', flexShrink: 0 }}></span> Publicado por Equipe
                </span>
                <span style={{ color: '#475569' }}>14/07 - 09:30</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c59235', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c59235', display: 'inline-block', flexShrink: 0 }}></span> Aberto por Cliente
                </span>
                <span style={{ color: '#475569' }}>14/07 - 11:05 (IP: 198.24.99.12)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontWeight: 600 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7', display: 'inline-block', flexShrink: 0 }}></span> Download Executado
                </span>
                <span style={{ color: '#475569' }}>14/07 - 11:06 (Safari - Mac OS)</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    calculos: {
      icon: <Calculator size={18} />,
      tabLabel: 'Simulação Tributária',
      title: 'Planejador e Simulador de Carga Tributária',
      subtitle: 'Compare regimes tributários de forma simples para apoiar decisões estratégicas.',
      description: 'Ofereça consultoria de alto valor. Estime impostos de forma comparativa entre Simples Nacional, Lucro Presumido e Lucro Real em segundos, e apresente relatórios claros com gráficos estruturados aos seus clientes.',
      benefits: [
        'Geração rápida de simulação anual ou trimestral de impostos.',
        'Visualização fácil das alíquotas efetivas de cada cenário fiscal.',
        'Gráficos comparativos limpos para simplificar explicações.',
        'Destaque no perfil consultivo do seu escritório.'
      ],
      visualContent: (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Comparativo Anual Estimado</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '2px' }}>
                <span>Simples Nacional</span>
                <span style={{ color: '#059669', fontWeight: 700 }}>R$ 48.000,00</span>
              </div>
              <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '55%', height: '100%', background: '#10b981' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '2px' }}>
                <span>Lucro Presumido</span>
                <span style={{ color: '#d97706', fontWeight: 700 }}>R$ 68.200,00</span>
              </div>
              <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '80%', height: '100%', background: '#dfb35e' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginBottom: '2px' }}>
                <span>Lucro Real</span>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>R$ 82.000,00</span>
              </div>
              <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '95%', height: '100%', background: '#ef4444' }}></div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    prazos: {
      icon: <Calendar size={18} />,
      tabLabel: 'Tarefas e Prazos',
      title: 'Gestão Interna de Prazos e Equipes',
      subtitle: 'Controle tarefas internas e o envio das obrigações acessórias sem erros.',
      description: 'Tenha controle completo sobre a rotina da sua equipe contábil. Defina metas, configure os prazos das obrigações federais, estaduais e municipais e atribua responsáveis com fluxos integrados de revisão.',
      benefits: [
        'Calendário dinâmico de tarefas ordenadas por prioridade.',
        'Distribuição otimizada de carteiras de clientes por equipe.',
        'Status visual claro (Pendente, Em Revisão, Concluído).',
        'Notificações de vencimento que evitam custos com multas.'
      ],
      visualContent: (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              <span>Tarefa Fiscal</span>
              <span>Prazo Limite</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', alignItems: 'center' }}>
              <span style={{ textDecoration: 'line-through', color: '#64748b' }}>Transmitir DEFIS</span>
              <span style={{ background: '#e2e8f0', color: '#64748b', fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px' }}>Finalizada</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>Enviar Guias Simples</span>
              <span style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Hoje 18h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }}></span>Transmissão SPED Fiscal</span>
              <span style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Amanhã</span>
            </div>
          </div>
        </div>
      )
    }
  };

  const activeFeature = features[activeTab];

  return (
    <section id="features" className="section bg-light">
      <div className="container">
        <div className="section-header">
          <span className="hero-tag" style={{ marginBottom: '16px' }}>Módulos Integrados</span>
          <h2 className="section-title">Controle Absoluto de Prazos, Faturamento e Documentos</h2>
          <p className="section-subtitle">
            Apresentamos uma solução ponta a ponta projetada para contabilidade. Veja como cada módulo apoia sua operação e melhora a relação com seus parceiros.
          </p>
        </div>

        {/* Tabs selector */}
        <div className="features-tabs-container">
          {(Object.keys(features) as FeatureKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`features-tab-btn ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {features[key].icon}
              {features[key].tabLabel}
            </button>
          ))}
        </div>

        {/* Showcase Panel */}
        <div className="feature-panel-grid">
          <div className="feature-panel-content">
            <h3 className="highlight-gold" style={{ color: '#0f172a' }}>{activeFeature.title}</h3>
            <p style={{ fontWeight: 600, color: 'var(--color-gold-dark)', marginBottom: '12px', fontSize: '0.98rem' }}>{activeFeature.subtitle}</p>
            <p>{activeFeature.description}</p>
            
            <div className="feature-panel-points">
              {activeFeature.benefits.map((benefit, i) => (
                <div key={i} className="feature-point">
                  <Check size={16} className="feature-point-icon" />
                  <span className="feature-point-text">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="feature-panel-visual">
            {activeFeature.visualContent}
          </div>
        </div>
      </div>
    </section>
  );
};
