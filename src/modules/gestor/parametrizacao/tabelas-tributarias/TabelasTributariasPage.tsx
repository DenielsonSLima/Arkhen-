import React, { useMemo, useState } from 'react';
import { BookOpenCheck, ExternalLink, History, LockKeyhole, RefreshCw } from 'lucide-react';
import { useTabelasTributarias } from './queries/useTabelasTributarias';
import './TabelasTributariasPage.css';

const CATEGORIAS = [
  { id: '', label: 'Todas', tipos: [] },
  { id: 'pessoa_fisica', label: 'Pessoa Física', tipos: ['irrf_mensal', 'irpf_anual', 'carne_leao', 'dividendos', 'ganho_capital'] },
  { id: 'inss', label: 'INSS', tipos: ['inss'] },
  { id: 'mei', label: 'MEI', tipos: ['mei'] },
];

const formatDate = (value: string | null) => value
  ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
  : 'Sem término';

const prettify = (value: unknown): string => {
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value ?? '—');
};

export const TabelasTributariasPage: React.FC = () => {
  const [categoria, setCategoria] = useState('');
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));
  const query = useTabelasTributarias(undefined, competencia);
  const parametros = useMemo(() => {
    const tipos = CATEGORIAS.find((item) => item.id === categoria)?.tipos ?? [];
    return (query.data ?? []).filter((parametro) => tipos.length === 0 || tipos.includes(parametro.categoria));
  }, [categoria, query.data]);

  return (
    <div className="submodule-content-card tabelas-tributarias-page animate-fade-in">
      <header className="tributarias-header">
        <div>
          <h2><BookOpenCheck size={21} /> Tabelas Tributárias</h2>
          <p>Regras oficiais versionadas por vigência, utilizadas pelas simulações no Supabase.</p>
        </div>
        <button className="btn-cancel" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={15} /> {query.isFetching ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      <div className="tributarias-notice">
        <LockKeyhole size={18} />
        <div><strong>Catálogo oficial protegido</strong><span>Alterações legais são publicadas como nova versão; registros anteriores permanecem disponíveis para competências passadas.</span></div>
      </div>

      <div className="tributarias-controls">
        <nav className="tributarias-tabs" aria-label="Categorias tributárias">
          {CATEGORIAS.map((item) => (
            <button key={item.id || 'todas'} className={categoria === item.id ? 'active' : ''} onClick={() => setCategoria(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <label className="tributarias-competencia" htmlFor="tributarias-competencia">
          <span>Competência consultada</span>
          <input id="tributarias-competencia" type="month" value={competencia} onChange={(event) => setCompetencia(event.target.value)} />
        </label>
      </div>

      {query.isLoading && <div className="sub-loading">Carregando tabelas tributárias...</div>}
      {query.isError && <div className="error-banner">{query.error instanceof Error ? query.error.message : 'Não foi possível carregar as tabelas.'}</div>}
      {!query.isLoading && !query.isError && parametros.length === 0 && <div className="tributarias-empty">Nenhum parâmetro vigente encontrado para esta categoria e competência.</div>}

      <div className="tributarias-grid">
        {parametros.map((parametro) => (
          <article className="tributaria-card" key={`${parametro.codigo}-${parametro.versao}-${parametro.origem}`}>
            <div className="tributaria-card-title">
              <div><span className="tributaria-code">{parametro.codigo}</span><h3>{parametro.nome}</h3></div>
              <span className={`tributaria-origin ${parametro.origem}`}>{parametro.origem === 'oficial' ? 'Oficial' : 'Escritório'}</span>
            </div>
            <div className="tributaria-meta">
              <span><History size={13} /> Versão {parametro.versao}</span>
              <span>Vigência: {formatDate(parametro.vigenciaInicio)} até {formatDate(parametro.vigenciaFim)}</span>
              {parametro.competencia && <span>Competência: {parametro.competencia}</span>}
            </div>

            {parametro.faixas?.length > 0 && (
              <div className="tributaria-table-wrap">
                <table className="tributaria-table">
                  <thead><tr><th>Faixa</th><th>Até</th><th>Alíquota</th><th>Dedução</th></tr></thead>
                  <tbody>{parametro.faixas.map((faixa) => (
                    <tr key={faixa.ordem}>
                      <td>{faixa.ordem}</td><td>{prettify(faixa.limiteSuperior)}</td><td>{prettify(faixa.aliquota)}%</td><td>{prettify(faixa.deducao)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {Object.keys(parametro.configuracao ?? {}).length > 0 && (
              <dl className="tributaria-config">
                {Object.entries(parametro.configuracao).slice(0, 8).map(([chave, valor]) => (
                  <div key={chave}><dt>{chave.replaceAll('_', ' ')}</dt><dd>{prettify(valor)}</dd></div>
                ))}
              </dl>
            )}

            <footer>
              <span>{parametro.norma || 'Fonte oficial registrada na versão'}</span>
              {parametro.fonteUrl && <a href={parametro.fonteUrl} target="_blank" rel="noreferrer">Fonte <ExternalLink size={12} /></a>}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
};
