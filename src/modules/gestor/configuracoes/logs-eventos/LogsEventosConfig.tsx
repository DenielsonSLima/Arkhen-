import React, { useState } from 'react';
import { useLogsEventos } from './hooks/useLogsEventos';
import { Search, AlertCircle, CheckCircle, Info } from 'lucide-react';

export const LogsEventosConfig: React.FC = () => {
  const { logs, isLoading } = useLogsEventos();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModulo, setSelectedModulo] = useState('Todos');
  const [selectedTipo, setSelectedTipo] = useState('Todos');

  if (isLoading) {
    return <div className="sub-loading">Carregando logs de eventos...</div>;
  }

  // Get unique modules for filters
  const modulos = ['Todos', ...Array.from(new Set(logs.map(log => log.modulo)))];

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.acao.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesModulo = selectedModulo === 'Todos' || log.modulo === selectedModulo;
    const matchesTipo = selectedTipo === 'Todos' || log.tipo === selectedTipo;

    return matchesSearch && matchesModulo && matchesTipo;
  });

  return (
    <div className="submodule-content-card animate-fade-in">
      <div className="submodule-card-header" style={{ marginBottom: '20px' }}>
        <h2>Logs de Auditoria e Eventos</h2>
        <p>Acompanhe o registro de auditoria completo de ações realizadas por usuários e processos automatizados do sistema.</p>
      </div>

      {/* Advanced Filters Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '20px',
        backgroundColor: '#f8fafc',
        padding: '16px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ flex: '2', minWidth: '240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input 
            type="text" 
            placeholder="Buscar por usuário ou ação..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '10px 12px 10px 36px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              width: '100%',
              backgroundColor: '#ffffff', // Rule INPUT_LEGIBILITY: light background
              color: '#111827', // Rule INPUT_LEGIBILITY: dark text
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ flex: '1', minWidth: '150px' }}>
          <select
            value={selectedModulo}
            onChange={(e) => setSelectedModulo(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              width: '100%',
              backgroundColor: '#ffffff',
              color: '#111827',
              cursor: 'pointer'
            }}
          >
            <option value="Todos">Filtrar por Módulo</option>
            {modulos.filter(m => m !== 'Todos').map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '150px' }}>
          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              width: '100%',
              backgroundColor: '#ffffff',
              color: '#111827',
              cursor: 'pointer'
            }}
          >
            <option value="Todos">Filtrar por Severidade</option>
            <option value="Sucesso">Sucesso (Verde)</option>
            <option value="Alerta">Alerta (Laranja/Vermelho)</option>
            <option value="Info">Informação (Azul)</option>
          </select>
        </div>

        {(searchTerm || selectedModulo !== 'Todos' || selectedTipo !== 'Todos') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedModulo('Todos');
              setSelectedTipo('Todos');
            }}
            style={{
              padding: '10px 16px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Results summary */}
      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Exibindo {filteredLogs.length} de {logs.length} registros de auditoria
      </div>

      <div className="table-responsive">
        <table className="config-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Tipo</th>
              <th style={{ width: '180px' }}>Usuário</th>
              <th>Ação</th>
              <th style={{ width: '140px' }}>Módulo</th>
              <th style={{ width: '120px' }}>Endereço IP</th>
              <th style={{ width: '150px' }}>Horário</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                let badgeStyle = { backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }; // Info default
                let icon = <Info size={12} />;

                if (log.tipo === 'Sucesso') {
                  badgeStyle = { backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' };
                  icon = <CheckCircle size={12} />;
                } else if (log.tipo === 'Alerta') {
                  badgeStyle = { backgroundColor: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2' };
                  icon = <AlertCircle size={12} />;
                }

                return (
                  <tr key={log.id} style={{ transition: 'background-color 0.1s' }} className="hover:bg-slate-50/50">
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '12px',
                        ...badgeStyle
                      }}>
                        {icon}
                        {log.tipo}
                      </span>
                    </td>
                    <td><strong>{log.usuario}</strong></td>
                    <td style={{ color: '#334155' }}>{log.acao}</td>
                    <td>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {log.modulo}
                      </span>
                    </td>
                    <td><code className="ip-code" style={{ fontFamily: 'monospace', fontSize: '0.75rem', backgroundColor: '#f8fafc', padding: '2px 4px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{log.ipAddress}</code></td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{log.horario}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '0.85rem' }}>
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
