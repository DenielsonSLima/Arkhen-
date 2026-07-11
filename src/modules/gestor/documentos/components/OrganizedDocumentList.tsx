import React, { useMemo } from 'react';
import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { DocumentGridView } from '../../gestao-empresarial/components/DocumentGridView';
import { DocumentTableView } from '../../gestao-empresarial/components/DocumentTableView';
import { organizeDocuments, recordDocumentAccess, type DocumentGroupBy, type DocumentSortBy } from '../utils/documentOrganization';

interface OrganizedDocumentListProps {
  documents: CompanyDocument[];
  groupBy: DocumentGroupBy;
  sortBy: DocumentSortBy;
  viewMode: 'list' | 'grid' | 'compact';
  onPreview: (document: CompanyDocument) => void;
  onRename?: (docId: string, newName: string) => Promise<void> | void;
  onMove?: (docId: string) => void;
  onDelete?: (docId: string) => void;
  selectedDocIds: string[];
  onToggleSelect: (docId: string) => void;
}

export const OrganizedDocumentList: React.FC<OrganizedDocumentListProps> = ({
  documents,
  groupBy,
  sortBy,
  viewMode,
  onPreview,
  onRename,
  onMove,
  onDelete,
  selectedDocIds,
  onToggleSelect,
}) => {
  const groups = useMemo(() => organizeDocuments(documents, groupBy, sortBy), [documents, groupBy, sortBy]);

  const handlePreview = (document: CompanyDocument) => {
    recordDocumentAccess(document.id);
    onPreview(document);
  };

  const renderList = (groupDocuments: CompanyDocument[]) => (
    viewMode === 'list' || viewMode === 'compact' ? (
      <DocumentTableView
        documents={groupDocuments}
        onPreview={handlePreview}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
        selectedDocIds={selectedDocIds}
        onToggleSelect={onToggleSelect}
        showCheckboxes={true}
        variant={viewMode === 'compact' ? 'compact' : 'default'}
      />
    ) : (
      <DocumentGridView
        documents={groupDocuments}
        onPreview={handlePreview}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
        selectedDocIds={selectedDocIds}
        onToggleSelect={onToggleSelect}
        showCheckboxes={true}
      />
    )
  );

  if (groupBy === 'none') return renderList(groups[0]?.documents || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {groups.map((group) => (
        <section key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '0.82rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0' }}>
              {group.label}
            </h3>
            <span style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', borderRadius: '999px', padding: '2px 7px', fontSize: '0.68rem', fontWeight: 800 }}>
              {group.documents.length}
            </span>
          </div>
          {renderList(group.documents)}
        </section>
      ))}
    </div>
  );
};
