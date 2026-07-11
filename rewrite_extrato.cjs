const fs = require('fs');

let content = fs.readFileSync('src/modules/gestor/financeiro/components/CaixaTab.tsx', 'utf-8');

const parts = content.split('{/* Extrato Recente */}');

const newExtratoCode = `
          {/* Últimas Entradas */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Créditos</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Últimas entradas</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Período</span>
                <strong style={{ display: 'block', fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>{onFormatCurrency(mockExtrato.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0))}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mockExtrato.filter(m => m.tipo === 'entrada').map((mov) => (
                <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ 
                      width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#ecfdf5', color: '#10b981'
                    }}>
                      <ArrowUpCircle size={16} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#1e293b', fontSize: '0.85rem', fontWeight: 700 }}>{mov.descricao}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>{new Date(mov.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <strong style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 800 }}>
                    + {onFormatCurrency(mov.valor)}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Últimas Saídas */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase' }}>Débitos</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Últimas saídas</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Período</span>
                <strong style={{ display: 'block', fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>{onFormatCurrency(mockExtrato.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0))}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mockExtrato.filter(m => m.tipo === 'saida').map((mov) => (
                <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ 
                      width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#fef2f2', color: '#ef4444'
                    }}>
                      <ArrowDownCircle size={16} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#1e293b', fontSize: '0.85rem', fontWeight: 700 }}>{mov.descricao}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>{new Date(mov.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <strong style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 800 }}>
                    - {onFormatCurrency(mov.valor)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
`;

content = parts[0] + newExtratoCode + '\n        </div>\n\n      </div>\n    </div>\n  );\n};\n';

fs.writeFileSync('src/modules/gestor/financeiro/components/CaixaTab.tsx', content);
