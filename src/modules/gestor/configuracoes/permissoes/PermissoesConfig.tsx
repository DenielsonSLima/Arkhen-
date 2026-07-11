import React, { useMemo, useState } from 'react';
import { Check, Lock, ShieldCheck } from 'lucide-react';
import { usePerfisAcessoQuery } from '../perfis/queries/usePerfisQueries';
import { permissoesCatalog } from '../perfis/services/permissoesCatalog';

export const PermissoesConfig: React.FC = () => {
  const { data: perfis = [], isLoading, error } = usePerfisAcessoQuery();
  const [selectedPerfilId, setSelectedPerfilId] = useState<string | null>(null);

  const selectedPerfil = useMemo(() => {
    return perfis.find((perfil) => perfil.id === selectedPerfilId) || perfis[0] || null;
  }, [perfis, selectedPerfilId]);

  const grouped = useMemo(() => {
    return permissoesCatalog.reduce<Record<string, typeof permissoesCatalog>>((acc, item) => {
      acc[item.grupo] = acc[item.grupo] || [];
      acc[item.grupo].push(item);
      return acc;
    }, {});
  }, []);

  if (isLoading) {
    return <div className="sub-loading">Carregando matriz de permissões no Supabase...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Permissões e Privilégios</h2>
          <p>Consulte quais ações cada perfil pode executar. A matriz vem dos perfis de acesso salvos no Supabase.</p>
        </div>
      </div>

      {error && <div className="error-banner">Erro ao carregar permissões no Supabase.</div>}

      <div className="permissoes-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', marginTop: '20px' }}>
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
          <h4 style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>
            Perfis
          </h4>
          {perfis.map((perfil) => {
            const isSelected = selectedPerfil?.id === perfil.id;
            return (
              <button
                key={perfil.id}
                onClick={() => setSelectedPerfilId(perfil.id)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isSelected ? 'rgba(197, 146, 53, 0.05)' : '#ffffff',
                  border: isSelected ? '1px solid var(--color-gold-primary)' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: isSelected ? '#1e293b' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 700 : 500,
                  justifyContent: 'space-between',
                  padding: '12px',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span>{perfil.nome}</span>
                {isSelected && <Check size={14} style={{ color: 'var(--color-gold-primary)' }} />}
              </button>
            );
          })}
        </div>

        <div>
          {selectedPerfil && (
            <div style={{ alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', gap: '12px', marginBottom: '20px', padding: '20px' }}>
              <ShieldCheck size={32} style={{ color: 'var(--color-gold-primary)', flexShrink: 0 }} />
              <div>
                <h4 style={{ color: '#1e293b', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                  Privilégios de <strong style={{ color: 'var(--color-gold-dark)' }}>{selectedPerfil.nome}</strong>
                </h4>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  {selectedPerfil.permissoes.length} permissões ativas para este perfil.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {Object.entries(grouped).map(([grupo, items]) => (
              <div key={grupo} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.85rem', fontWeight: 700, padding: '12px 16px' }}>
                  {grupo}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                  {items.map((item) => {
                    const active = selectedPerfil?.permissoes.includes(item.chave) || false;
                    return (
                      <div key={item.chave} style={{ alignItems: 'center', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '10px', padding: '12px 16px' }}>
                        <span style={{
                          alignItems: 'center',
                          backgroundColor: active ? '#f0fdf4' : '#f8fafc',
                          border: active ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          borderRadius: '999px',
                          color: active ? '#15803d' : '#94a3b8',
                          display: 'flex',
                          height: '24px',
                          justifyContent: 'center',
                          width: '24px',
                        }}>
                          {active ? <Check size={14} /> : <Lock size={13} />}
                        </span>
                        <span style={{ color: active ? '#1e293b' : '#94a3b8', fontSize: '0.8rem', fontWeight: active ? 600 : 500 }}>
                          {item.nome}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
