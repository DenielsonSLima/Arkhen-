import { ArrowUpRight } from 'lucide-react';
import type { GuideModule } from '../types';
import { GuideIcon } from './GuideIcon';

export function HelpModuleCard({ module, onOpen }: { module: GuideModule; onOpen: () => void }) {
  return (
    <button type="button" className="guide-module-card" onClick={onOpen}>
      <span className="guide-card-top"><span className="guide-icon"><GuideIcon name={module.icon} /></span>
        <span>{module.articles.length} tutoriais</span><ArrowUpRight size={18} aria-hidden="true" /></span>
      <strong>{module.title}</strong>
      <span className="guide-card-description">{module.description}</span>
      <span className="guide-card-preview">{module.articles.slice(0, 3).map((article) => article.title).join(' · ')}</span>
      <span className="guide-card-link">Explorar módulo <span aria-hidden="true">→</span></span>
    </button>
  );
}
