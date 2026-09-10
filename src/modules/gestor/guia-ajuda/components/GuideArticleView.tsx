import { ArrowLeft, ArrowRight, Check, Info, MapPin } from 'lucide-react';
import type { GuideArticle, GuideModule } from '../types';
import { GUIDE_ARTICLES } from '../constants/helpData';
import { GUIDE_SCREENSHOTS } from '../constants/guideScreenshots';
import { GuideScreenshotFigure } from './GuideScreenshotFigure';

interface Props {
  module: GuideModule;
  article: GuideArticle;
  onArticle: (id: string) => void;
  onRelated: (moduleId: string, articleId: string) => void;
}

export function GuideArticleView({ module, article, onArticle, onRelated }: Props) {
  const index = module.articles.findIndex((item) => item.id === article.id);
  const previous = module.articles[index - 1];
  const next = module.articles[index + 1];
  const related = GUIDE_ARTICLES.filter((entry) => article.related?.includes(entry.article.id));
  const screenshots = GUIDE_SCREENSHOTS[article.id];
  return (
    <article className="guide-article">
      <div className="guide-eyebrow">{module.title} <span aria-hidden="true">/</span> Tutorial {index + 1} de {module.articles.length}</div>
      <h2 tabIndex={-1}>{article.title}</h2>
      <p className="guide-lead">{article.summary}</p>
      <div className="guide-path"><MapPin size={18} aria-hidden="true" /><div><strong>Onde encontrar</strong><span>{article.path}</span></div></div>
      <section className="guide-prerequisites" aria-label="Antes de começar">
        <h3>Antes de começar</h3>
        <ul>{article.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="guide-instructions" aria-label="Passo a passo">
        <h3>Passo a passo</h3>
        <ol>{article.steps.map((step, stepIndex) => (
          <li key={`${article.id}-${stepIndex}`}><span className="guide-step-number" aria-hidden="true">{String(stepIndex + 1).padStart(2, '0')}</span>
            <div><h4>{step.title}</h4><p>{step.description}</p></div></li>
        ))}</ol>
      </section>
      {screenshots?.length ? <section className="guide-screenshots" aria-label="Veja no sistema">
        <h3>Veja no sistema</h3>
        <p className="guide-lead">As imagens mostram as telas reais. Siga as indicações numeradas e amplie para conferir os campos. Os dados e as opções podem variar conforme seu cadastro e suas permissões.</p>
        {screenshots.map((image) => <GuideScreenshotFigure key={`${article.id}-${image.src}`} image={image} />)}
      </section> : null}
      <section className="guide-verification" aria-label="Como conferir">
        <h3><Check size={20} aria-hidden="true" />Como conferir se deu certo</h3>
        <ul>{article.verification.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      {article.tips?.length ? <section className="guide-tips" aria-label="Dicas e cuidados">
        <h3><Info size={19} aria-hidden="true" />Dicas e cuidados</h3>
        <ul>{article.tips.map((item) => <li key={item}>{item}</li>)}</ul>
      </section> : null}
      {related.length ? <section className="guide-related" aria-label="Tutoriais relacionados">
        <h3>Continue aprendendo</h3>
        {related.map((entry) => <button type="button" key={entry.article.id} onClick={() => onRelated(entry.module.id, entry.article.id)}>
          <span><small>{entry.module.title}</small><strong>{entry.article.title}</strong></span><ArrowRight size={17} aria-hidden="true" />
        </button>)}
      </section> : null}
      <nav className="guide-article-pagination" aria-label="Continuar leitura">
        {previous ? <button type="button" onClick={() => onArticle(previous.id)}><ArrowLeft size={17} aria-hidden="true" /><span>Anterior<strong>{previous.title}</strong></span></button> : <span />}
        {next ? <button type="button" className="guide-next-article" onClick={() => onArticle(next.id)}><span>Próximo<strong>{next.title}</strong></span><ArrowRight size={17} aria-hidden="true" /></button> : null}
      </nav>
    </article>
  );
}
