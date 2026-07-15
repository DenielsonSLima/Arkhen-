import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useSaveAdequacaoMutation } from '../hooks/useReformaTributariaQueries';
import type { ReformaCliente } from '../services/reformaTributaria.types';

const DOCUMENT_TYPES = [
  ['nfe', 'NF-e'], ['nfce', 'NFC-e'], ['nfse', 'NFS-e'], ['cte', 'CT-e'], ['mdfe', 'MDF-e'],
] as const;

export const AdequacaoForm = ({ cliente }: { cliente: ReformaCliente }) => {
  const mutation = useSaveAdequacaoMutation();
  const [values, setValues] = useState({
    emissor: cliente.emissor,
    ambiente: cliente.ambiente,
    tiposDocumentos: cliente.tiposDocumentos,
    responsavel: cliente.responsavel,
    prazo: cliente.prazo,
    observacoes: cliente.observacoes,
  });

  useEffect(() => {
    setValues({
      emissor: cliente.emissor,
      ambiente: cliente.ambiente,
      tiposDocumentos: cliente.tiposDocumentos,
      responsavel: cliente.responsavel,
      prazo: cliente.prazo,
      observacoes: cliente.observacoes,
    });
  }, [cliente]);

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const toggleDocument = (id: string) => setValues((current) => ({
    ...current,
    tiposDocumentos: current.tiposDocumentos.includes(id)
      ? current.tiposDocumentos.filter((item) => item !== id)
      : [...current.tiposDocumentos, id],
  }));

  return (
    <form className="rtc-form" onSubmit={(event) => {
      event.preventDefault();
      mutation.mutate({ clienteId: cliente.id, ...values });
    }}>
      <div className="rtc-form-grid">
        <label><span>Emissor ou ERP</span><input value={values.emissor} onChange={(event) => set('emissor', event.target.value)} placeholder="Ex.: Omie, Conta Azul, WebISS" maxLength={160} /></label>
        <label><span>Ambiente</span><select value={values.ambiente} onChange={(event) => set('ambiente', event.target.value)}><option value="homologacao">Homologação</option><option value="producao">Produção</option></select></label>
        <label><span>Responsável</span><input value={values.responsavel} onChange={(event) => set('responsavel', event.target.value)} placeholder="Responsável no escritório" maxLength={160} /></label>
        <label><span>Prazo</span><input type="date" value={values.prazo} onChange={(event) => set('prazo', event.target.value)} /></label>
      </div>
      <fieldset className="rtc-document-types"><legend>Documentos emitidos</legend>{DOCUMENT_TYPES.map(([id, label]) => <label key={id}><input type="checkbox" checked={values.tiposDocumentos.includes(id)} onChange={() => toggleDocument(id)} /><span>{label}</span></label>)}</fieldset>
      <label className="rtc-form-full"><span>Observações</span><textarea rows={4} maxLength={4000} value={values.observacoes} onChange={(event) => set('observacoes', event.target.value)} placeholder="Registre fornecedor, chamado aberto e pendências técnicas." /></label>
      {mutation.error && <div className="rtc-form-error">{mutation.error.message}</div>}
      {mutation.isSuccess && <div className="rtc-form-success">Adequação atualizada e sincronizada.</div>}
      <button type="submit" className="rtc-primary-button" disabled={mutation.isPending}><Save size={16} />{mutation.isPending ? 'Salvando...' : 'Salvar adequação'}</button>
    </form>
  );
};
