
import { Download, ExternalLink } from 'lucide-react';

export const HistoricoFinanceiroTab = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="faturamento-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '16px' }}>
          <div className="faturamento-form-group" style={{ flex: '1', minWidth: '200px' }}>
            <label>Buscar</label>
            <input type="text" placeholder="Parceiro, descrição..." />
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Tipo</label>
            <select>
              <option>Todos</option>
              <option>NFS-e</option>
              <option>Mensalidade</option>
              <option>Avulso</option>
            </select>
          </div>
          <div className="faturamento-form-group" style={{ width: '150px' }}>
            <label>Status Pagamento</label>
            <select>
              <option>Todos</option>
              <option>Pago</option>
              <option>Pendente</option>
              <option>Atrasado</option>
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
                <th>Data</th>
                <th>Parceiro</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>10/07/2026</td>
                <td style={{ fontWeight: 500, color: '#0f172a' }}>Tech Solutions SA</td>
                <td>Honorários - Ref 06/2026</td>
                <td>Mensalidade</td>
                <td style={{ fontWeight: 500 }}>R$ 1.500,00</td>
                <td>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    backgroundColor: '#ecfdf5',
                    color: '#10b981'
                  }}>
                    Pago
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Baixar"><Download size={16} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6' }} title="Abrir Link"><ExternalLink size={16} /></button>
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
