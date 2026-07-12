import React, { useState } from 'react';
import { AlertTriangle, ArrowUpCircle, ArrowDownCircle, Receipt, Building2, FileText, Wallet, TrendingUp, CreditCard, Filter } from 'lucide-react';
import type { DashboardStats } from '../services/financeiroService';
import './CaixaTab.css';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type CaixaTabProps = {
  stats: DashboardStats;
  onFormatCurrency: (value: number) => string;
};

export const CaixaTab: React.FC<CaixaTabProps> = ({ stats, onFormatCurrency }) => {
  const [periodo, setPeriodo] = useState('6');
  const chartData = stats.desempenho.slice(-Number(periodo));
  const contas = stats.contas;
  const receitasPorParceiro = stats.receitasPorParceiro;
  const despesasPorCategoria = stats.despesasPorCategoria;
  const entradasRecentes: { id: string; data: string; descricao: string; valor: number }[] = [];
  const saidasRecentes: { id: string; data: string; descricao: string; valor: number }[] = [];

  const KpiCard = ({ title, value, icon, variant = 'white' }: any) => {
    const isColored = variant !== 'white';
    return (
      <div style={{
        background: variant === 'green' ? '#10b981' : variant === 'purple' ? '#6366f1' : '#ffffff',
        borderRadius: '12px',
        padding: '20px',
        border: isColored ? 'none' : '1px solid #e6edf5',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isColored ? 'rgba(255,255,255,0.2)' : '#f8fafc',
          color: isColored ? '#ffffff' : '#64748b'
        }}>
          {icon}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isColored ? 'rgba(255,255,255,0.9)' : '#8a97aa', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: isColored ? '#ffffff' : '#111827', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </span>
        </div>
      </div>
    );
  };

  const renderBreakdown = (
    items: { id: string | null; nome: string; valor: number; percentual: number }[],
    color: string,
  ) => {
    if (items.length === 0) {
      return <div className="financeiro-empty-state">Nenhum dado no período.</div>;
    }

    return items.map((cat, i) => (
      <div key={`${cat.id || cat.nome}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>{i + 1}. {cat.nome}</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: '0.95rem', fontWeight: 800, color: '#111827' }}>{onFormatCurrency(cat.valor)}</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{cat.percentual}%</span>
          </div>
        </div>
        <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(cat.percentual, 100)}%`, height: '100%', background: color, borderRadius: '99px' }} />
        </div>
      </div>
    ));
  };

  return (
    <div className="financeiro-view-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
            Fluxo de Caixa & Patrimônio
          </h2>
          <p style={{ color: '#667085', margin: 0, fontSize: '0.9rem' }}>
            Consolidação de ativos, passivos, lucros e prestação de contas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2px' }}>
            <Filter size={16} color="#64748b" style={{ marginLeft: '10px', marginRight: '4px' }} />
            <select 
              value={periodo} 
              onChange={(e) => setPeriodo(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', color: '#111827', fontSize: '0.85rem', padding: '8px 12px', cursor: 'pointer', fontWeight: 600 }}
            >
              <option value="1">Mês Atual</option>
              <option value="3">Últimos 3 Meses</option>
              <option value="6">Últimos 6 Meses</option>
              <option value="12">Últimos 12 Meses</option>
            </select>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s' }}>
            <FileText size={16} />
            Relatório PDF
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <KpiCard title="Patrimônio Líquido" value={onFormatCurrency(stats.patrimonioLiquido)} icon={<Wallet size={24} />} variant="purple" />
        <KpiCard title="Saldo Disponível" value={onFormatCurrency(stats.saldoDisponivel)} icon={<Building2 size={24} />} variant="green" />
        <KpiCard title="Contas a Receber" value={onFormatCurrency(stats.contasReceber)} icon={<Receipt size={24} color="#f59e0b" />} />
        <KpiCard title="Contas a Pagar" value={onFormatCurrency(stats.contasPagar)} icon={<CreditCard size={24} color="#ef4444" />} />
        
        <KpiCard title="Lucro do Mês" value={onFormatCurrency(stats.lucroMes)} icon={<TrendingUp size={24} color="#6366f1" />} />
        <KpiCard title="Receitas (Recebidas)" value={onFormatCurrency(stats.receitasRecebidas)} icon={<ArrowUpCircle size={24} color="#10b981" />} />
        <KpiCard title="Despesas (Pagas)" value={onFormatCurrency(stats.despesasPagas)} icon={<ArrowDownCircle size={24} color="#ef4444" />} />
        <KpiCard title="Inadimplência" value={`${stats.taxaInadimplencia.toFixed(1)}%`} icon={<AlertTriangle size={24} color="#f97316" />} />
      </div>

      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
        {/* Chart */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#111827', textTransform: 'uppercase' }}>Desempenho Trimestral</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Histórico de faturamento, despesas e lucro</p>
            </div>
            <div style={{ height: '320px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value / 1000}k`} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ fontWeight: 700 }}
                    formatter={(value: any) => onFormatCurrency(Number(value))}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }} iconType="circle" />
                  <Bar dataKey="receita" name="Receita" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        {/* Saldos Bancários */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#111827', textTransform: 'uppercase' }}>Saldos das Contas</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Disponibilidade por carteira</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {contas.length === 0 && <div className="financeiro-empty-state">Nenhuma conta cadastrada.</div>}
              {contas.map(conta => (
                <div key={conta.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#c59235', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                    {conta.banco.substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', color: '#1e293b', fontSize: '0.9rem', fontWeight: 700 }}>{conta.banco}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Ativa</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ display: 'block', color: '#111827', fontSize: '1rem', fontWeight: 800 }}>
                      {onFormatCurrency(conta.saldo)}
                    </strong>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>Saldo Atual</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '20px', borderTop: '1px dashed #cbd5e1' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Disponibilidade Total</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#6366f1' }}>
                {onFormatCurrency(stats.saldoDisponivel)}
              </span>
            </div>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Receitas por Tipo de Parceiro */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#111827', textTransform: 'uppercase' }}>Receitas por Parceiro</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Maiores fontes de receita do período</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {renderBreakdown(receitasPorParceiro, '#10b981')}
            </div>
          </div>
        {/* Despesas por Categoria */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#111827', textTransform: 'uppercase' }}>Despesas por Categoria</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Maiores ofensores do período selecionado</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {renderBreakdown(despesasPorCategoria, '#ef4444')}
            </div>
          </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Últimas Entradas */}
          <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e6edf5' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>Créditos</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Últimas entradas</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Período</span>
                <strong style={{ display: 'block', fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>{onFormatCurrency(stats.receitasRecebidas)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {entradasRecentes.length === 0 && <div className="financeiro-empty-state">Nenhuma entrada recente.</div>}
              {entradasRecentes.map((mov) => (
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
                <strong style={{ display: 'block', fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>{onFormatCurrency(stats.despesasPagas)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {saidasRecentes.length === 0 && <div className="financeiro-empty-state">Nenhuma saída recente.</div>}
              {saidasRecentes.map((mov) => (
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
      </div>
    </div>
  );
};
