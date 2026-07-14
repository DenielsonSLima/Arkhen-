import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Cpu, Layers, Zap } from 'lucide-react';

interface PillarItem {
  icon: React.ReactNode;
  label: string;
  desc: string;
}

const pillars: PillarItem[] = [
  {
    icon: <ShieldCheck size={36} />,
    label: 'Acesso por Escritório',
    desc: 'Controles de acesso vinculam usuários ao seu escritório e separam as informações entre empresas.',
  },
  {
    icon: <Cpu size={36} />,
    label: 'Regras Centralizadas',
    desc: 'As simulações utilizam parâmetros mantidos pelo sistema para facilitar a revisão e a atualização das regras de cálculo.',
  },
  {
    icon: <Layers size={36} />,
    label: 'Estrutura Modularizada',
    desc: 'Organização limpa e modular. Lógica de negócios isolada e preparada para receber novos recursos de forma ágil.',
  },
  {
    icon: <Zap size={36} />,
    label: 'Onboarding Facilitado',
    desc: 'Nossa equipe técnica ajuda na parametrização inicial da prefeitura e homologação do faturamento integrado para seu escritório começar rápido.',
  },
];

export const LandingStats: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="section bg-light stats-section" style={{ backgroundColor: '#f8fafc' }}>
      <div className="container">
        <div className="section-header">
          <span className="hero-tag" style={{ marginBottom: '16px' }}>
            Nossa Proposta
          </span>
          <h2 className="section-title" style={{ color: '#0f172a' }}>
            Diferenciais do <span className="highlight-gold">Arkhen</span>
          </h2>
          <p className="section-subtitle" style={{ color: '#475569' }}>
            Uma plataforma contábil moderna, segura e desenhada especificamente para simplificar e organizar sua rotina.
          </p>
        </div>

        <div className="stats-grid-v2">
          {pillars.map((pillar, idx) => (
            <div
              key={idx}
              className={`stat-card-v2 ${visible ? 'stat-animate' : ''}`}
              style={{
                animationDelay: `${idx * 0.12}s`,
                textAlign: 'left',
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
              }}
            >
              {/* Icon container */}
              <div style={{ color: 'var(--color-gold-dark)', marginBottom: '20px', display: 'inline-block' }}>
                {pillar.icon}
              </div>

              <div className="stat-label-v2" style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#0f172a' }}>
                {pillar.label}
              </div>
              
              <div className="stat-desc-v2" style={{ fontSize: '0.88rem', lineHeight: '1.6', color: '#475569' }}>
                {pillar.desc}
              </div>
              
              <div className="stat-accent-line"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
