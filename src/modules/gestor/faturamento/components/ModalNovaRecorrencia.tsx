import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CalendarDays, Check, FileText, Percent, Repeat, X } from 'lucide-react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useRecorrenciaMutations } from '../queries/useRecorrenciaQueries';
import type { RecorrenciaConfig } from '../services/recorrenciaService';
import { RecorrenciaScheduleFields } from '../forms/RecorrenciaScheduleFields';
import {
  BillingClientSelect,
  BillingInputFrame,
  BillingSectionTitle,
  formatCurrencyInput,
  formatPercentInput,
  parseCurrencyInput,
  parsePercentInput,
} from './billingFormUtils';


interface ModalNovaRecorrenciaProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalNovaRecorrencia: React.FC<ModalNovaRecorrenciaProps> = ({ isOpen, onClose }) => {
  const clientesQuery = useQuery({
    queryKey: ['gestao-empresarial', 'companies'],
    queryFn: gestaoEmpresarialService.getCompanies,
    enabled: isOpen,
  });
  const mutations = useRecorrenciaMutations();
  const [emitCobranca, setEmitCobranca] = useState(true);
  const [clienteEmpresaId, setClienteEmpresaId] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [diaVencimento, setDiaVencimento] = useState(1);
  const [descricaoServico, setDescricaoServico] = useState('Honorários contábeis');
  const [meioPagamento, setMeioPagamento] = useState<'Pix' | 'Boleto' | 'Ambos'>('Ambos');
  const [descontoPercentual, setDescontoPercentual] = useState('');
  const [jurosPercentual, setJurosPercentual] = useState('');
  const [multaPercentual, setMultaPercentual] = useState('');
  const [mensagemBoleto, setMensagemBoleto] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [automacaoAtiva, setAutomacaoAtiva] = useState(false);
  const initialSchedule = (): RecorrenciaConfig => ({
    meioPagamento: 'Ambos', descontoPercentual: 0, jurosPercentual: 0, multaPercentual: 0, mensagemBoleto: '',
    diaProcessamento: 1, primeiraCompetencia: '', competenciaOffset: 0, modoFiscal: 'sem_nfse',
    ambiente: 'homologacao', fiscalConfigId: '', dadosFiscais: {},
  });
  const [schedule, setSchedule] = useState<RecorrenciaConfig>(initialSchedule);
  const pendingExecution = useRef<string | null>(null);
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contractSaved, setContractSaved] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    pendingExecution.current = null;
    setContractSaved(false);
    setAutomacaoAtiva(false);
    setSchedule(initialSchedule());
    setEmitCobranca(true);
    setClienteEmpresaId('');
    setValorMensal('');
    setDiaVencimento(1);
    setDescricaoServico('Honorários contábeis');
    setMeioPagamento('Ambos');
    setDescontoPercentual('');
    setJurosPercentual('');
    setMultaPercentual('');
    setMensagemBoleto('');
    setErrorMsg(null);
  };

  const handleClose = () => {
    if (submitting.current) return;
    if (!pendingExecution.current) resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting.current) return;
    const valor = parseCurrencyInput(valorMensal);
    if (!pendingExecution.current && (!clienteEmpresaId || valor <= 0)) {
      setErrorMsg('Selecione o parceiro e informe um valor mensal válido.');
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    try {
      setErrorMsg(null);
      if (!pendingExecution.current) {
        const result = await mutations.save.mutateAsync({
          clienteEmpresaId, descricaoServico, valorMensal: valor, diaVencimento, ativo: true,
          recorrenciaAtiva: automacaoAtiva, gerarPrimeiraCobranca: emitCobranca,
          recorrenciaConfig: { ...schedule, meioPagamento,
            descontoPercentual: parsePercentInput(descontoPercentual),
            jurosPercentual: parsePercentInput(jurosPercentual), multaPercentual: parsePercentInput(multaPercentual),
            mensagemBoleto: mensagemBoleto.trim() },
        });
        if (result.execucao) {
          pendingExecution.current = result.execucao.id;
          setContractSaved(true);
        }
      }
      if (pendingExecution.current) await mutations.run.mutateAsync(pendingExecution.current);
      resetForm();
      onClose();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Falha ao salvar recorrência.';
      setErrorMsg(pendingExecution.current
        ? `Contrato salvo. A primeira cobrança ainda não foi confirmada. Tente novamente para consultar a mesma operação. ${detail}`
        : detail);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="faturamento-modal-backdrop">
      <div className="faturamento-card faturamento-charge-modal" role="dialog" aria-modal="true" aria-label="Nova recorrência">
        <div className="faturamento-modal-header">
          <div className="faturamento-modal-title-wrap">
            <span className="faturamento-modal-title-icon">
              <Repeat size={20} />
            </span>
            <div>
              <h2>Nova recorrência</h2>
              <p>Mensalidades por competência, cobrança e preparação da NFS-e.</p>
            </div>
          </div>
          <button disabled={isSubmitting} onClick={handleClose} className="faturamento-modal-close" title="Fechar">
            <X size={20} />
          </button>
        </div>

        <fieldset className="faturamento-charge-form" disabled={isSubmitting || contractSaved} inert={isSubmitting || contractSaved} style={{ border: 0, margin: 0, minWidth: 0 }}>
          <BillingSectionTitle title="Cliente e mensalidade" description="Cadastre o parceiro e as condições que serão usadas nas mensalidades." />

          <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Parceiro / Cliente</label>
            <BillingClientSelect
              clientes={clientesQuery.data || []}
              value={clienteEmpresaId}
              onChange={setClienteEmpresaId}
              isLoading={clientesQuery.isLoading}
            />
          </div>

          <div className="faturamento-form-group">
            <label>Valor Mensal (R$)</label>
            <BillingInputFrame icon={
              <Banknote size={16} />
            }>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Valor mensal"
                placeholder="R$ 0,00"
                value={valorMensal}
                onChange={(event) => setValorMensal(formatCurrencyInput(event.target.value))}
              />
            </BillingInputFrame>
          </div>

          <div className="faturamento-form-group">
            <label>Dia de vencimento</label>
            <BillingInputFrame icon={
              <CalendarDays size={16} />
            }>
              <select aria-label="Dia de vencimento" value={diaVencimento} onChange={(event) => setDiaVencimento(Number(event.target.value))}>
                {[...Array(28)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>Dia {i + 1}</option>
                ))}
              </select>
            </BillingInputFrame>
          </div>

          <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Descrição da cobrança</label>
            <BillingInputFrame icon={
              <FileText size={16} />
            }>
              <input
                type="text"
                placeholder="Honorários referentes a [MES]/[ANO]..."
                value={descricaoServico}
                onChange={(event) => setDescricaoServico(event.target.value)}
              />
            </BillingInputFrame>
          </div>

          <BillingSectionTitle title="Condições Banco Inter" description="As condições ficam salvas no contrato para cada competência." />

          <label className="faturamento-switch-row" style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={emitCobranca} onChange={(e) => setEmitCobranca(e.target.checked)} />
            <span>
              <strong>Gerar primeira cobrança automaticamente</strong>
              <small>Processa a primeira competência após salvar. Se ocorrer falha, a mesma execução poderá ser retomada.</small>
            </span>
          </label>

          {(emitCobranca || automacaoAtiva) && (
            <>
              <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Forma de pagamento</label>
                <select value={meioPagamento} onChange={(event) => setMeioPagamento(event.target.value as 'Pix' | 'Boleto' | 'Ambos')}>
                  <option value="Ambos">Boleto + Pix</option>
                  <option value="Pix">Apenas Pix</option>
                  <option value="Boleto">Boleto</option>
                </select>
              </div>

              <div className="faturamento-form-group">
                <label>Desconto até o vencimento (%)</label>
                <BillingInputFrame icon={<Percent size={16} />}>
                  <input type="text" inputMode="numeric" placeholder="0,00" value={descontoPercentual} onChange={(event) => setDescontoPercentual(formatPercentInput(event.target.value))} />
                </BillingInputFrame>
              </div>

              <div className="faturamento-form-group">
                <label>Juros ao mês (%)</label>
                <BillingInputFrame icon={<Percent size={16} />}>
                  <input type="text" inputMode="numeric" placeholder="0,00" value={jurosPercentual} onChange={(event) => setJurosPercentual(formatPercentInput(event.target.value))} />
                </BillingInputFrame>
              </div>

              <div className="faturamento-form-group">
                <label>Multa após vencimento (%)</label>
                <BillingInputFrame icon={<Percent size={16} />}>
                  <input type="text" inputMode="numeric" placeholder="0,00" value={multaPercentual} onChange={(event) => setMultaPercentual(formatPercentInput(event.target.value))} />
                </BillingInputFrame>
              </div>

              <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Mensagem no boleto</label>
                <textarea rows={2} maxLength={220} placeholder="Ex: Após o vencimento, cobrar juros e multa conforme contrato." value={mensagemBoleto} onChange={(event) => setMensagemBoleto(event.target.value)} />
              </div>
            </>
          )}
          <RecorrenciaScheduleFields config={schedule} onChange={setSchedule} active={automacaoAtiva} onActiveChange={setAutomacaoAtiva} />
        </fieldset>

        {contractSaved && <p role="status">Contrato salvo. A execução está registrada no histórico e pode ser retomada mesmo após recarregar a página.</p>}
        {errorMsg && <div className="faturamento-error-message">{errorMsg}</div>}

        <div className="faturamento-modal-actions">
          <div />
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="faturamento-btn-primary"
          >
            <Check size={16} /> {isSubmitting ? 'Salvando...' : contractSaved ? 'Retomar primeira cobrança' : 'Salvar Recorrência'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
