import { AlertCircle, Building2, Receipt, FileText } from 'lucide-react';
import { useEmpresa } from '../../configuracoes/empresa/hooks/useEmpresa';

export const ConfiguracoesTab = () => {
  const { dados, isLoading } = useEmpresa();

  if (isLoading) {
    return <div style={{ padding: '24px' }}>Carregando configurações...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>Configurações de Faturamento</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Defina padrões para NFS-e, serviços e cobranças recorrentes.</p>
        </div>
      </div>

      <div role="status" style={{ backgroundColor: '#fffbeb', color: '#92400e', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 500 }}>
        <AlertCircle size={18} /> Visualização somente leitura. A persistência desses padrões ainda depende do serviço de configuração fiscal.
      </div>

      <div className="faturamento-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <Building2 size={18} color="#3b82f6" /> Identidade Visual
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
            {dados?.logoUrl ? (
              <img src={dados.logoUrl} alt="Logo Empresa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '12px' }}>Nenhuma logo cadastrada</span>
            )}
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#0f172a' }}>Logo nos Recibos e Cobranças</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b', maxWidth: '400px' }}>
              A logo exibida aqui é gerenciada em <strong>Configurações da Empresa</strong>. Ela será utilizada nos recibos e e-mails de cobrança enviados aos seus clientes.
            </p>
          </div>
        </div>
      </div>

      <div className="faturamento-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <Receipt size={18} color="#10b981" /> Padrões de Impostos e NFS-e
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="faturamento-form-group">
            <label>Código de Serviço Padrão (NFS-e)</label>
            <select defaultValue="17.19" disabled>
              <option value="17.19">17.19 - Contabilidade, inclusive serviços técnicos e auxiliares</option>
              <option value="17.20">17.20 - Consultoria e assessoria econômica ou financeira</option>
              <option value="17.18">17.18 - Advocacia</option>
            </select>
          </div>
          <div className="faturamento-form-group">
            <label>Alíquota ISS Padrão (%)</label>
            <input type="number" defaultValue="2.00" step="0.01" disabled />
          </div>
          <div className="faturamento-form-group">
            <label>Retenção INSS Padrão (%)</label>
            <input type="number" defaultValue="0.00" step="0.01" disabled />
          </div>
          <div className="faturamento-form-group">
            <label>Regime de Tributação</label>
            <select defaultValue="simples" disabled>
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
          <label>Observação Padrão na NFS-e</label>
          <textarea rows={3} defaultValue="Referente a prestação de serviços do mês [MES_ATUAL]. Valor aproximado dos tributos: [TRIBUTOS_APROX]." disabled />
          <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            Variáveis suportadas: <code>[MES_ATUAL]</code>, <code>[ANO_ATUAL]</code>, <code>[TRIBUTOS_APROX]</code>, <code>[NOME_CLIENTE]</code>.
          </p>
        </div>

        <div className="faturamento-form-group" style={{ margin: 0, marginTop: '8px' }}>
          <label>Mensagem Padrão no E-mail de Cobrança (Recorrências)</label>
          <textarea rows={4} defaultValue="Olá [NOME_CLIENTE], a fatura referente aos serviços de [MES_ATUAL] está disponível. O vencimento será em [DATA_VENCIMENTO]." disabled />
          <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            Variáveis suportadas: <code>[NOME_CLIENTE]</code>, <code>[MES_ATUAL]</code>, <code>[DATA_VENCIMENTO]</code>, <code>[VALOR]</code>, <code>[LINK_BOLETO]</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
