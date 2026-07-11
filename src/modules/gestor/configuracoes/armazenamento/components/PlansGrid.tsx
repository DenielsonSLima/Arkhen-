import React from 'react';
import { Building2, CheckCircle2, HardDrive, Info } from 'lucide-react';
import { PLANOS_CONTRATACAO, type PlanoContratacao, type PlanoContratacaoId } from '../services/planosContratacaoService';
import { formatCurrency } from '../utils/storagePresentation';

interface PlansGridProps {
  planoAtualId: PlanoContratacaoId;
  savingPlanId?: PlanoContratacaoId;
  onSelectPlan: (plano: PlanoContratacao) => void;
}

export const PlansGrid: React.FC<PlansGridProps> = ({
  planoAtualId,
  savingPlanId,
  onSelectPlan,
}) => (
  <div className="arm-planos-section">
    <div className="arm-planos-section-header">
      <h2 className="arm-section-title" style={{ margin: 0 }}>Planos disponíveis</h2>
      <p className="arm-planos-section-desc">
        O plano controla armazenamento total e quantidade de empresas cadastradas. A empresa atual foi colocada
        no plano Máximo por padrão.
      </p>
    </div>

    <div className="arm-planos-grid">
      {PLANOS_CONTRATACAO.map((plano) => {
        const isCurrent = plano.id === planoAtualId;
        return (
          <div key={plano.id} className={`arm-plano-card ${plano.destaque ? 'destaque' : ''} ${isCurrent ? 'atual' : ''}`}>
            <div className={`arm-plano-badge ${plano.destaque ? '' : 'soft'}`}>
              {isCurrent ? 'Plano atual' : plano.selo}
            </div>

            <div className="arm-plano-top">
              <span className="arm-plano-nome">{plano.nome}</span>
              <div className="arm-plano-limits">
                <div>
                  <HardDrive size={17} />
                  <span className="arm-plano-field-label">Armazenamento</span>
                  <strong>{plano.armazenamentoGb} GB</strong>
                </div>
                <div>
                  <Building2 size={17} />
                  <span className="arm-plano-field-label">Empresas</span>
                  <strong>Até {plano.empresas}</strong>
                </div>
              </div>
              <div className="arm-plano-price-single">
                <span>{formatCurrency(plano.precoMensal)}</span>
                <small>{plano.precoMensal === 0 ? 'plano de teste' : '/mês'}</small>
              </div>
            </div>

            <p className="arm-plano-desc">{plano.descricao}</p>
            <ul className="arm-plano-features">
              <li><CheckCircle2 size={15} /> Todos os módulos inclusos</li>
              <li><CheckCircle2 size={15} /> Limite aplicado aos uploads</li>
              <li><CheckCircle2 size={15} /> Dados isolados por empresa</li>
            </ul>

            <button
              className={`arm-plano-btn ${plano.destaque ? 'destaque' : ''}`}
              disabled={isCurrent || savingPlanId === plano.id}
              onClick={() => onSelectPlan(plano)}
            >
              {isCurrent ? 'Plano atual' : savingPlanId === plano.id ? 'Aplicando...' : 'Selecionar plano'}
            </button>
          </div>
        );
      })}
    </div>

    <div className="arm-planos-info">
      <Info size={15} />
      <span>
        Os valores são mensais: Standard R$ 249,90 com 10 GB e 20 empresas; Growth R$ 379,90
        com 25 GB e 40 empresas; Máximo R$ 459,90 com 50 GB e 100 empresas.
      </span>
    </div>
  </div>
);
