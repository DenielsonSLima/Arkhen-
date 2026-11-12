import { useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { nationalFieldGroups } from './nationalFormFields';
import { nationalFieldsFromForm, nationalFormFromFields, type NationalFormValues } from './nationalFormData';
import { getNationalChargeReview, saveNationalReview, type NationalStoredReview } from './nationalReviewService';
import '../nfse/NfseDraft.css';
import './NationalDraft.css';
interface Props { serviceReference?:string; backLabel?: string; configId: string; chargeId: string; tenantId: string; onClose: () => void; onBack: () => void; }
export function NationalDraftForm(props: Props) {
  const query = useQuery({ queryKey: ['faturamento', 'national-review', props.tenantId, props.configId, props.serviceReference || props.chargeId],
    queryFn: () => getNationalChargeReview(props.configId, props.chargeId, props.serviceReference), staleTime: 0, gcTime: 0, retry: false });
  if (!query.isPending && !query.isError) return <NationalDraftEditor key={`${props.tenantId}-${props.configId}-${props.chargeId}-${query.data?.draftId || 'new'}`}
    {...props} existing={query.data || null} />;
  return createPortal(<div className="faturamento-modal-backdrop nfse-draft-backdrop"><div className="faturamento-card nfse-draft-modal" role="dialog" aria-modal="true" aria-label="Carregar revisão nacional">
    <header className="faturamento-modal-header"><h2>Revisão nacional</h2><button type="button" aria-label="Fechar revisão nacional" onClick={props.onClose}>Fechar</button></header>
    <div className="nfse-draft-body">{query.isError ? <p role="alert">Não foi possível carregar a revisão. Nenhum rascunho novo será criado enquanto a consulta falhar.</p> : <p role="status">Consultando revisão da cobrança...</p>}</div>
    <footer className="faturamento-modal-actions"><button type="button" onClick={props.onBack}>{props.backLabel || 'Voltar ao WebISS'}</button>{query.isError && <button type="button" onClick={() => void query.refetch()}>Tentar novamente</button>}</footer>
  </div></div>, document.body);
}
export function NationalDraftEditor({ configId, chargeId, tenantId, onClose, onBack, existing, backLabel, serviceReference }: Props & { existing: NationalStoredReview | null }) {
  const [values, setValues] = useState<NationalFormValues>(() => existing ? nationalFormFromFields(existing.fields) : {});
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [draftId] = useState(() => existing?.draftId || crypto.randomUUID());
  const lock = useRef(false);
  const [reviewedAt, setReviewedAt] = useState(existing?.reviewedAt || null);
  const readOnly = existing?.editable === false;
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: saveNationalReview,
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['faturamento', 'national-review', tenantId, configId, serviceReference || chargeId] }), queryClient.invalidateQueries({ queryKey: ['faturamento', 'national-reviews', tenantId, configId] })]); } });
  const update = (key: string, value: string) => { setValues(current => ({ ...current, [key]: value })); setConfirmed(false); setReviewed(false); setError(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current || !confirmed || readOnly) return;
    lock.current = true; setError(''); setReviewed(false);
    try {
      const fields = nationalFieldsFromForm(values);
      const saved = await mutation.mutateAsync({ service_reference:serviceReference, fiscal_config_id: configId, charge_id: chargeId, draft_id: draftId, fields, expected_reviewed_at: reviewedAt });
      setReviewedAt(saved.reviewedAt);
      setReviewed(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a revisão.'); }
    finally { lock.current = false; }
  };
  return createPortal(<div className="faturamento-modal-backdrop nfse-draft-backdrop"><form className="faturamento-card nfse-draft-modal national-draft" role="dialog" aria-modal="true" aria-label="Revisar NFS-e nacional" onSubmit={submit}>
    <header className="faturamento-modal-header"><div><h2>Revisar NFS-e nacional</h2><p>Homologação · vinculada à cobrança · sem transmissão</p></div>
      <button type="button" className="faturamento-modal-close" aria-label="Fechar revisão nacional" disabled={mutation.isPending} onClick={onClose}><X size={20} /></button></header>
    <div className="nfse-draft-body">
      {existing && <p role="note">{readOnly ? 'Esta revisão já foi preparada e não pode ser alterada. Nenhuma nova transmissão será realizada nesta tela.' : existing.state === 'REVIEW_REQUIRED' ? 'Os dados de origem mudaram. Confira e confirme novamente a revisão antes de salvar.' : 'Revisão anterior carregada. Confira os dados e confirme novamente para salvar alterações.'}</p>}
      <p className="national-unavailable">Emissão e cancelamento nacionais ainda indisponíveis. Esta etapa apenas registra uma revisão no servidor, quando a integração estiver disponível. O padrão WebISS permanece separado.</p>
      <p>Informe os códigos e escolhas do padrão nacional. Nenhum enquadramento será copiado automaticamente do WebISS. Série, número da DPS e data de emissão serão definidos pelo servidor.</p>
      {nationalFieldGroups.map(group => <fieldset key={group.title} className="nfse-fields" disabled={mutation.isPending || readOnly}><legend>{group.title}</legend>
        {group.fields.map(field => <label key={field.key} className={`faturamento-form-group ${field.type === 'textarea' ? 'nfse-full' : ''}`}><span>{field.label}{field.optional ? ' (opcional)' : ''}</span>
          {field.options ? <select required={!field.optional} value={values[field.key] || ''} onChange={event => update(field.key, event.target.value)}><option value="">Selecione</option>{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            : field.type === 'textarea' ? <textarea required maxLength={2000} value={values[field.key] || ''} onChange={event => update(field.key, event.target.value)} />
              : <input type={field.type || 'text'} required={!field.optional} pattern={field.pattern} value={values[field.key] || ''} onChange={event => update(field.key, event.target.value)} />}
        </label>)}
      </fieldset>)}
      <fieldset className="nfse-fields" disabled={mutation.isPending || readOnly}><legend>IBS/CBS e confirmação</legend>
        <label className="faturamento-form-group nfse-full"><span>Tratamento IBS/CBS revisado</span><select required value={values.ibscbs || ''} onChange={event => update('ibscbs', event.target.value)}><option value="">Selecione após conferir o enquadramento</option><option value="NOT_APPLICABLE_CONFIRMED">Não aplicável, conforme revisão fiscal</option><option value="DECLARED_CONFIRMED">Declarar IBS/CBS</option></select></label>
        {values.ibscbs === 'DECLARED_CONFIRMED' && <>
          <label className="faturamento-form-group"><span>Uso pessoal</span><select required value={values.personalUse || ''} onChange={event => update('personalUse', event.target.value)}><option value="">Selecione</option><option value="0">Não</option><option value="1">Sim</option></select></label>
          {[['operationCode','Código da operação (6 dígitos)','[0-9]{6}'],['cst','CST (3 dígitos)','[0-9]{3}'],['classificationCode','Classificação tributária (6 dígitos)','[0-9]{6}']].map(([key,label,pattern]) => <label className="faturamento-form-group" key={key}><span>{label}</span><input required pattern={pattern} value={values[key] || ''} onChange={event => update(key, event.target.value)} /></label>)}
          <p className="nfse-full">Nesta etapa, somente operações em que o tomador é o adquirente. Compras governamentais e substituições não estão disponíveis.</p>
        </>}
        <label className="nfse-confirm nfse-full"><input type="checkbox" required checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setReviewed(false); }} />Conferi tomador, competência, classificação e IBS/CBS. Confirmo ausência de retenções federais, deduções e descontos, e que o tomador é o adquirente quando IBS/CBS for declarado.</label>
        <p className="nfse-full">Se houver retenções federais, deduções, descontos ou outro cenário não suportado, não confirme esta revisão.</p>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {reviewed && <p role="status">Revisão salva no servidor. Nenhuma DPS ou NFS-e foi transmitida. A emissão nacional continua indisponível.</p>}
    </div>
    <footer className="faturamento-modal-actions"><button type="button" className="faturamento-btn-secondary nfse-draft-back" disabled={mutation.isPending} onClick={onBack}>{backLabel || 'Voltar ao WebISS'}</button>
      <button type="submit" className="faturamento-btn-primary" disabled={mutation.isPending || !confirmed || reviewed || readOnly}>{mutation.isPending ? 'Salvando revisão...' : 'Salvar revisão nacional'}</button>
      <button type="button" className="faturamento-btn-secondary" disabled title="Transmissão nacional não habilitada">Emissão indisponível</button></footer>
  </form></div>, document.body);
}
