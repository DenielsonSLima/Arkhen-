import React from 'react';
import { ArrowRight, CalendarClock, ClipboardList, UserRoundX } from 'lucide-react';
import type { ClienteEmpresa } from '../../services/atividadesService';
import type { RotinaCompanyGroup } from '../../utils/rotinasWorkspace';
import { CompanyCardIdentity } from '../../por-empresa/CompanyCardIdentity';

interface RotinasCompanyGridProps {
  groups: RotinaCompanyGroup<ClienteEmpresa>[];
  onOpenCompany: (companyId: string) => void;
}

const formatDate = (value?: string) => {
  if (!value) return 'Sem agenda';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
};

export const RotinasCompanyGrid: React.FC<RotinasCompanyGridProps> = ({ groups, onOpenCompany }) => {
  if (groups.length === 0) {
    return (
      <div className="rotinas-empty">
        <ClipboardList size={34} />
        <h3>Nenhuma empresa disponível</h3>
        <p>Cadastre um parceiro do tipo cliente contábil para organizar suas rotinas.</p>
      </div>
    );
  }

  return (
    <div className="rotinas-company-grid">
      {groups.map((group) => (
        <article
          key={group.cliente.id}
          className="rotinas-company-card"
          role="button"
          tabIndex={0}
          onClick={() => onOpenCompany(group.cliente.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenCompany(group.cliente.id);
            }
          }}
        >
          <CompanyCardIdentity
            name={group.cliente.nome}
            cnpj={group.cliente.cnpj}
            regime={group.cliente.regime}
            tipoEstabelecimento={group.cliente.tipoEstabelecimento}
            logo={group.cliente.logo}
          />

          <div className="rotinas-company-card__metrics">
            <div className="rotinas-metric">
              <span><ClipboardList size={12} /> Rotinas ativas</span>
              <strong>{group.totalRotinas}</strong>
            </div>
            <div className="rotinas-metric">
              <span><UserRoundX size={12} /> Sem responsável</span>
              <strong>{group.semResponsavel}</strong>
            </div>
            <div className="rotinas-metric" style={{ gridColumn: '1 / -1' }}>
              <span><CalendarClock size={12} /> Próxima execução</span>
              <strong>{formatDate(group.proximaExecucao)}</strong>
            </div>
          </div>

          <span className="rotinas-company-card__footer">
            Ver rotinas da empresa <ArrowRight size={15} />
          </span>
        </article>
      ))}
    </div>
  );
};
