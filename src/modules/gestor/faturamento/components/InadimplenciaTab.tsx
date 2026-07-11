
import { MessageCircle, RefreshCw, X } from 'lucide-react';

export const InadimplenciaTab = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="faturamento-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '200px' }}>
            <label>Buscar Parceiro</label>
            <input type="text" placeholder="Nome do parceiro..." />
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Atraso</label>
            <select>
              <option>Todos</option>
              <option>Mais de 5 dias</option>
              <option>Mais de 15 dias</option>
              <option>Mais de 30 dias</option>
            </select>
          </div>
          <button className="faturamento-btn-primary">
            Filtrar
          </button>
      </div>

      <div className="faturamento-card" style={{ padding: 0 }}>
        <div className="faturamento-table-container">
          <table className="faturamento-table">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Valor em Atraso</th>
                <th>Vencimento</th>
                <th>Dias</th>
                <th>Último Contato</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 500, color: '#0f172a' }}>Empresa XYZ</td>
                <td style={{ fontWeight: 600, color: '#ef4444' }}>R$ 2.450,00</td>
                <td>10/06/2026</td>
                <td style={{ fontWeight: 600, color: '#ef4444' }}>28 dias</td>
                <td style={{ color: '#64748b' }}>Sem contato</td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }} title="Registrar Contato"><MessageCircle size={16} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Reenviar Link"><RefreshCw size={16} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Cancelar Cobrança"><X size={16} /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
