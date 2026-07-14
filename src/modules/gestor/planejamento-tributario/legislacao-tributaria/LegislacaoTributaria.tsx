import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Lightbulb,
  Search,
} from 'lucide-react';
import type { ClienteEmpresa, FaixaSimples } from '../services/planejamento.types';
import {
  type ConsultaEnquadramentoSimples,
  formatCurrency,
  formatPercent,
} from '../services/planejamento.service';
import type { AnexoDasParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';
import { CurrencyInput } from '../../shared/CurrencyInput';
import './LegislacaoTributaria.css';

interface Props {
  clientes: ClienteEmpresa[];
  consultaEmpresaId: string;
  setConsultaEmpresaId: (value: string) => void;
  consultaFaturamentoInput: string;
  setConsultaFaturamentoInput: (value: string) => void;
  consultaEnquadramento: ConsultaEnquadramentoSimples;
  anexoTabela: string;
  setAnexoTabela: (value: string) => void;
  faixasExibidas: FaixaSimples[];
  anexosDas: AnexoDasParametro[];
}

interface ArtigoTributario {
  id: string;
  titulo: string;
  categoria: string;
  resumo: string;
  topicos: string[];
}

const ARTIGOS: ArtigoTributario[] = [
  {
    id: 'fator-r',
    titulo: 'Fator R',
    categoria: 'Simples Nacional',
    resumo: 'Quando a folha dos últimos 12 meses atinge 28% da receita bruta, algumas atividades podem migrar do Anexo V para o Anexo III.',
    topicos: ['Usado principalmente em serviços.', 'Exige apuração mensal de folha e receita.', 'Pode reduzir muito a alíquota efetiva.'],
  },
  {
    id: 'anexo-iii',
    titulo: 'Anexo III',
    categoria: 'Anexos',
    resumo: 'Abrange diversos serviços, como desenvolvimento, educação, manutenção e algumas atividades de consultoria quando atendem as regras aplicáveis.',
    topicos: ['Limite geral de R$ 4,8 milhões.', 'Pode receber atividades pelo Fator R.', 'Costuma ser competitivo para serviços com folha relevante.'],
  },
  {
    id: 'impedimentos',
    titulo: 'Quem não pode optar',
    categoria: 'Simples Nacional',
    resumo: 'Empresas com atividade impeditiva, sócio PJ, débitos não regularizados ou faturamento acima do limite exigem atenção antes da opção.',
    topicos: ['Verificar CNAE principal e secundários.', 'Revisar composição societária.', 'Checar regularidade fiscal antes de janeiro.'],
  },
  {
    id: 'iss',
    titulo: 'ISS no Simples',
    categoria: 'Municipal',
    resumo: 'O ISS é recolhido no DAS, mas regras municipais, retenções e local de incidência ainda precisam ser observados.',
    topicos: ['Pode haver retenção pelo tomador.', 'Município pode exigir inscrição local.', 'Serviços fora do município pedem revisão.'],
  },
  {
    id: 'mei',
    titulo: 'MEI',
    categoria: 'Regimes',
    resumo: 'Regime simplificado para baixa receita, com limite e atividades permitidas próprias, sem substituir uma análise de crescimento.',
    topicos: ['Avaliar desenquadramento por faturamento.', 'Conferir atividade permitida.', 'Planejar migração antes de escalar.'],
  },
];

const ANEXO_REGRAS: Record<string, { atividades: string[]; fatorR: string; quandoMuda: string; atencao: string }> = {
  I: {
    atividades: ['Comércio em geral', 'Revenda de mercadorias', 'Lojas virtuais'],
    fatorR: 'Não se aplica',
    quandoMuda: 'Pode migrar de regime por faturamento, margem ou ICMS.',
    atencao: 'Observar ICMS, ST e diferencial de alíquota.',
  },
  II: {
    atividades: ['Indústria', 'Fabricação', 'Transformação'],
    fatorR: 'Não se aplica',
    quandoMuda: 'Mudanças ocorrem por industrialização, faturamento e créditos.',
    atencao: 'Revisar IPI, ICMS e créditos conforme operação.',
  },
  III: {
    atividades: ['Desenvolvimento', 'Educação', 'Manutenção', 'Consultoria enquadrável'],
    fatorR: 'Sim, quando a atividade também puder cair no Anexo V.',
    quandoMuda: 'Pode ser aplicado via Fator R ou por reenquadramento da atividade.',
    atencao: 'Validar CNAE, descrição contratual e folha dos 12 meses.',
  },
  IV: {
    atividades: ['Construção', 'Serviços advocatícios', 'Limpeza e vigilância'],
    fatorR: 'Não muda para Anexo III pelo Fator R.',
    quandoMuda: 'Normalmente muda por atividade exercida ou regime tributário.',
    atencao: 'CPP pode ficar fora do DAS em algumas situações.',
  },
  V: {
    atividades: ['Serviços intelectuais', 'Publicidade', 'Engenharia', 'Medicina'],
    fatorR: 'Sim, pode migrar para Anexo III quando atingir 28%.',
    quandoMuda: 'Folha baixa tende a manter a empresa no Anexo V.',
    atencao: 'É uma das áreas onde a análise por cliente mais importa.',
  },
};

export const LegislacaoTributaria: React.FC<Props> = ({
  clientes,
  consultaEmpresaId,
  setConsultaEmpresaId,
  consultaFaturamentoInput,
  setConsultaFaturamentoInput,
  consultaEnquadramento,
  anexoTabela,
  setAnexoTabela,
  faixasExibidas,
  anexosDas,
}) => {
  const [busca, setBusca] = useState('');
  const regraAnexo = ANEXO_REGRAS[consultaEnquadramento.anexo] ?? ANEXO_REGRAS.III;
  const artigosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ARTIGOS;
    return ARTIGOS.filter((artigo) => {
      return [artigo.titulo, artigo.categoria, artigo.resumo, ...artigo.topicos]
        .join(' ')
        .toLowerCase()
        .includes(termo);
    });
  }, [busca]);

  return (
    <div className="planejamento-tab-content legislacao-layout">
      <section className="legislacao-consulta-card">
        <div className="legislacao-card-heading">
          <div>
            <span>Consulta Tributária</span>
            <h2>Como isso afeta este cliente?</h2>
          </div>
          <FileSearch size={24} />
        </div>

        <div className="legislacao-consulta-grid">
          <div className="comparador-field">
            <label>Empresa</label>
            <select value={consultaEmpresaId} onChange={(event) => setConsultaEmpresaId(event.target.value)}>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
              ))}
              <option value="manual">Faturamento manual</option>
            </select>
          </div>

          <div className="comparador-field">
            <label>Faturamento RBT12</label>
            <CurrencyInput
              value={consultaFaturamentoInput}
              onValueChange={setConsultaFaturamentoInput}
              disabled={consultaEmpresaId !== 'manual'}
            />
          </div>

          <div className="comparador-field">
            <label>Anexo</label>
            <select
              value={consultaEmpresaId === 'manual' ? anexoTabela : consultaEnquadramento.anexo}
              onChange={(event) => setAnexoTabela(event.target.value)}
              disabled={consultaEmpresaId !== 'manual'}
            >
              {anexosDas.map((anexo) => <option key={anexo.id} value={anexo.id}>{anexo.label}</option>)}
            </select>
          </div>
        </div>

        <div className="enquadramento-panel">
          <div>
            <span>Empresa enquadrada</span>
            <strong>{consultaEnquadramento.anexoLabel}</strong>
            <small>{consultaEnquadramento.mensagem}</small>
          </div>
          <Metric label="Faixa" value={`${consultaEnquadramento.faixa}`} />
          <Metric label="Alíquota nominal" value={formatPercent(consultaEnquadramento.aliquotaNominal)} />
          <Metric label="Alíquota efetiva" value={formatPercent(consultaEnquadramento.aliquotaEfetiva)} highlight />
        </div>

        <div className="legislacao-alert">
          <AlertCircle size={17} />
          <span>
            Faltam {formatCurrency(consultaEnquadramento.distanciaProximaFaixa)} para a próxima faixa deste anexo.
          </span>
        </div>
      </section>

      <section className="legislacao-rules-grid">
        <div className="legislacao-rule-card">
          <h3><Building2 size={18} /> Atividades</h3>
          <ul>
            {regraAnexo.atividades.map((atividade) => (
              <li key={atividade}><CheckCircle2 size={15} />{atividade}</li>
            ))}
          </ul>
        </div>
        <div className="legislacao-rule-card">
          <h3><Lightbulb size={18} /> Fator R</h3>
          <p>{regraAnexo.fatorR}</p>
          <strong>Quando muda</strong>
          <p>{regraAnexo.quandoMuda}</p>
        </div>
        <div className="legislacao-rule-card">
          <h3><BookOpen size={18} /> Ponto de atenção</h3>
          <p>{regraAnexo.atencao}</p>
          <strong>Limite</strong>
          <p>R$ 4.800.000,00 de receita bruta anual no Simples Nacional.</p>
        </div>
      </section>

      <section className="base-conhecimento-card">
        <div className="base-conhecimento-header">
          <div>
            <span>Base de Conhecimento Tributária</span>
            <h3>Pesquisar regra, imposto ou enquadramento</h3>
          </div>
          <div className="base-search">
            <Search size={16} />
            <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="ICMS, ISS, Fator R, Anexo III, MEI..." />
          </div>
        </div>

        <div className="artigos-grid">
          {artigosFiltrados.map((artigo) => (
            <article key={artigo.id} className="artigo-card">
              <span>{artigo.categoria}</span>
              <h4>{artigo.titulo}</h4>
              <p>{artigo.resumo}</p>
              <ul>
                {artigo.topicos.map((topico) => <li key={topico}>{topico}</li>)}
              </ul>
              <button type="button">Abrir artigo <ChevronRight size={15} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="legislacao-table-card">
        <div className="base-conhecimento-header compact">
          <div>
            <span>Tabela contextual</span>
            <h3>{consultaEnquadramento.anexoLabel} com faixa destacada</h3>
          </div>
        </div>
        <table className="tabela-aliquotas-table">
          <thead>
            <tr>
              <th>Faixa</th>
              <th>Faturamento anual</th>
              <th>Alíquota nominal</th>
              <th>Valor a deduzir</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {faixasExibidas.map((faixa) => {
              const active = faixa.faixa === consultaEnquadramento.faixa;
              return (
                <tr key={faixa.faixa} className={active ? 'linha-faixa-atual' : ''}>
                  <td><span className="faixa-badge">{faixa.faixa}</span></td>
                  <td>{formatRange(faixa)}</td>
                  <td><strong>{formatPercent(faixa.aliquotaNominal)}</strong></td>
                  <td>{formatCurrency(faixa.valorDeduzir)}</td>
                  <td>{active ? 'Faixa atual' : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`enquadramento-metric${highlight ? ' highlight' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

function formatRange(faixa: FaixaSimples): string {
  if (faixa.limiteInferior === 0) return `Até ${formatCurrency(faixa.limiteSuperior)}`;
  return `De ${formatCurrency(faixa.limiteInferior)} a ${formatCurrency(faixa.limiteSuperior)}`;
}
