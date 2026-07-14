import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

import screenDashboard from '../assets/screen-dashboard.png';
import screenAtividades from '../assets/screen-atividades.png';
import screenProtocolos from '../assets/screen-protocolos.png';
import screenFaturamento from '../assets/screen-faturamento.png';
import screenDocumentos from '../assets/screen-documentos.png';
import screenCompartilhar from '../assets/screen-compartilhar.png';
import screenLinkPublico from '../assets/screen-link-publico.png';
import screenSimulacoes from '../assets/screen-simulacoes.png';

interface Slide {
  src: string;
  title: string;
  desc: string;
  featurePhrase: string;
}

const slides: Slide[] = [
  {
    src: screenDashboard,
    title: 'Dashboard de Início',
    desc: 'Visão geral do escritório com acesso rápido a todas as funcionalidades e alertas de prazos.',
    featurePhrase: 'Centralize a gestão da sua equipe com um painel unificado e intuitivo.',
  },
  {
    src: screenAtividades,
    title: 'Fechamento por Cliente',
    desc: 'Auditoria completa por competência com resumo de obrigações, progresso e confirmação de fechamento.',
    featurePhrase: 'Monitore o status de cada competência sem planilhas ou controles manuais.',
  },
  {
    src: screenProtocolos,
    title: 'Protocolos e Documentos',
    desc: 'Controle das entregas por empresa, data e competência, com visão do andamento da rotina.',
    featurePhrase: 'Comprove entregas e obrigações com histórico rastreável e auditado.',
  },
  {
    src: screenFaturamento,
    title: 'Faturamento e Cobranças',
    desc: 'Dashboard de NFS-e emitidas, cobranças geradas e controle de inadimplência com integração Asaas.',
    featurePhrase: 'Organize cobranças, recebimentos e honorários em uma visão única.',
  },
  {
    src: screenDocumentos,
    title: 'Biblioteca de Documentos',
    desc: 'Armazene contratos, procurações, certidões e documentos organizados por cliente e categoria.',
    featurePhrase: 'Acesse e compartilhe arquivos com permissões vinculadas a cada empresa.',
  },
  {
    src: screenCompartilhar,
    title: 'Compartilhar com Senha',
    desc: 'Gere links seguros protegidos por senha temporária e prazo de expiração configurável.',
    featurePhrase: 'Controle o acesso a arquivos com senha e prazo de expiração configurável.',
  },
  {
    src: screenLinkPublico,
    title: 'Portal Público do Cliente',
    desc: 'Página profissional de acesso ao arquivo com contador regressivo e identificação do escritório.',
    featurePhrase: 'Ofereça um canal ágil e moderno para seus parceiros comerciais resgatarem arquivos.',
  },
  {
    src: screenSimulacoes,
    title: 'Calculadora de Rescisão',
    desc: 'Simule rescisões, férias e pró-labore com parâmetros centralizados no sistema.',
    featurePhrase: 'Compare cenários e revise os resultados antes de orientar o cliente.',
  },
];

export const LandingScreenshots: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [autoplayActive, setAutoplayActive] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const autoplayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);

  const prev = () => {
    setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1));
    resetAutoplay();
  };

  const next = () => {
    setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));
    resetAutoplay();
  };

  const selectSlide = (idx: number) => {
    setCurrent(idx);
    resetAutoplay();
  };

  const resetAutoplay = () => {
    setAutoplayActive(false);
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
    }
  };

  useEffect(() => {
    if (autoplayActive) {
      autoplayTimerRef.current = setInterval(() => {
        setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));
      }, 4500);
    }
    return () => {
      if (autoplayTimerRef.current) {
        clearInterval(autoplayTimerRef.current);
      }
    };
  }, [autoplayActive]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const scrollY = window.scrollY;
    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'Tab') {
        event.preventDefault();
        lightboxCloseRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => lightboxCloseRef.current?.focus());

    return () => {
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      window.scrollTo(0, scrollY);
      previousActiveElement?.focus();
    };
  }, [lightboxOpen]);

  const slide = slides[current];

  return (
    <section id="screenshots" className="section bg-dark screenshots-section">
      <div className="container">
        <div className="section-header">
          <span className="hero-tag" style={{ marginBottom: '16px' }}>
            Veja o Sistema em Ação
          </span>
          <h2 className="section-title" style={{ color: 'var(--color-text-white)' }}>
            Interface Real, Sem Filtros
          </h2>
          <p className="section-subtitle" style={{ color: 'var(--color-text-muted)' }}>
            Navegue pelas telas reais do Arkhen e conheça a experiência que seus contadores terão no dia a dia.
          </p>
        </div>

        {/* Highlight Banner / Feature Phrase */}
        <div className="screenshot-highlight-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(197,146,53,0.06)', borderLeft: '3px solid var(--color-gold-primary)', padding: '16px 20px', borderRadius: '0 8px 8px 0', maxWidth: '960px', margin: '0 auto 30px auto' }}>
          <Play size={16} style={{ color: 'var(--color-gold-primary)', fill: 'var(--color-gold-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.92rem', color: 'var(--color-text-white)', fontWeight: 600 }}>
            {slide.featurePhrase}
          </span>
        </div>

        {/* Browser Mockup Wrapper */}
        <div className="screenshots-browser-frame">
          {/* Minimal top bar */}
          <div className="browser-topbar">
            <div className="browser-dots">
              <span className="browser-dot" style={{ background: '#ef4444' }}></span>
              <span className="browser-dot" style={{ background: '#f59e0b' }}></span>
              <span className="browser-dot" style={{ background: '#10b981' }}></span>
            </div>
            <div className="browser-slide-title">
              {slide.title}
            </div>
            <div className="browser-slide-counter">
              {current + 1} / {slides.length}
            </div>
          </div>

          {/* Screenshot display */}
          <div className="browser-screenshot-area">
            <button
              type="button"
              className="browser-screenshot-trigger"
              onClick={() => setLightboxOpen(true)}
              aria-label={`Ampliar imagem: ${slide.title}`}
            >
              <img
                src={slide.src}
                alt={slide.title}
                className="browser-screenshot-img"
              />
            </button>

            {/* Navigation Arrows */}
            <button type="button" className="screenshot-arrow screenshot-arrow-left" onClick={prev}>
              <ChevronLeft size={24} />
            </button>
            <button type="button" className="screenshot-arrow screenshot-arrow-right" onClick={next}>
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Caption */}
          <div className="browser-caption">
            <strong>{slide.title}</strong>
            <span>{slide.desc}</span>
          </div>
        </div>

        {/* Thumbnails Row */}
        <div className="screenshot-thumbs">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`screenshot-thumb ${i === current ? 'active' : ''}`}
              onClick={() => selectSlide(i)}
              title={s.title}
            >
              <img src={s.src} alt={s.title} loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && createPortal(
        <div 
          className="screenshot-lightbox" 
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Visualização ampliada: ${slide.title}`}
        >
          <button 
            ref={lightboxCloseRef}
            type="button" 
            className="lightbox-close" 
            onClick={() => setLightboxOpen(false)}
            aria-label="Fechar visualização ampliada"
          >
            <X size={28} />
          </button>
          <img 
            src={slide.src} 
            alt={slide.title} 
            className="lightbox-image" 
            onClick={(e) => e.stopPropagation()} 
            draggable={false}
          />
          <div className="lightbox-caption">
            <strong>{slide.title}</strong> — {slide.desc}
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
};
