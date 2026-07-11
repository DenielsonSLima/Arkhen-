import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileCode2,
  Landmark,
  PlayCircle,
  ReceiptText,
  Save,
  Send,
  WalletCards,
} from 'lucide-react';
import type { Company } from '../services/gestaoEmpresarialService';
import { protocolosService } from '../../protocolos/services/protocolosService';
import type { ProtocoloEmpresaConfig } from '../../protocolos/services/protocolosService';
import { type TipoFechamentoEntrega } from '../../parametrizacao/prazos-entrega/services/prazosEntregaService';
import { useInternalTabs } from '../../../../hooks/useInternalTabs';
import './TabProtocolosEntregas.css';

interface TabProtocolosEntregasProps {
  company: Company;
}

const categoryIcon = {
  Fiscal: <Landmark size={16} />,
  Contábil: <ClipboardCheck size={16} />,
  Trabalhista: <FileCheck2 size={16} />,
  Financeiro: <WalletCards size={16} />,
  Documentos: <ReceiptText size={16} />,
  'NF-e': <FileCode2 size={16} />,
  'NFC-e': <FileCode2 size={16} />,
};

const periodicidadeOptions: Array<{ value: TipoFechamentoEntrega; label: string }> = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
];

export const TabProtocolosEntregas: React.FC<TabProtocolosEntregasProps> = ({ company }) => {
  const { openTab } = useInternalTabs();
  const catalogo = useMemo(() => protocolosService.getCatalogoPorRegime(company), [company.id, company.tipo]);
  const [configs, setConfigs] = useState<ProtocoloEmpresaConfig[]>(() => protocolosService.getEntregasEmpresaConfig(company));
  const [saved, setSaved] = useState(false);

  const configById = useMemo(() => {
    const map = new Map<string, ProtocoloEmpresaConfig>();
    configs.forEach((item) => map.set(item.entregaId, item));
    return map;
  }, [configs]);

  const groupedCatalogo = useMemo(() => {
    return catalogo.reduce<Record<string, typeof catalogo>>((acc, item) => {
      acc[item.categoria] = [...(acc[item.categoria] || []), item];
      return acc;
    }, {});
  }, [catalogo]);

  const toggleEntrega = (id: string) => {
    setSaved(false);
    setConfigs((current) => current.map((item) => (
      item.entregaId === id ? { ...item, ativo: !item.ativo } : item
    )));
  };

  const handleChangePeriodicidade = (id: string, periodicidade: TipoFechamentoEntrega) => {
    setSaved(false);
    setConfigs((current) => current.map((item) => (
      item.entregaId === id ? { ...item, periodicidade } : item
    )));
  };

  const handleSave = () => {
    protocolosService.saveEntregasEmpresaConfig(company, configs);
    setSaved(true);
  };

  const handleOpenAtividades = () => {
    openTab(
      'atividades-empresa',
      'Atividades por empresa',
      'Building2',
      {
        data: {
          selectedCompanyId: company.id,
        },
      },
    );
  };

  const getEntregaDescricao = (entrega: typeof catalogo[number], config: ProtocoloEmpresaConfig | undefined) => {
    const periodicidade = config?.periodicidade || entrega.periodicidadePadrao;
    const periodicidadeLabel = periodicidadeOptions.find((item) => item.value === periodicidade)?.label || periodicidade;
    const origem = entrega.origemPadrao === 'Ambos'
      ? 'Cliente e Escritório'
      : entrega.origemPadrao === 'Escritório envia'
        ? 'Envio do escritório'
        : 'Envio do cliente';
    const tipo = ['xml-nfe', 'xml-nfce'].includes(entrega.id)
      ? 'XML em lote'
      : ['folha-pagamento', 'notas-fiscais', 'extrato-bancario', 'guias-pagas'].includes(entrega.id)
      ? 'arquivo mensal'
    : 'obrigação/documento';
    return `${origem} • ${tipo} • rotina ${periodicidadeLabel} • prazo dia ${entrega.diaLimite}`;
  };

  return (
    <div className="tab-panel-content protocolos-config-panel">
      <div className="protocolos-config-header">
        <div>
          <h3>Rotinas e obrigações da empresa</h3>
          <p>Defina o que entra por competência, com rotina e origem (cliente, escritório ou ambos).</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn-save-protocolos" onClick={handleOpenAtividades}>
            <PlayCircle size={16} /> Abrir atividades
          </button>
          <button className="btn-save-protocolos" onClick={handleSave} style={{ minWidth: 170 }}>
            {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saved ? 'Salvo' : 'Salvar entregas'}
          </button>
        </div>
      </div>

      <div className="protocolos-config-summary">
        <div>
          <span>Empresa</span>
          <strong>{company.nome}</strong>
        </div>
        <div>
          <span>Itens cobrados</span>
          <strong>{configs.filter((item) => item.ativo).length}</strong>
        </div>
        <div>
          <span>Base</span>
          <strong>Competência + rotina</strong>
        </div>
      </div>

      <div className="protocolos-category-grid">
        {Object.entries(groupedCatalogo).map(([categoria, entregas]) => (
          <section key={categoria} className="protocolos-category-section">
            <div className="protocolos-category-title">
              {categoryIcon[categoria as keyof typeof categoryIcon]}
              <strong>{categoria}</strong>
            </div>
            <div className="protocolos-entregas-list">
              {entregas.map((entrega) => {
                const config = configById.get(entrega.id);
                const checked = config?.ativo ?? false;
                return (
                  <label key={entrega.id} className={`protocolo-entrega-option ${checked ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEntrega(entrega.id)}
                    />
                    <span className="protocolo-option-marker">
                      {checked ? <CheckCircle2 size={16} /> : <Send size={16} />}
                    </span>
                    <span className="protocolo-option-text">
                      <strong>{entrega.nome}</strong>
                      <small>{getEntregaDescricao(entrega, config)}</small>
                    </span>
                    <div className="protocolo-option-periodicidade">
                      <span className="protocolo-option-periodicidade-label">
                        <CalendarClock size={13} />
                        <strong>Rotina</strong>
                      </span>
                      <select
                        value={config?.periodicidade ?? entrega.periodicidadePadrao}
                        disabled={!checked}
                        onChange={(event) => handleChangePeriodicidade(entrega.id, event.target.value as TipoFechamentoEntrega)}
                      >
                        {periodicidadeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
