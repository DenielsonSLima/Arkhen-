import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CalendarDays, Check, FileText, Percent, Repeat, X } from 'lucide-react';
import { gestaoEmpresarialService } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { useCreateCobrancaFinanceiraMutation, useSaveContratoFinanceiroMutation } from '../../financeiro/queries/useFinanceiroQueries';
import {
  BillingClientSelect,
  BillingInputFrame,
  BillingSectionTitle,
  formatCurrencyInput,
  formatPercentInput,
  parseCurrencyInput,
  parsePercentInput,
} from './billingFormUtils';
import { formatLocalISODate } from '../utils/dateUtils';

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
  const saveContratoMutation = useSaveContratoFinanceiroMutation();
  const createCobrancaMutation = useCreateCobrancaFinanceiraMutation();
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

  if (!isOpen) return null;

  const getNextDueDate = (day: number) => {
    const today = new Date();
    const due = new Date(today.getFullYear(), today.getMonth(), Math.min(Math.max(day, 1), 28));
    if (due < today) due.setMonth(due.getMonth() + 1);
    return formatLocalISODate(due);
  };

  const resetForm = () => {
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
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const valor = parseCurrencyInput(valorMensal);
    if (!clienteEmpresaId || valor <= 0) {
      setErrorMsg('Selecione o parceiro e informe um valor mensal válido.');
      return;
    }

    try {
      setErrorMsg(null);
      const contrato = await saveContratoMutation.mutateAsync({
        clienteEmpresaId,
        descricaoServico,
        valorMensal: valor,
        diaVencimento,
        emissaoAutomaticaNfse: false,
        ativo: true,
        gerarCobranca: false,
      });

      if (emitCobranca) {
        await createCobrancaMutation.mutateAsync({
          clienteEmpresaId,
          contratoId: contrato.id,
          valor,
          dataVencimento: getNextDueDate(diaVencimento),
          descricao: descricaoServico,
          categoria: 'Faturamento recorrente',
          meioPagamento,
          descontoPercentual: parsePercentInput(descontoPercentual),
          jurosPercentual: parsePercentInput(jurosPercentual),
          multaPercentual: parsePercentInput(multaPercentual),
          mensagemBoleto: mensagemBoleto.trim(),
        });
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Falha ao salvar recorrência.');
      return;
    }

    handleClose();
  };

  const modalContent = (
    <div className="faturamento-modal-backdrop">
      <div className="faturamento-card faturamento-charge-modal">
        <div className="faturamento-modal-header">
          <div className="faturamento-modal-title-wrap">
            <span className="faturamento-modal-title-icon">
              <Repeat size={20} />
            </span>
            <div>
              <h2>Nova recorrência</h2>
              <p>Contrato mensal com padrão de cobrança e regras Asaas.</p>
            </div>
          </div>
          <button onClick={handleClose} className="faturamento-modal-close" title="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="faturamento-charge-form">
          <BillingSectionTitle title="Cliente e mensalidade" description="Dados fixos que orientam a emissão recorrente." />

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
                placeholder="R$ 0,00"
                value={valorMensal}
                onChange={(event) => setValorMensal(formatCurrencyInput(event.target.value))}
              />
            </BillingInputFrame>
          </div>

          <div className="faturamento-form-group">
            <label>Dia de Vencimento/Emissão</label>
            <BillingInputFrame icon={
              <CalendarDays size={16} />
            }>
              <select value={diaVencimento} onChange={(event) => setDiaVencimento(Number(event.target.value))}>
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

          <BillingSectionTitle title="Automação Asaas" description="Primeira cobrança e padrão financeiro da recorrência." />

          <label className="faturamento-switch-row" style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={emitCobranca} onChange={(e) => setEmitCobranca(e.target.checked)} />
            <span>
              <strong>Gerar primeira cobrança automaticamente</strong>
              <small>Cria uma cobrança no Asaas com o próximo vencimento calculado.</small>
            </span>
          </label>

          {emitCobranca && (
            <>
              <div className="faturamento-form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Forma de Pagamento Padrão</label>
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
        </div>

        {errorMsg && <div className="faturamento-error-message">{errorMsg}</div>}

        <div className="faturamento-modal-actions">
          <div />
          <button
            onClick={() => void handleSubmit()}
            disabled={saveContratoMutation.isPending || createCobrancaMutation.isPending}
            className="faturamento-btn-primary"
          >
            <Check size={16} /> {saveContratoMutation.isPending || createCobrancaMutation.isPending ? 'Salvando...' : 'Salvar Recorrência'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
