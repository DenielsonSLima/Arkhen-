import React, { useMemo, useState } from 'react';
import { BookOpenCheck, Check, ExternalLink, Search, ShieldCheck, X } from 'lucide-react';
import { useCnae } from '../hooks/useCnae';
import type { Cnae } from '../services/parametrizacaoService';
import './CnaePage.css';

type Filtro = 'todos' | 'mei' | 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'inativos';

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'mei', label: 'MEI' },
  { id: 'simples_nacional', label: 'Simples Nacional' },
  { id: 'lucro_presumido', label: 'Lucro Presumido' },
  { id: 'lucro_real', label: 'Lucro Real' },
  { id: 'inativos', label: 'Inativos' },
];

const REGIMES: Record<Cnae['regimesPermitidos'][number], string> = {
  mei: 'MEI',
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
};
export const CnaePage: React.FC = () => {
  const { cnaes, isLoading, isSaving, successMsg, errorMsg, searchQuery, setSearchQuery, handleToggleCnae } = useCnae();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const cnaesFiltrados = useMemo(() => cnaes.filter((cnae) => {
    if (filtro === 'todos') return true;
    if (filtro === 'inativos') return !cnae.ativo;
    return cnae.regimesPermitidos.includes(filtro);
  }), [cnaes, filtro]);

  const ativos = cnaes.filter((item) => item.ativo).length;
  const mei = cnaes.filter((item) => item.ativo && item.meiPermitido).length;

  return (
    <div className="submodule-content-card cnae-catalog-page animate-fade-in">
      <header className="cnae-catalog-header">
        <div className="cnae-title-block">
          <span className="cnae-title-icon"><BookOpenCheck size={22} /></span>
          <div>
            <h2>Catálogo de Atividades Econômicas (CNAE)</h2>
            <p>Classificações padrão do sistema. O escritório escolhe quais atividades ficam disponíveis para uso.</p>
          </div>
        </div>
        <div className="cnae-summary">
          <span><strong>{ativos}</strong> ativos</span>
          <span><strong>{mei}</strong> permitidos ao MEI</span>
        </div>
      </header>

      <div className="cnae-official-notice">
        <ShieldCheck size={18} />
        <div>
          <strong>Catálogo protegido e classificado</strong>
          <span>As regras padrão não podem ser alteradas ou excluídas. Anexos múltiplos indicam que o enquadramento depende da operação, do fator R ou de outras condições legais.</span>
        </div>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}
      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div className="cnae-controls">
        <div className="search-input-wrapper cnae-search">
          <Search size={16} className="search-icon-inside" />
          <input type="text" placeholder="Buscar por código, atividade ou ocupação MEI..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </div>
        <nav className="cnae-filters" aria-label="Filtrar catálogo CNAE">
          {FILTROS.map((item) => (
            <button key={item.id} className={filtro === item.id ? 'active' : ''} onClick={() => setFiltro(item.id)}>{item.label}</button>
          ))}
        </nav>
      </div>

      {isLoading ? (
        <div className="sub-loading">Carregando catálogo CNAE...</div>
      ) : cnaesFiltrados.length === 0 ? (
        <div className="empty-state-card"><p>Nenhum CNAE encontrado para este filtro.</p></div>
      ) : (
        <div className="table-responsive cnae-table-wrap">
          <table className="config-table cnae-table">
            <thead><tr><th>CNAE / atividade</th><th>MEI</th><th>Regimes permitidos</th><th>Anexos do Simples</th><th>Presunção</th><th>Disponibilidade</th></tr></thead>
            <tbody>{cnaesFiltrados.map((cnae) => (
              <tr key={cnae.id} className={!cnae.ativo ? 'is-inactive' : ''}>
                <td className="cnae-description-cell">
                  <div><code className="ip-code">{cnae.codigo}</code><span className="cnae-system-badge">Padrão</span></div>
                  <strong>{cnae.descricao}</strong>
                  {cnae.observacoes && <small>{cnae.observacoes}</small>}
                  <div className="cnae-source-links">
                    <a href={cnae.fonteCnaeUrl} target="_blank" rel="noreferrer">Fonte CNAE <ExternalLink size={11} /></a>
                    <a href={cnae.fonteTributariaUrl} target="_blank" rel="noreferrer">Fonte tributária <ExternalLink size={11} /></a>
                  </div>
                </td>
                <td>
                  {cnae.meiPermitido ? (
                    <div className="cnae-mei-info"><span className="cnae-yes"><Check size={13} /> Permitido</span><small>{cnae.meiTipo === 'caminhoneiro' ? 'MEI Caminhoneiro' : cnae.meiOcupacoes.join(' · ')}</small></div>
                  ) : <span className="cnae-no"><X size={13} /> Não permitido</span>}
                </td>
                <td><div className="cnae-badges">{cnae.regimesPermitidos.map((regime) => <span key={regime} className={`cnae-badge ${regime}`}>{REGIMES[regime]}</span>)}</div></td>
                <td><div className="cnae-badges">{cnae.anexosSimples.length ? cnae.anexosSimples.map((anexo) => <span key={anexo} className="cnae-badge anexo">{anexo}</span>) : <span className="cnae-muted">Não se aplica</span>}{cnae.sujeitoFatorR && <small className="cnae-factor">Sujeito ao fator R</small>}</div></td>
                <td><small>IRPJ <strong>{cnae.presuncaoIrpj.toFixed(2)}%</strong></small><small>CSLL <strong>{cnae.presuncaoCsll.toFixed(2)}%</strong></small></td>
                <td><button type="button" className={`cnae-status-toggle ${cnae.ativo ? 'active' : ''}`} disabled={isSaving} onClick={() => handleToggleCnae(cnae.id, !cnae.ativo)} aria-pressed={cnae.ativo}>{cnae.ativo ? 'Ativo' : 'Inativo'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};
