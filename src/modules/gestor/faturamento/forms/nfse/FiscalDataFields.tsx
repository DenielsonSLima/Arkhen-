import type { FiscalDraftData } from '../../services/faturamentoFiscalTypes';
import { fiscalFieldLabels } from './fiscalFormData';
const selects: Partial<Record<keyof FiscalDraftData, [string, string][]>> = {
  exigibilidadeIss: [['1', 'Exigível'], ['2', 'Não incidência'], ['3', 'Isenção'], ['4', 'Exportação'], ['5', 'Imunidade'], ['6', 'Suspensa judicialmente'], ['7', 'Suspensa administrativamente']],
  issRetido: [['1', 'Sim'], ['2', 'Não']], optanteSimplesNacional: [['1', 'Sim'], ['2', 'Não']], incentivoFiscal: [['1', 'Sim'], ['2', 'Não']],
  responsavelRetencao: [['1', 'Tomador'], ['2', 'Intermediário']],
  regimeEspecial: [['1', 'Microempresa municipal'], ['2', 'Estimativa'], ['3', 'Sociedade de profissionais'], ['4', 'Cooperativa'], ['5', 'MEI'], ['6', 'ME/EPP']],
};
export function FiscalDataFields({ data, onChange, disabled }: {
  data: FiscalDraftData; onChange: (data: FiscalDraftData) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="nfse-fields">
    <legend>Dados fiscais da nova nota</legend>
    <p className="nfse-full">Competência, data do RPS e período descrito no serviço são independentes. Confira os três antes de revisar.</p>
    {(Object.keys(fiscalFieldLabels) as (keyof FiscalDraftData)[]).map(key => {
      const label = fiscalFieldLabels[key]; const value = data[key] ?? '';
      const options = selects[key];
      const update = (next: string) => onChange({ ...data, [key]: key === 'competencia' && next ? `${next}-01` : next });
      return <label className={`faturamento-form-group ${key === 'descricao' ? 'nfse-full' : ''}`} key={key}>
        <span>{label}</span>
        {options ? <select value={value} onChange={e => update(e.target.value)}>
          <option value="">Não informado</option>{options.map(([code, title]) => <option value={code} key={code}>{title}</option>)}
        </select> : key === 'descricao' ? <textarea rows={4} maxLength={2000} value={value} onChange={e => update(e.target.value)} />
          : <input type={key === 'competencia' ? 'month' : key === 'dataEmissao' ? 'date' : ['valor', 'aliquotaIss'].includes(key) ? 'number' : 'text'}
            min={['valor', 'aliquotaIss'].includes(key) ? '0' : undefined} step={key === 'aliquotaIss' ? '0.0001' : key === 'valor' ? '0.01' : undefined}
            value={key === 'competencia' ? String(value).slice(0, 7) : value} onChange={e => update(e.target.value)} />}
      </label>;
    })}
  </fieldset>;
}
