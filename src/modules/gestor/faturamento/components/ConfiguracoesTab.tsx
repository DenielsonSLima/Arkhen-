import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Building2, CheckCircle2, FileText, Receipt, Save } from 'lucide-react';
import { useEmpresa } from '../../configuracoes/empresa/hooks/useEmpresa';
import {
  faturamentoParametrosPadrao,
  type FaturamentoParametros,
} from '../services/faturamentoService';
import {
  useFaturamentoParametrosQuery,
  useSaveFaturamentoParametrosMutation,
} from '../queries/useFaturamentoQueries';

const clampPercentage = (value: string) => Math.min(100, Math.max(0, Number(value) || 0));

export const ConfiguracoesTab = () => {
  const { dados, isLoading: isLoadingEmpresa } = useEmpresa();
  const parametrosQuery = useFaturamentoParametrosQuery();
  const saveMutation = useSaveFaturamentoParametrosMutation();
  const [form, setForm] = useState<FaturamentoParametros>(faturamentoParametrosPadrao);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (parametrosQuery.data) setForm(parametrosQuery.data);
  }, [parametrosQuery.data]);

  const update = <K extends keyof FaturamentoParametros>(key: K, value: FaturamentoParametros[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    try {
      const result = await saveMutation.mutateAsync(form);
      setForm(result);
      setSaved(true);
    } catch {
      // A mensagem segura da mutation é exibida abaixo do formulário.
    }
  };

  if (isLoadingEmpresa || parametrosQuery.isLoading) {
    return <div style={{ padding: '24px' }}>Carregando configurações...</div>;
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Configurações de Faturamento</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Defina padrões para NFS-e, serviços e cobranças recorrentes.</p>
        </div>
        <button type="submit" className="faturamento-btn-primary" disabled={saveMutation.isPending}>
          <Save size={16} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>

      {parametrosQuery.isError && (
        <div className="faturamento-list-feedback error" role="alert">
          <AlertCircle size={18} /> {parametrosQuery.error.message}
        </div>
      )}
      {saveMutation.isError && (
        <div className="faturamento-list-feedback error" role="alert">
          <AlertCircle size={18} /> {saveMutation.error.message}
        </div>
      )}
      {saved && (
        <div className="faturamento-list-feedback success" role="status">
          <CheckCircle2 size={18} /> Configurações salvas para esta empresa.
        </div>
      )}

      <div className="faturamento-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <Building2 size={18} color="#3b82f6" /> Identidade Visual
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
            {dados?.logoUrl ? <img src={dados.logoUrl} alt="Logo Empresa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '12px' }}>Nenhuma logo cadastrada</span>}
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0f172a' }}>Logo nos Recibos e Cobranças</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', maxWidth: '400px' }}>A logo é gerenciada em <strong>Configurações da Empresa</strong> e usada nos recibos e e-mails de cobrança.</p>
          </div>
        </div>
      </div>

      <div className="faturamento-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <Receipt size={18} color="#10b981" /> Padrões de Impostos e NFS-e
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div className="faturamento-form-group">
            <label htmlFor="codigo-servico-nfse">Código de Serviço Padrão (NFS-e)</label>
            <select id="codigo-servico-nfse" value={form.codigoServicoNfse} onChange={(event) => update('codigoServicoNfse', event.target.value)}>
              <option value="17.19">17.19 - Contabilidade, inclusive serviços técnicos e auxiliares</option>
              <option value="17.20">17.20 - Consultoria e assessoria econômica ou financeira</option>
              <option value="17.18">17.18 - Advocacia</option>
            </select>
          </div>
          <div className="faturamento-form-group">
            <label htmlFor="aliquota-iss">Alíquota ISS Padrão (%)</label>
            <input id="aliquota-iss" type="number" min="0" max="100" value={form.aliquotaIss} step="0.01" onChange={(event) => update('aliquotaIss', clampPercentage(event.target.value))} />
          </div>
          <div className="faturamento-form-group">
            <label htmlFor="retencao-inss">Retenção INSS Padrão (%)</label>
            <input id="retencao-inss" type="number" min="0" max="100" value={form.retencaoInss} step="0.01" onChange={(event) => update('retencaoInss', clampPercentage(event.target.value))} />
          </div>
          <div className="faturamento-form-group">
            <label htmlFor="regime-tributacao">Regime de Tributação</label>
            <select id="regime-tributacao" value={form.regimeTributacao} onChange={(event) => update('regimeTributacao', event.target.value as FaturamentoParametros['regimeTributacao'])}>
              <option value="simples">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
        </div>
      </div>

      <div className="faturamento-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <FileText size={18} color="#f59e0b" /> Textos e Observações
        </h3>
        <div className="faturamento-form-group" style={{ margin: 0 }}>
          <label htmlFor="observacao-nfse">Observação Padrão na NFS-e</label>
          <textarea id="observacao-nfse" rows={3} maxLength={2000} value={form.observacaoNfse} onChange={(event) => update('observacaoNfse', event.target.value)} />
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>Variáveis suportadas: <code>[MES_ATUAL]</code>, <code>[ANO_ATUAL]</code>, <code>[TRIBUTOS_APROX]</code>, <code>[NOME_CLIENTE]</code>.</p>
        </div>
        <div className="faturamento-form-group" style={{ margin: '8px 0 0' }}>
          <label htmlFor="mensagem-email-cobranca">Mensagem Padrão no E-mail de Cobrança (Recorrências)</label>
          <textarea id="mensagem-email-cobranca" rows={4} maxLength={3000} value={form.mensagemEmailCobranca} onChange={(event) => update('mensagemEmailCobranca', event.target.value)} />
          <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>Variáveis suportadas: <code>[NOME_CLIENTE]</code>, <code>[MES_ATUAL]</code>, <code>[DATA_VENCIMENTO]</code>, <code>[VALOR]</code>, <code>[LINK_BOLETO]</code>.</p>
        </div>
      </div>
    </form>
  );
};
