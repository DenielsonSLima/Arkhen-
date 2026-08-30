import React, { useMemo, useState } from 'react';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';

interface BibliotecaFiliaisFoldersProps {
  companies: Company[];
  onOpenBranchFolder?: (companyId: string, folderPath: string, companyName: string) => void;
}

interface BibliotecaFilialFolder {
  companyId: string;
  companyName: string;
  branchName: string;
  cnpj: string;
  folderPath: string;
}

export const BibliotecaFiliaisFolders: React.FC<BibliotecaFiliaisFoldersProps> = ({
  companies,
  onOpenBranchFolder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const folders = useMemo<BibliotecaFilialFolder[]>(() => (
    companies
      .filter((company) => company.status !== 'Inativa')
      .flatMap((company) => (company.polos || []).flatMap((branch) => {
        const folderPath = branch.documentFolderPath?.trim();
        if (!folderPath) return [];
        return [{
          companyId: company.id,
          companyName: company.nome,
          branchName: branch.nome,
          cnpj: branch.cnpj,
          folderPath,
        }];
      }))
  ), [companies]);

  if (folders.length === 0) return null;

  if (!isOpen) {
    return (
      <section style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
          Pastas da Biblioteca
        </div>
        <div className="docs-folders-grid">
          <button
            type="button"
            className="doc-folder-card"
            onClick={() => setIsOpen(true)}
            style={{ border: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <FolderOpen className="doc-folder-icon" size={24} />
            <div className="doc-folder-info">
              <h4>Filiais</h4>
              <span>{folders.length} {folders.length === 1 ? 'filial cadastrada' : 'filiais cadastradas'}</span>
            </div>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: '4px' }}
          aria-label="Voltar para a Biblioteca"
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Biblioteca / Filiais
        </div>
      </div>
      <div className="docs-folders-grid">
        {folders.map((folder) => (
          <button
            key={folder.folderPath}
            type="button"
            className="doc-folder-card"
            onClick={() => onOpenBranchFolder?.(folder.companyId, folder.folderPath, folder.companyName)}
            style={{ border: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            title={`Abrir ${folder.folderPath}`}
          >
            <FolderOpen className="doc-folder-icon" size={24} />
            <div className="doc-folder-info">
              <h4>{folder.branchName}</h4>
              <span>CNPJ: {folder.cnpj || 'Não cadastrado'}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
