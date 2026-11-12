import { useFiscalModels } from '../queries/useFiscalModels';
import type { FiscalDraftData } from '../../services/faturamentoFiscalTypes';
export function ModelPresetSelect({ tenant, configId, disabled, onApply }: {
  tenant: string; configId: string; disabled: boolean; onApply(preset: Partial<FiscalDraftData>): void;
}) {
  const { list } = useFiscalModels(tenant);
  const rows = (list.data || []).filter(row => row.ativo && row.fiscalConfigId === configId);
  return <div className="faturamento-form-group nfse-full"><label htmlFor="nfse-model-preset">Preencher com modelo fiscal</label>
    <select id="nfse-model-preset" disabled={disabled || list.isPending || list.isError} value="" onChange={e => {
      const row = rows.find(model => model.id === e.target.value); if (row) onApply({ ...row.dados });
    }}><option value="">{list.isPending ? 'Carregando modelos...' : 'Selecione para preencher os dados'}</option>
      {rows.map(row => <option value={row.id} key={row.id}>{row.nome}</option>)}
    </select>
    {list.isError && <p role="alert">{list.error.message}</p>}
    <p>O modelo substitui os campos predefinidos. Competência, data e tomador permanecem nesta operação. Revise antes de salvar.</p>
  </div>;
}
