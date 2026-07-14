import React, { useEffect, useState } from 'react';
import { LandingNavbar } from './components/LandingNavbar';
import { LandingHero } from './components/LandingHero';
import { LandingModules } from './components/LandingModules';
import { LandingScreenshots } from './components/LandingScreenshots';
import { LandingFeatures } from './components/LandingFeatures';
import { LandingStats } from './components/LandingStats';
import { LandingSecurity } from './components/LandingSecurity';
import { LandingCustomizations } from './components/LandingCustomizations';
import { LandingFooter } from './components/LandingFooter';
import { ChevronDown, ChevronUp, MessageSquarePlus } from 'lucide-react';
import { navigate } from '../../../lib/navigation';
import './Landing.css';

interface FaqItem {
  question: string;
  answer: string;
}

export const LandingPage: React.FC = () => {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Arkhen | Gestão Contábil Inteligente';
    window.scrollTo(0, 0);
  }, []);

  const faqs: FaqItem[] = [
    {
      question: 'O que é o Arkhen Gestão Contábil?',
      answer: 'O Arkhen é um ecossistema completo para escritórios de contabilidade. Ele integra o controle interno de prazos e tarefas, envio de protocolos digitais com comprovante de visualização, gestão financeira de honorários e um portal de compartilhamento de documentos com o cliente.'
    },
    {
      question: 'Como funciona a emissão de NFS-e e a homologação com a prefeitura?',
      answer: 'Para emitir Notas Fiscais de Serviço de forma automatizada, o sistema conecta-se diretamente à API da sua prefeitura municipal. Como cada município possui requisitos específicos (certificado A1, chaves de autenticação), nossa equipe técnica auxilia o seu escritório em todo o processo de parametrização e homologação inicial.'
    },
    {
      question: 'Como funciona o faturamento integrado ao Asaas?',
      answer: 'O Arkhen conecta-se à sua conta Asaas via API de forma totalmente segura. Com isso, ao gerar honorários ou cobranças adicionais, o sistema emite boletos e chaves Pix registradas automaticamente, gerenciando réguas de cobrança (WhatsApp/E-mail) e conciliando os recebimentos em tempo real.'
    },
    {
      question: 'O que é o compartilhamento de documentos com senha?',
      answer: 'Para garantir conformidade com a LGPD ao enviar arquivos confidenciais (como balanços e folhas de pagamento), você pode gerar links públicos de download protegidos por senha e data de expiração. O cliente só visualiza o documento após digitar a senha cadastrada.'
    },
    {
      question: 'Como funciona o rastro do protocolo eletrônico?',
      answer: 'Toda guia de imposto ou arquivo publicado no portal gera um rastro digital auditável. O sistema registra o carimbo de data/hora, o IP e o navegador do cliente no momento exato da visualização e do download, servindo como comprovante com validade jurídica de entrega.'
    },
    {
      question: 'Meu escritório pode testar gratuitamente?',
      answer: 'Sim! O Arkhen oferece um período de demonstração para que você conheça todas as funcionalidades antes de contratar. Nossa equipe de onboarding auxilia na configuração inicial, importação de clientes e parametrização do seu escritório.'
    }
  ];

  const toggleFaq = (idx: number) => {
    setOpenFaqIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="landing-page">
      {/* Top Floating Navbar */}
      <LandingNavbar />

      {/* DARK — Hero Section com screenshot real */}
      <LandingHero />

      {/* LIGHT — Grade de módulos do sistema */}
      <LandingModules />

      {/* DARK — Screenshots reais com carrossel */}
      <LandingScreenshots />

      {/* LIGHT — Showcase interativo de funcionalidades */}
      <LandingFeatures />

      {/* DARK — Customizações & Área do Cliente */}
      <LandingCustomizations />

      {/* LIGHT — Diferenciais do Arkhen */}
      <LandingStats />

      {/* DARK — Segurança RLS Multi-Tenant */}
      <LandingSecurity />

      {/* LIGHT — FAQs Accordion (Alternando cores) */}
      <section id="faq" className="section bg-light">
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="section-header">
            <span className="hero-tag" style={{ marginBottom: '16px' }}>Perguntas Frequentes</span>
            <h2 className="section-title">Dúvidas Comuns sobre o Arkhen</h2>
            <p className="section-subtitle">
              Selecione uma das dúvidas frequentes abaixo para entender melhor o funcionamento do sistema.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#ffffff',
                    border: isOpen ? '1.5px solid var(--color-gold-primary)' : '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    boxShadow: isOpen ? '0 8px 24px rgba(197, 146, 53, 0.1)' : 'none',
                    transition: 'var(--transition-normal)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '20px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'var(--color-text-dark)',
                      fontWeight: 600,
                      fontSize: '1rem'
                    }}
                  >
                    <span>{faq.question}</span>
                    {isOpen ? <ChevronUp size={20} style={{ color: 'var(--color-gold-primary)' }} /> : <ChevronDown size={20} style={{ color: 'var(--color-text-dark-muted)' }} />}
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: '0 24px 20px 24px',
                        color: 'var(--color-text-dark-muted)',
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                        animation: 'fadeIn 0.3s ease-out'
                      }}
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DARK — CTA final com gradiente dourado */}
      <section className="cta-section">
        <div className="container">
          <h2 className="cta-title">
            Pronto para revolucionar a <br />
            <span className="highlight-gold">gestão do seu escritório contábil?</span>
          </h2>
          <p className="cta-desc">
            Junte-se a centenas de contadores que reduziram a inadimplência, automatizaram o controle de prazos e oferecem uma experiência digital única para seus clientes.
          </p>
          <button
            type="button"
            className="btn-gold"
            onClick={() => navigate('/signup')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 32px', fontSize: '1rem' }}
          >
            <MessageSquarePlus size={20} />
            Criar Conta Grátis
          </button>
        </div>
      </section>

      {/* DARK — Footer */}
      <LandingFooter />
    </div>
  );
};
