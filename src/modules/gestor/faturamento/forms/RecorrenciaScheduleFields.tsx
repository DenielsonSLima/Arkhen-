import { useFiscalBillingTenant, useFiscalEmitters } from '../queries/useFaturamentoFiscalQueries';
import type { RecorrenciaConfig } from '../services/recorrenciaService';
import { FiscalDataFields } from './nfse/FiscalDataFields';
import { blankFiscalData } from './nfse/fiscalFormData';
import './nfse/NfseDraft.css';

interface Props { config: RecorrenciaConfig; onChange: (value: RecorrenciaConfig) => void; active: boolean; onActiveChange: (active: boolean) => void }
export function RecorrenciaScheduleFields({ config, onChange, active, onActiveChange }: Props) {
  const tenant = useFiscalBillingTenant();
  const emitters = useFiscalEmitters(tenant.data || '');
  const update = (patch: Partial<RecorrenciaConfig>) => onChange({ ...config, ...patch });
  return <section style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>
    <h3>Competência e próximas mensalidades</h3>
    <label className="faturamento-form-group"><span>Primeira competência</span>
      <input type="month" value={config.primeiraCompetencia.slice(0, 7)} onChange={e => update({ primeiraCompetencia: e.target.value ? `${e.target.value}-01` : '' })} /></label>
    <label className="faturamento-switch-row"><input type="checkbox" checked={active} onChange={e => onActiveChange(e.target.checked)} />
      <span><strong>Ativar agendamento mensal</strong><small>Autoriza o processamento das próximas competências com as condições deste contrato.</small></span></label>
    <div className="nfse-fields">
      <label className="faturamento-form-group"><span>Dia de processamento</span><select value={config.diaProcessamento} onChange={e => update({ diaProcessamento: Number(e.target.value) })}>
        {Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>Dia {index + 1}</option>)}</select></label>
      <label className="faturamento-form-group"><span>Competência da mensalidade</span><select value={config.competenciaOffset} onChange={e => update({ competenciaOffset: Number(e.target.value) as 0 | -1 })}>
        <option value={0}>Mês do processamento</option><option value={-1}>Mês anterior ao processamento</option></select></label>
    </div>
    <p>O servidor define vencimento, competência e substitui [MES] e [ANO] na descrição. Cada competência possui uma execução única, que pode ser retomada em caso de falha.</p>
    <label className="faturamento-form-group"><span>Tratamento da NFS-e</span><select value={config.modoFiscal} onChange={e => update({ modoFiscal: e.target.value as RecorrenciaConfig['modoFiscal'] })}>
      <option value="sem_nfse">Somente cobrança; preparar nota separadamente</option>
      <option value="rascunho">Gerar rascunho para revisar antes de transmitir</option>
      <option value="na_data">Transmitir na data do processamento</option>
      <option value="no_pagamento">Transmitir após pagamento confirmado</option>
    </select></label>
    {config.modoFiscal !== 'sem_nfse' && <>
      <div className="nfse-fields">
        <label className="faturamento-form-group"><span>Ambiente fiscal</span><select value={config.ambiente} onChange={e => update({ ambiente: e.target.value as RecorrenciaConfig['ambiente'], fiscalConfigId: '' })}>
          <option value="homologacao">Homologação</option><option value="producao">Produção</option></select></label>
        <label className="faturamento-form-group"><span>Emitente da NFS-e</span><select value={config.fiscalConfigId} onChange={e => update({ fiscalConfigId: e.target.value })}>
          <option value="">Selecione a configuração do escritório</option>{(emitters.data || []).filter(item => item.ambiente === config.ambiente).map(item => <option key={item.id} value={item.id}>{item.prestadorNome} · {item.prestadorCnpj}{item.ativo ? '' : ' (inativo)'}</option>)}</select></label>
      </div>
      {emitters.isError && <p role="alert">Não foi possível carregar os emitentes.</p>}
      <p>Revise os códigos e o enquadramento fiscal. Valor e descrição seguem o contrato; datas são definidas em cada competência. Produção depende da liberação fiscal do escritório.</p>
      <FiscalDataFields recurring data={{ ...blankFiscalData(), ...config.dadosFiscais }} onChange={dadosFiscais => update({ dadosFiscais })} />
    </>}
  </section>;
}
