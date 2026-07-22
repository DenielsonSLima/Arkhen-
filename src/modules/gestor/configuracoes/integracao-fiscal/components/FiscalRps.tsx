import React from 'react';
import type { FiscalConfigData } from '../services/fiscalIntegrationService';

interface FiscalRpsProps {
  config: FiscalConfigData;
  setConfig: React.Dispatch<React.SetStateAction<FiscalConfigData>>;
  saving: boolean;
  onSaveConfig: (e?: React.FormEvent) => void;
}

export const FiscalRps: React.FC<FiscalRpsProps> = ({
  config,
  setConfig,
  saving,
  onSaveConfig,
}) => {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSaveConfig(e); }} className="config-form">
      
      {/* Parameters Group */}
      <div className="form-divider-title">Numeração e Série do RPS</div>
      
      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Série do RPS</label>
          <input
            type="text"
            value={config.serieRps}
            onChange={(e) => setConfig(prev => ({ ...prev, serieRps: e.target.value }))}
            disabled={saving}
            placeholder="Ex: RPS"
          />
        </div>

        <div className="form-item-group">
          <label>Último Número do RPS</label>
          <input
            type="text"
            value={config.ultimoNumeroRps}
            onChange={(e) => setConfig(prev => ({ ...prev, ultimoNumeroRps: e.target.value }))}
            disabled={saving}
            placeholder="Ex: 105"
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Próximo Número do RPS</label>
          <input
            type="text"
            value={config.proximoNumeroRps}
            onChange={(e) => setConfig(prev => ({ ...prev, proximoNumeroRps: e.target.value }))}
            disabled={saving}
            placeholder="Ex: 106"
          />
        </div>

        <div className="form-item-group">
          <label>Última NFS-e Emitida</label>
          <input
            type="text"
            value={config.ultimoNumeroNfse}
            onChange={(e) => setConfig(prev => ({ ...prev, ultimoNumeroNfse: e.target.value }))}
            disabled={saving}
            placeholder="Ex: 3042"
          />
        </div>
      </div>

      {/* Tax configuration Group */}
      <div className="form-divider-title">Código de Serviço & Impostos</div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Inscrição Municipal do Prestador</label>
          <input
            type="text"
            value={config.inscricaoMunicipal}
            onChange={(e) => setConfig(prev => ({ ...prev, inscricaoMunicipal: e.target.value }))}
            disabled={saving}
            placeholder="Inscrição no WebISS de Itabaiana"
          />
        </div>
        <div className="form-item-group">
          <label>CNAE do Serviço</label>
          <input
            type="text"
            value={config.codigoCnae}
            onChange={(e) => setConfig(prev => ({ ...prev, codigoCnae: e.target.value }))}
            disabled={saving}
            placeholder="Ex: 6920601"
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-item-group">
          <label>Código do Serviço</label>
          <input
            type="text"
            value={config.codigoServico}
            onChange={(e) => setConfig(prev => ({ ...prev, codigoServico: e.target.value }))}
            disabled={saving}
            placeholder="Ex: 01.07"
          />
        </div>

        <div className="form-item-group">
          <label>Alíquota do ISS (%)</label>
          <input
            type="text"
            value={config.aliquotaIss}
            onChange={(e) => setConfig(prev => ({ ...prev, aliquotaIss: e.target.value }))}
            disabled={saving}
            placeholder="Ex: 2.00"
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-item-group" style={{ gridColumn: 'span 2' }}>
          <label>Item da Lista de Serviço (LC 116/03)</label>
          <input
            type="text"
            value={config.itemListaServico}
            onChange={(e) => setConfig(prev => ({ ...prev, itemListaServico: e.target.value }))}
            disabled={saving}
            placeholder="Ex: 1.07 - Suporte técnico em informática, inclusive instalação..."
          />
        </div>
      </div>

      <div className="form-row-grid" style={{ marginTop: '12px' }}>
        <div className="form-item-group">
          <label>Natureza da Operação</label>
          <select
            value={config.naturezaOperacao}
            onChange={(e) => setConfig(prev => ({ ...prev, naturezaOperacao: e.target.value }))}
            disabled={saving}
          >
            <option value="1 - Tributação no município">1 - Tributação no município</option>
            <option value="2 - Tributação fora do município">2 - Tributação fora do município</option>
            <option value="3 - Isenção">3 - Isenção</option>
            <option value="4 - Imunidade">4 - Imunidade</option>
          </select>
        </div>

        <div className="form-item-group">
          <label>Regime Especial de Tributação</label>
          <select
            value={config.regimeEspecial}
            onChange={(e) => setConfig(prev => ({ ...prev, regimeEspecial: e.target.value }))}
            disabled={saving}
          >
            <option value="1 - Microempresa Municipal">1 - Microempresa Municipal</option>
            <option value="2 - Estimativa">2 - Estimativa</option>
            <option value="3 - Sociedade de Profissionais">3 - Sociedade de Profissionais</option>
            <option value="4 - Simples Nacional">4 - Simples Nacional</option>
          </select>
        </div>
      </div>

      <div className="form-row-grid" style={{ marginTop: '12px' }}>
        <div className="form-item-group">
          <label>Incentivador Cultural</label>
          <select
            value={config.incentivadorCultural}
            onChange={(e) => setConfig(prev => ({ ...prev, incentivadorCultural: e.target.value }))}
            disabled={saving}
          >
            <option value="1 - Sim">1 - Sim</option>
            <option value="2 - Não">2 - Não</option>
          </select>
        </div>

        <div className="form-item-group">
          <label>ISS Retido na Fonte</label>
          <select
            value={config.issRetido}
            onChange={(e) => setConfig(prev => ({ ...prev, issRetido: e.target.value }))}
            disabled={saving}
          >
            <option value="1 - Sim">1 - Sim</option>
            <option value="2 - Não">2 - Não</option>
          </select>
        </div>
      </div>

    </form>
  );
};
