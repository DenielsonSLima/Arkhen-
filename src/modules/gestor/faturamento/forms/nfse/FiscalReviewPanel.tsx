import type { FiscalReview } from '../../services/faturamentoFiscalTypes';
import { fiscalFieldLabels } from './fiscalFormData';
export function FiscalReviewPanel({ review }: { review: FiscalReview }) {
  return <section className="nfse-review" aria-label="Revisão fiscal salva">
    <h3>Revisão do rascunho salvo</h3>
    <p><strong>{review.rascunho.ambiente === 'homologacao' ? 'HOMOLOGAÇÃO — SEM VALOR FISCAL' : 'PRODUÇÃO — TRANSMISSÃO NÃO LIBERADA'}</strong></p>
    <p>Emitente: {review.prestador.razaoSocial} · CNPJ {review.prestador.cnpj} · IM {review.prestador.inscricaoMunicipal || 'não informada'}</p>
    <p>Tomador: {review.tomador.razaoSocial} · {review.tomador.documento}</p>
    <p>Destino: {review.endpoint || 'Não definido'}</p>
    <dl className="nfse-review-values">{Object.entries(fiscalFieldLabels).map(([key, label]) => <div key={key}>
      <dt>{label}</dt><dd>{String(review.rascunho.dados[key as keyof typeof review.rascunho.dados] ?? '') || 'Não informado'}</dd>
    </div>)}</dl>
    {review.blockers.length ? <div role="alert"><strong>Pendências antes do envio</strong><ul>{review.blockers.map(item => <li key={item}>{item}</li>)}</ul></div>
      : <p>Dados revisados pelo serviço. A autorização de emissão depende do ambiente e do credenciamento.</p>}
    <p>Salvar e revisar não transmite ao WebISS nem reserva um número de RPS.</p>
  </section>;
}
