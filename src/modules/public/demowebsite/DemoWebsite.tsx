import React, { useEffect, useState } from 'react';
import { navigate } from '../../../lib/navigation';
import { ArrowRight, ShieldCheck, Mail, Phone, MapPin, ExternalLink, FileText, Landmark, Search, ShieldAlert, Award, Globe } from 'lucide-react';
import './DemoWebsite.css';
import logoImg from '../../../assets/camada-o.png';
import demoHeroBg from '../landing/assets/demo-hero-bg.png';

interface QueryLink {
  icon: React.ReactNode;
  title: string;
  desc: string;
  url: string;
}

export const DemoWebsite: React.FC = () => {
  const [activeView, setActiveView] = useState<'home' | 'consultas'>('home');

  useEffect(() => {
    document.title = activeView === 'home' 
      ? 'Arkhen Prime Contabilidade | Soluções Inteligentes'
      : 'Consultas Úteis | Arkhen Prime Contabilidade';
    window.scrollTo(0, 0);
  }, [activeView]);

  const queryLinks: QueryLink[] = [
    {
      icon: <Search size={22} />,
      title: 'Emissão de CNPJ',
      desc: 'Consulte e emita o comprovante de inscrição e de situação cadastral de empresas na Receita Federal.',
      url: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp',
    },
    {
      icon: <Landmark size={22} />,
      title: 'Simples Nacional',
      desc: 'Verifique a opção pelo regime tributário do Simples Nacional ou MEI de qualquer CNPJ.',
      url: 'https://www8.receita.fazenda.gov.br/SimplesNacional/controleAcesso/Grupo.aspx?grupo=1',
    },
    {
      icon: <FileText size={22} />,
      title: 'Certidão Negativa (CND Federal)',
      desc: 'Emita a Certidão de Débitos Relativos a Créditos Tributários Federais e à Dívida Ativa da União.',
      url: 'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Consultar',
    },
    {
      icon: <Search size={22} />,
      title: 'Consulta CPF',
      desc: 'Consulte a situação cadastral do seu Cadastro de Pessoas Físicas na base da Receita Federal.',
      url: 'https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaCPF.asp',
    },
    {
      icon: <ShieldAlert size={22} />,
      title: 'Portal do e-CAC',
      desc: 'Acesse o Centro Virtual de Atendimento ao Contribuinte para declarações e certidões oficiais.',
      url: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
    },
    {
      icon: <Globe size={22} />,
      title: 'Sintegra (Inscrições Estaduais)',
      desc: 'Consulte a situação e dados cadastrais de contribuintes do ICMS nas Secretarias de Fazenda estaduais.',
      url: 'http://www.sintegra.gov.br',
    },
    {
      icon: <Award size={22} />,
      title: 'Certidão de FGTS (CRF)',
      desc: 'Consulte e emita o Certificado de Regularidade do FGTS junto à Caixa Econômica Federal.',
      url: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
    },
    {
      icon: <FileText size={22} />,
      title: 'Consulta de MEI',
      desc: 'Acesse serviços exclusivos para Microempreendedores Individuais no Portal do Empreendedor.',
      url: 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor',
    },
  ];

  return (
    <div className="demo-site-container">
      {/* Top Banner indicating this is a demo */}
      <div className="demo-indicator-bar">
        <span>Demonstração de Site Público para Escritórios de Contabilidade integrado ao Arkhen.</span>
        <button type="button" onClick={() => navigate('/')} className="demo-back-btn">
          Voltar para a Landing Page
        </button>
      </div>

      {/* Header */}
      <header className="demo-header">
        <div className="demo-nav-container">
          <div className="demo-logo-area" onClick={() => setActiveView('home')} style={{ cursor: 'pointer' }}>
            <img src={logoImg} alt="Logo" className="demo-logo-img" />
            <div className="demo-logo-text">
              <span className="demo-logo-title">Arkhen Prime</span>
              <span className="demo-logo-sub">Contabilidade Estratégica</span>
            </div>
          </div>

          <nav className="demo-nav-links">
            <button 
              type="button" 
              className={`demo-link-btn ${activeView === 'home' ? 'active' : ''}`}
              onClick={() => { setActiveView('home'); setTimeout(() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }), 50); }}
            >
              Serviços
            </button>
            <button 
              type="button" 
              className={`demo-link-btn ${activeView === 'consultas' ? 'active' : ''}`}
              onClick={() => setActiveView('consultas')}
            >
              Consultas Úteis
            </button>
            <button 
              type="button" 
              className="demo-link-btn"
              onClick={() => { setActiveView('home'); setTimeout(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }), 50); }}
            >
              Contato
            </button>
          </nav>

          <div className="demo-nav-actions">
            <button
              type="button"
              className="demo-btn-client"
              onClick={() => navigate('/login')}
            >
              <ShieldCheck size={16} />
              Área do Cliente
            </button>
          </div>
        </div>
      </header>

      {activeView === 'home' ? (
        <>
          {/* Hero Section */}
          <section className="demo-hero" style={{ backgroundImage: `url(${demoHeroBg})` }}>
            <div className="demo-hero-overlay"></div>
            <div className="demo-hero-content">
              <span className="demo-tag">Parceiro de Negócios Inteligente</span>
              <h1 className="demo-title">
                Contabilidade de alto impacto <br />
                para empresas de <span className="demo-gold">alta performance.</span>
              </h1>
              <p className="demo-subtitle-text">
                Unimos inteligência contábil de ponta e tecnologia de ponta para otimizar seus tributos, organizar sua folha e garantir conformidade fiscal total.
              </p>
              <div className="demo-hero-actions">
                <a href="#services" className="demo-btn-primary">Conhecer Serviços</a>
                <button
                  type="button"
                  className="demo-btn-secondary"
                  onClick={() => navigate('/login')}
                >
                  Acessar Portal do Cliente <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Services Grid */}
          <section id="services" className="demo-services-section">
            <div className="demo-section-header">
              <h2>Nossos Serviços Contábeis</h2>
              <p>Soluções estruturadas para assessorar sua empresa em todas as fases do negócio.</p>
            </div>

            <div className="demo-services-grid">
              <div className="demo-service-card">
                <div className="demo-service-dot"></div>
                <h3>BPO Financeiro</h3>
                <p>Terceirização completa das tarefas financeiras: contas a pagar, receber, conciliação diária e emissão de notas.</p>
              </div>

              <div className="demo-service-card">
                <div className="demo-service-dot"></div>
                <h3>Planejamento Tributário</h3>
                <p>Estudos fiscais comparativos para redução legal de tributos (Simples Nacional, Lucro Presumido e Real).</p>
              </div>

              <div className="demo-service-card">
                <div className="demo-service-dot"></div>
                <h3>Departamento Pessoal</h3>
                <p>Gestão de admissões, rescisões, férias, folhas de pagamento e relatórios obrigatórios no eSocial.</p>
              </div>

              <div className="demo-service-card">
                <div className="demo-service-dot"></div>
                <h3>Contabilidade Consultiva</h3>
                <p>Diagnóstico contábil estratégico por competência com balancetes, balanços e análise de lucratividade.</p>
              </div>

              <div className="demo-service-card">
                <div className="demo-service-dot"></div>
                <h3>Legalização de Empresas</h3>
                <p>Abertura ágil de CNPJ, alvarás, inscrições estaduais e alterações contratuais completas.</p>
              </div>

              <div className="demo-service-card">
                <div className="demo-service-dot"></div>
                <h3>Blindagem & Auditoria</h3>
                <p>Cruzamento preventivo de arquivos fiscais para eliminar riscos de multas e notificações do Fisco.</p>
              </div>
            </div>
          </section>

          {/* Features Integration callout */}
          <section className="demo-integration-callout">
            <div className="demo-callout-box">
              <div className="demo-callout-text">
                <span className="demo-badge-small">Tecnologia Integrada por Arkhen</span>
                <h2>Seu escritório 100% digital</h2>
                <p>
                  Como cliente da <strong>Arkhen Prime</strong>, você tem acesso a uma plataforma exclusiva na nuvem para baixar guias de impostos, enviar comprovantes mensais e solicitar serviços diretamente à nossa equipe de forma rápida e segura.
                </p>
              </div>
              <div className="demo-callout-action">
                <button
                  type="button"
                  className="demo-btn-primary"
                  onClick={() => navigate('/login')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  Entrar no Portal
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Contact Info */}
          <section id="contact" className="demo-contact-section">
            <div className="demo-services-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
              <div>
                <h2>Precisa de um atendimento personalizado?</h2>
                <p style={{ color: '#64748b', marginBottom: '24px' }}>
                  Nossos especialistas estão prontos para analisar seu negócio e propor o melhor regime tributário.
                </p>
                <div className="demo-contact-list">
                  <div className="demo-contact-item">
                    <Phone size={18} style={{ color: '#c59235' }} />
                    <span>+55 (11) 4003-0000</span>
                  </div>
                  <div className="demo-contact-item">
                    <Mail size={18} style={{ color: '#c59235' }} />
                    <span>contato@arkhenprime.com.br</span>
                  </div>
                  <div className="demo-contact-item">
                    <MapPin size={18} style={{ color: '#c59235' }} />
                    <span>Av. Paulista, 1000 - Edifício Corporate - São Paulo/SP</span>
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#0f172a' }}>Mensagem Rápida</h3>
                <form onSubmit={(e) => { e.preventDefault(); alert('Mensagem demonstrativa enviada com sucesso!'); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" placeholder="Seu Nome" required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <input type="email" placeholder="Seu E-mail" required style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                  <textarea placeholder="Como podemos ajudar?" required rows={3} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'none' }}></textarea>
                  <button type="submit" className="demo-btn-primary" style={{ border: 'none', cursor: 'pointer', textAlign: 'center', justifyContent: 'center' }}>Enviar Mensagem</button>
                </form>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Useful Queries Section */
        <section className="demo-queries-section">
          <div className="demo-section-header">
            <h2>Links e Consultas Úteis</h2>
            <p>Acesse de forma rápida e segura os principais portais federais e estaduais de apoio à empresa e contribuinte.</p>
          </div>

          <div className="demo-queries-grid">
            {queryLinks.map((link, idx) => (
              <a 
                key={idx} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="demo-query-card"
              >
                <div className="demo-query-icon">
                  {link.icon}
                </div>
                <h3>{link.title}</h3>
                <p>{link.desc}</p>
                <span className="demo-query-action">
                  Ir para consulta <ExternalLink size={14} />
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="demo-footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <span>© 2026 Arkhen Prime Contabilidade. Todos os direitos reservados.</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
            Plataforma digital integrada fornecida por <strong style={{ color: '#c59235' }}>Arkhen</strong>
          </span>
        </div>
      </footer>
    </div>
  );
};
