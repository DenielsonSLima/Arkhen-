import { useState } from 'react';
import { fiscalFieldLabels } from '../../forms/nfse/fiscalFormData';
import type { FiscalEmitter } from '../../services/faturamentoFiscalTypes';
import { presetKeys, type ModelInput } from '../services/modelosFiscalService';
interface Props { initial: ModelInput; emitters: FiscalEmitter[]; busy: boolean; onSave(input: ModelInput): Promise<void>; onClose(): void }
export function ModelEditor({ initial, emitters, busy, onSave, onClose }: Props) {
  const [input, setInput] = useState(initial);
  const [error, setError] = useState('');
  return <form className="fiscal-model-editor" onSubmit={event => { event.preventDefault(); setError('');
    void onSave(input).catch(cause => setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.')); }}>
    <h3>{initial.versao ? 'Editar modelo' : 'Novo modelo'}</h3>
    <p>Predefinições WebISS. Competência, data de emissão e tomador são definidos em cada nota. Salvar não transmite NFS-e.</p>
    <fieldset disabled={busy}><div className="fiscal-model-grid">
      <label>Nome do modelo<input required maxLength={100} value={input.nome} onChange={e => setInput({ ...input, nome: e.target.value })} /></label>
      <label>Emitente<select required value={input.fiscalConfigId} onChange={e => setInput({ ...input, fiscalConfigId: e.target.value })}>
        <option value="">Selecione</option>{emitters.map(item => <option key={item.id} value={item.id}>{item.prestadorNome} · {item.prestadorCnpj}</option>)}</select></label>
      {presetKeys.map(key => <label key={key} className={key === 'descricao' ? 'fiscal-model-wide' : ''}>{fiscalFieldLabels[key]}
        {key === 'descricao' ? <textarea required maxLength={4000} rows={3} value={input.dados[key] || ''}
          onChange={e => setInput({ ...input, dados: { ...input.dados, [key]: e.target.value } })} />
          : <input maxLength={100} inputMode={['valor', 'aliquotaIss'].includes(key) ? 'decimal' : undefined}
            placeholder={['valor', 'aliquotaIss'].includes(key) ? 'Opcional, ex.: 100.00' : 'Opcional'}
            value={input.dados[key] || ''} onChange={e => setInput({ ...input, dados: { ...input.dados, [key]: e.target.value } })} />}
      </label>)}
    </div><p>Informe os códigos e enquadramentos revisados pelo responsável fiscal. Campos vazios permanecem para revisão na nota.</p>
    <div className="fiscal-model-actions"><button type="button" className="faturamento-btn-secondary" onClick={onClose}>Cancelar</button>
      <button type="submit" className="faturamento-btn-primary">{busy ? 'Salvando...' : 'Salvar modelo'}</button></div></fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}
