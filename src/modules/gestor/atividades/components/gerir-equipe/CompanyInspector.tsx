import React from 'react';
import { BriefcaseBusiness, Eye } from 'lucide-react';
import type { CompanyInspectorProps } from './types';
import { styles } from './styles';
import { EmptyState } from './EmptyState';
import { ProgressBar } from './ProgressBar';

export const CompanyInspector: React.FC<CompanyInspectorProps> = ({
  handleToggleStep,
  selectedCompany,
  setSelectedCompanyId,
  userCompanyGroups,
}) => (
  <div style={styles.inspectorGrid}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {userCompanyGroups.length === 0 ? (
        <EmptyState icon={<BriefcaseBusiness size={36} color="var(--color-gold-primary)" />} text="Nenhuma empresa vinculada para este colaborador." />
      ) : (
        userCompanyGroups.map((group) => (
          <article
            key={group.id}
            style={{
              ...styles.taskCard,
              borderColor: selectedCompany?.id === group.id ? 'rgba(197, 146, 53, 0.75)' : '#e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{group.clienteNome}</h4>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{group.cnpj} • {group.competencia}</span>
              </div>
              <button onClick={() => setSelectedCompanyId(group.id)} style={styles.openBtn} type="button">
                <Eye size={14} /> Abrir
              </button>
            </div>
            <ProgressBar value={group.progressoGeral} />
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>
              {group.statusGeral} • {group.progressoGeral}% concluído
            </span>
          </article>
        ))
      )}
    </div>

    <aside style={styles.detailPanel}>
      {selectedCompany ? (
        <>
          <div>
            <span style={styles.detailEyebrow}>Fiscalização por empresa</span>
            <h3 style={styles.detailTitle}>{selectedCompany.clienteNome}</h3>
            <p style={styles.detailMeta}>{selectedCompany.cnpj} • {selectedCompany.regime} • {selectedCompany.competencia}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedCompany.atividades.map((atividade) => (
              <div key={atividade.instanciaId} style={styles.companyActivityBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <strong>{atividade.modeloNome}</strong>
                  <span>{atividade.progresso}%</span>
                </div>
                <ProgressBar value={atividade.progresso} />
                <div style={styles.detailChecklist}>
                  {Object.keys(atividade.checklists).map((etapa) => (
                    <label key={etapa}>
                      <input
                        type="checkbox"
                        checked={atividade.checklists[etapa]}
                        disabled={!handleToggleStep}
                        onChange={(event) => handleToggleStep?.(atividade.instanciaId, etapa, event.target.checked)}
                        style={{ accentColor: 'var(--color-gold-primary)' }}
                      />
                      <span>{etapa}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={<BriefcaseBusiness size={34} color="var(--color-gold-primary)" />} text="Clique em uma empresa para ver o fechamento." />
      )}
    </aside>
  </div>
);
