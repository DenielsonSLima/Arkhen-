import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Layers3, RotateCcw, Save } from 'lucide-react';
import {
  prazosEntregaKeys,
  prazosEntregaService,
  type PrazoEntregaConfig,
  type RegimeEmpresa,
  type TipoFechamentoEntrega,
} from './services/prazosEntregaService';
import './PrazosEntrega.css';

export const PrazosEntregaPage: React.FC = () => {
  const regimes = useMemo(() => prazosEntregaService.getRegimes(), []);
  const queryClient = useQueryClient();
  const prazosQuery = useQuery({
    queryKey: prazosEntregaKeys.all,
    queryFn: prazosEntregaService.listConfiguracoes,
    staleTime: 5 * 60 * 1000,
  });
  const saveMutation = useMutation({
    mutationFn: (items: PrazoEntregaConfig[]) => prazosEntregaService.persistConfiguracoes(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: prazosEntregaKeys.all }),
  });
  const resetMutation = useMutation({
    mutationFn: prazosEntregaService.restoreDefaults,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: prazosEntregaKeys.all }),
  });
  const [activeRegime, setActiveRegime] = useState<RegimeEmpresa>('Lucro Real');
  const [configuracoes, setConfiguracoes] = useState<PrazoEntregaConfig[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (prazosQuery.data) {
      setConfiguracoes(prazosQuery.data);
    }
  }, [prazosQuery.data]);

  const activeItems = useMemo(() => (
    configuracoes.filter((item) => item.regime === activeRegime)
  ), [activeRegime, configuracoes]);

  const regimeStats = useMemo(() => (
    regimes.map((regime) => {
      const items = configuracoes.filter((item) => item.regime === regime);
      return {
        regime,
        total: items.length,
        ativos: items.filter((item) => item.ativo).length,
        categorias: new Set(items.map((item) => item.categoria)).size,
      };
    })
  ), [configuracoes, regimes]);

  const activeStats = useMemo(() => {
    const categorias = Array.from(new Set(activeItems.map((item) => item.categoria)));
    const quinzenais = activeItems.filter((item) => item.fechamento === 'quinzenal').length;
    return {
      total: activeItems.length,
      ativos: activeItems.filter((item) => item.ativo).length,
      categorias,
      quinzenais,
    };
  }, [activeItems]);

  const updateItem = (id: string, updates: Partial<PrazoEntregaConfig>) => {
    setConfiguracoes((prev) => prev.map((item) => (
      item.id === id ? { ...item, ...updates } : item
    )));
  };

  const handleSave = async () => {
    setErrorMsg('');
    try {
      const saved = await saveMutation.mutateAsync(configuracoes);
      setConfiguracoes(saved);
      setSuccessMsg('Prazos de entrega salvos com sucesso.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar prazos no Supabase.');
    }
  };

  const handleReset = async () => {
    setErrorMsg('');
    try {
      const restored = await resetMutation.mutateAsync();
      setConfiguracoes(restored);
      setSuccessMsg('Prazos restaurados para o padrão.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao restaurar prazos no Supabase.');
    }
  };

  const isSaving = saveMutation.isPending || resetMutation.isPending;

  return (
    <div className="submodule-content-card prazos-entrega-page animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Obrigações</h2>
          <p>Configure obrigações, vencimentos, competência de referência e fechamento por tipo de empresa.</p>
        </div>
        <div className="tab-buttons-header">
          <button className="btn-cancel" onClick={handleReset} disabled={isSaving}>
            <RotateCcw size={15} /> Restaurar
          </button>
          <button className="btn-add-user" onClick={handleSave} disabled={isSaving}>
            <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {successMsg && <div className="success-banner animate-fade-in" style={{ marginTop: 12 }}>{successMsg}</div>}
      {(errorMsg || prazosQuery.error) && (
        <div className="form-alert-banner error" style={{ marginTop: 12 }}>
          {errorMsg || 'Erro ao carregar prazos no Supabase.'}
        </div>
      )}

      <div className="prazos-regime-tabs" aria-label="Tipo de empresa">
        {regimeStats.map((item) => (
          <button
            key={item.regime}
            className={`btn-tab ${activeRegime === item.regime ? 'active' : ''}`}
            onClick={() => setActiveRegime(item.regime)}
          >
            <CalendarClock size={16} />
            {item.regime}
            <span className="prazos-tab-count">{item.total}</span>
          </button>
        ))}
      </div>

      <div className="prazos-regime-context">
        <div>
          <span>Regime selecionado</span>
          <h3>{activeRegime}</h3>
          <p>{activeStats.categorias.join(' · ') || 'Nenhuma categoria aplicada'}</p>
        </div>
        <div className="prazos-context-metrics">
          <article>
            <Layers3 size={16} />
            <span>Obrigações</span>
            <strong>{activeStats.total}</strong>
          </article>
          <article>
            <CheckCircle2 size={16} />
            <span>Ativas</span>
            <strong>{activeStats.ativos}</strong>
          </article>
          <article>
            <CalendarClock size={16} />
            <span>Quinzenais</span>
            <strong>{activeStats.quinzenais}</strong>
          </article>
        </div>
      </div>

      <div className="prazos-note">
        <strong>Referência do mês anterior</strong>
        <span>Quando uma entrega vence em 05/05, o protocolo exibe a competência de abril. No modo quinzenal, a empresa pode antecipar a 1ª quinzena e fechar o restante no vencimento final.</span>
      </div>

      <div className="table-responsive">
        <table className="config-table prazos-table">
          <thead>
            <tr>
              <th>Entrega</th>
              <th>Categoria</th>
              <th>Dia venc.</th>
              <th>Referência</th>
              <th>Fechamento</th>
              <th>1ª quinzena</th>
              <th>2ª quinzena</th>
              <th>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {prazosQuery.isLoading ? (
              <tr>
                <td colSpan={8}>
                  <div className="prazos-empty-state">
                    Carregando prazos no Supabase...
                  </div>
                </td>
              </tr>
            ) : activeItems.length ? activeItems.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.entregaNome}</strong></td>
                <td><span className="table-badge badge-orange">{item.categoria}</span></td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={item.diaVencimento}
                    onChange={(event) => updateItem(item.id, { diaVencimento: Number(event.target.value) })}
                  />
                </td>
                <td>
                  <label className="prazos-check">
                    <input
                      type="checkbox"
                      checked={item.referenciaMesAnterior}
                      onChange={(event) => updateItem(item.id, { referenciaMesAnterior: event.target.checked })}
                    />
                    Mês anterior
                  </label>
                </td>
                <td>
                  <select
                    value={item.fechamento}
                    onChange={(event) => updateItem(item.id, { fechamento: event.target.value as TipoFechamentoEntrega })}
                  >
                    <option value="mensal">Mensal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={item.diaVencimentoPrimeiraQuinzena}
                    disabled={item.fechamento !== 'quinzenal'}
                    onChange={(event) => updateItem(item.id, { diaVencimentoPrimeiraQuinzena: Number(event.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={item.diaVencimentoSegundaQuinzena}
                    disabled={item.fechamento !== 'quinzenal'}
                    onChange={(event) => updateItem(item.id, { diaVencimentoSegundaQuinzena: Number(event.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.ativo}
                    onChange={(event) => updateItem(item.id, { ativo: event.target.checked })}
                  />
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8}>
                  <div className="prazos-empty-state">
                    Nenhuma obrigação aplicada para {activeRegime}.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
