import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Search, X } from 'lucide-react';
import { GUIDE_ARTICLES, HELP_DATA, searchGuide } from './constants/helpData';
import { GUIDE_SCREENSHOTS } from './constants/guideScreenshots';
import { HelpModuleCard } from './components/HelpModuleCard';
import { GuideArticleView } from './components/GuideArticleView';
import { GuideIcon } from './components/GuideIcon';
import './styles/GuiaAjuda.css';

const SCREENSHOT_COUNT = new Set(Object.values(GUIDE_SCREENSHOTS).flatMap((images) => images ?? []).map((image) => image.src)).size;

const STARTER_PATH = [
  { id: 'configuracoes', label: 'Prepare seu acesso', detail: 'Perfil, escritório e equipe' },
  { id: 'parceiros', label: 'Cadastre os parceiros', detail: 'Dados e vínculos da empresa' },
  { id: 'parametrizacao', label: 'Defina as obrigações', detail: 'Cadastros e fluxos de trabalho' },
  { id: 'atividades', label: 'Organize a execução', detail: 'Rotinas, tarefas e responsáveis' },
  { id: 'acompanhamento', label: 'Confira as entregas', detail: 'Competências e evidências' },
];

export function GuiaAjudaPage() {
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [focusVersion, setFocusVersion] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const module = HELP_DATA.find((item) => item.id === moduleId);
  const article = module?.articles.find((item) => item.id === articleId);
  const searching = query.trim().length > 0;
  const results = searching ? searchGuide(query) : [];

  useEffect(() => {
    if (!focusVersion) return;
    const target = articleId ? contentRef.current?.querySelector<HTMLElement>('.guide-article > h2') : contentRef.current;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [articleId, focusVersion]);

  const navigate = (nextModule: string | null, nextArticle: string | null = null) => {
    setModuleId(nextModule);
    setArticleId(nextArticle);
    setQuery('');
    setFocusVersion((version) => version + 1);
  };

  return (
    <div className="guide-page">
      <header className="guide-hero">
        <div className="guide-hero-copy">
          <span className="guide-eyebrow"><BookOpen size={16} aria-hidden="true" /> CENTRAL DE AJUDA ARKHEN</span>
          <h1>Seu guia para cada etapa.</h1>
          <p>Do primeiro cadastro à conferência das entregas. Escolha um módulo e acompanhe o passo a passo.</p>
          <div className="guide-hero-stats"><span>{HELP_DATA.length} módulos</span><span>{GUIDE_ARTICLES.length} tutoriais</span><span>{SCREENSHOT_COUNT} capturas reais do sistema</span></div>
        </div>
        <div className="guide-search-area">
          <label htmlFor="guide-search">O que você precisa fazer?</label>
          <div className="guide-search"><Search size={20} aria-hidden="true" />
            <input ref={searchRef} id="guide-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: cadastrar parceiro, gerar cobrança…" />
            {query ? <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Limpar busca"><X size={18} /></button> : null}
          </div>
          <p>Busque por módulo, ação ou nome de um campo.</p>
        </div>
      </header>

      <div className="guide-content" ref={contentRef} tabIndex={-1}>
        <nav className="guide-breadcrumb" aria-label="Localização no manual">
          <button type="button" onClick={() => navigate(null)} aria-current={!module && !searching ? 'page' : undefined}>Todos os módulos</button>
          {searching ? <><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">Resultados da busca</span></> : module ? <>
            <ChevronRight size={14} aria-hidden="true" /><button type="button" onClick={() => navigate(module.id)} aria-current={!article ? 'page' : undefined}>{module.title}</button>
            {article ? <><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{article.title}</span></> : null}
          </> : null}
        </nav>

        {searching ? <section className="guide-results">
          <h2>Resultados para “{query.trim()}”</h2>
          <p role="status">{results.length} {results.length === 1 ? 'tutorial encontrado' : 'tutoriais encontrados'} em todos os módulos.</p>
          {results.length ? <div className="guide-article-list">{results.map(({ module: resultModule, article: resultArticle }) => (
            <button type="button" key={resultArticle.id} onClick={() => navigate(resultModule.id, resultArticle.id)}>
              <GuideIcon name={resultModule.icon} /><span><small>{resultModule.title}</small><strong>{resultArticle.title}</strong><span>{resultArticle.summary}</span></span><ChevronRight size={19} aria-hidden="true" />
            </button>
          ))}</div> : <div className="guide-empty"><Search size={32} aria-hidden="true" /><h3>Nenhum tutorial com esses termos</h3><p>Tente uma palavra mais simples, como “parceiro”, “obrigação” ou “documento”.</p><button type="button" onClick={() => navigate(null)}>Explorar todos os módulos</button></div>}
        </section> : module ? <div className="guide-workspace">
          <aside className="guide-sidebar">
            <button type="button" className="guide-back" onClick={() => navigate(null)}><ArrowLeft size={16} aria-hidden="true" />Todos os módulos</button>
            <div className="guide-sidebar-title"><GuideIcon name={module.icon} /><strong>{module.title}</strong></div>
            <p>{module.articles.length} tutoriais neste módulo</p>
            <nav aria-label={`Tutoriais de ${module.title}`}>
              <button type="button" aria-current={!article ? 'page' : undefined} onClick={() => navigate(module.id)}>Visão geral do módulo</button>
              {module.articles.map((item, index) => <button type="button" key={item.id} aria-current={article?.id === item.id ? 'page' : undefined} onClick={() => navigate(module.id, item.id)}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</button>)}
            </nav>
            <label htmlFor="guide-module-switch">Consultar outro módulo</label>
            <select id="guide-module-switch" value={module.id} onChange={(event) => navigate(event.target.value)}>{HELP_DATA.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          </aside>
          {article ? <GuideArticleView module={module} article={article} onArticle={(id) => navigate(module.id, id)} onRelated={navigate} /> : <section className="guide-module-overview">
            <div className="guide-eyebrow">MANUAL DO MÓDULO</div><h2>{module.title}</h2><p className="guide-lead">{module.description}</p>
            <div className="guide-overview-note"><BookOpen size={20} aria-hidden="true" /><p>Escolha o que deseja fazer. Cada tutorial explica o preparo, as ações na tela e como conferir o resultado.</p></div>
            <h3>O que você quer aprender?</h3>
            <div className="guide-article-list">{module.articles.map((item, index) => <button type="button" key={item.id} onClick={() => navigate(module.id, item.id)}><span className="guide-list-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{item.title}</strong><span>{item.summary}</span><small>{item.steps.length} passos · inclui conferência{GUIDE_SCREENSHOTS[item.id]?.length ? ' · com imagens' : ''}</small></span><ArrowRight size={18} aria-hidden="true" /></button>)}</div>
          </section>}
        </div> : <>
          <section className="guide-start">
            <div className="guide-section-heading"><div><span className="guide-eyebrow">PRIMEIROS PASSOS</span><h2>Chegou agora? Comece por aqui.</h2></div><p>Uma sequência para preparar sua rotina.</p></div>
            <ol>{STARTER_PATH.map((item, index) => <li key={item.id}><button type="button" onClick={() => navigate(item.id)}><span className="guide-start-number">{String(index + 1).padStart(2, '0')}</span><strong>{item.label}</strong><span>{item.detail}</span><ArrowRight size={17} aria-hidden="true" /></button></li>)}</ol>
          </section>
          <section className="guide-catalog">
            <div className="guide-section-heading"><div><span className="guide-eyebrow">EXPLORE O SISTEMA</span><h2>Um manual para cada módulo</h2></div><p>Abra o módulo para ver seus submódulos e tutoriais.</p></div>
            <div className="guide-module-grid">{HELP_DATA.map((item) => <HelpModuleCard key={item.id} module={item} onOpen={() => navigate(item.id)} />)}</div>
          </section>
        </>}
      </div>
      <footer className="guide-footer"><BookOpen size={17} aria-hidden="true" /><p>Os menus e ações disponíveis dependem do seu perfil e dos módulos habilitados pelo escritório. Se uma opção não aparecer, confira com o administrador.</p></footer>
    </div>
  );
}
