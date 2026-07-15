import React, { useState, useMemo } from 'react';
import { 
  AlertCircle, Download, CheckSquare, Square
} from 'lucide-react';
import type { MeusDocumentosData } from '../services/documentosService';
import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { DocumentQuickPreview } from '../../gestao-empresarial/components/DocumentQuickPreview';
import { OrganizedDocumentList } from './OrganizedDocumentList';
import type { DocumentGroupBy, DocumentSortBy } from '../utils/documentOrganization';
import { matchesDocumentFileType } from '../utils/fileTypeFilters';

interface TodosDocumentosTabProps {
  meusDocs: MeusDocumentosData;
  companies: Company[];
  selectedDocIds: string[];
  toggleSelectDoc: (docId: string) => void;
  selectAllDocs: (docIds: string[]) => void;
  onBulkDownload: (documents: CompanyDocument[]) => void;
  searchTerm: string;
  selectedCategoryFilter: string;
  fileTypeFilter: string;
  viewMode: 'list' | 'grid' | 'compact';
  groupBy: DocumentGroupBy;
  sortBy: DocumentSortBy;
  onDownload?: (doc: CompanyDocument) => void;
}

export const TodosDocumentosTab: React.FC<TodosDocumentosTabProps> = ({
  meusDocs,
  companies,
  selectedDocIds,
  toggleSelectDoc,
  selectAllDocs,
  onBulkDownload,
  searchTerm,
  selectedCategoryFilter,
  fileTypeFilter,
  viewMode: initialViewMode,
  groupBy,
  sortBy,
  onDownload,
}) => {
  const [previewDoc, setPreviewDoc] = useState<CompanyDocument | null>(null);

  const viewMode = initialViewMode;
  const personalDocumentCount = meusDocs.documentos?.length || 0;
  const companyDocumentCount = companies.reduce(
    (total, company) => total + (company.documentos?.length || 0),
    0,
  );

  // Consolidated documents unifier
  const allDocuments = useMemo(() => {
    const personal = (meusDocs.documentos || []).map(d => ({
      ...d,
      empresaNome: 'Pessoal'
    }));

    const clients = companies.flatMap(c => 
      (c.documentos || []).map(d => ({
        ...d,
        empresaNome: c.nome
      }))
    );

    return [...personal, ...clients];
  }, [meusDocs.documentos, companies]);

  // Apply filters
  const filteredDocs = useMemo(() => {
    let list = allDocuments;

    if (selectedCategoryFilter !== 'Todos') {
      list = list.filter(d => d.tipo === selectedCategoryFilter);
    }

    if (fileTypeFilter !== 'Todos') {
      list = list.filter(d => matchesDocumentFileType(d, fileTypeFilter));
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      list = list.filter(d => 
        d.nome.toLowerCase().includes(lowerSearch) ||
        d.tipo.toLowerCase().includes(lowerSearch) ||
        d.empresaNome.toLowerCase().includes(lowerSearch) ||
        (d.descricao && d.descricao.toLowerCase().includes(lowerSearch))
      );
    }

    return list;
  }, [allDocuments, selectedCategoryFilter, fileTypeFilter, searchTerm]);

  // Bulk actions triggers
  const handleSelectAllToggle = () => {
    const filteredIds = filteredDocs.map(d => d.id);
    const allSelectedAlready = filteredIds.every(id => selectedDocIds.includes(id));

    if (allSelectedAlready) {
      // Deselect all filtered docs
      const remainingSelected = selectedDocIds.filter(id => !filteredIds.includes(id));
      selectAllDocs(remainingSelected);
    } else {
      // Select all filtered docs (preserving any other selections)
      const newSelection = Array.from(new Set([...selectedDocIds, ...filteredIds]));
      selectAllDocs(newSelection);
    }
  };

  const handleTriggerBulkDownload = () => {
    onBulkDownload(allDocuments.filter(d => selectedDocIds.includes(d.id)));
  };

  const areAllFilteredSelected = useMemo(() => {
    if (filteredDocs.length === 0) return false;
    return filteredDocs.every(d => selectedDocIds.includes(d.id));
  }, [filteredDocs, selectedDocIds]);

  return (
    <div className="animate-fade-in" style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', padding: '10px 12px', border: '1px solid #dbe3ed', borderRadius: '10px', background: '#f8fafc' }}>
        <div>
          <strong style={{ display: 'block', color: '#1e293b', fontSize: '0.76rem' }}>Origem dos arquivos</strong>
          <span style={{ color: '#64748b', fontSize: '0.69rem' }}>Arquivos pessoais não aparecem dentro das pastas das empresas.</span>
        </div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.68rem', fontWeight: 800 }}>{personalDocumentCount} pessoais</span>
          <span style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '0.68rem', fontWeight: 800 }}>{companyDocumentCount} de empresas</span>
          <span style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontSize: '0.68rem', fontWeight: 800 }}>{allDocuments.length} no total</span>
        </div>
      </div>
      
      {/* Top search & selectors row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleSelectAllToggle}
            className="btn-add-user"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '8px 12px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}
          >
            {areAllFilteredSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {areAllFilteredSelected ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </button>

          {selectedDocIds.length > 0 && (
            <button
              onClick={handleTriggerBulkDownload}
              className="btn-add-user"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '8px 14px', background: 'var(--color-gold-gradient)', color: '#ffffff', border: 'none' }}
            >
              <Download size={14} /> Baixar em Lote ({selectedDocIds.length})
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        </div>
      </div>

      {/* Render matching files */}
      {filteredDocs.length === 0 ? (
        <div className="empty-tab-state" style={{ padding: '40px 20px', border: '1px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#fafbfc' }}>
          <AlertCircle size={32} style={{ color: '#94a3b8', marginBottom: '8px' }} />
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
            Nenhum arquivo localizado no acervo global.
          </p>
        </div>
      ) : (
        <OrganizedDocumentList
          documents={filteredDocs}
          groupBy={groupBy}
          sortBy={sortBy}
          viewMode={viewMode}
          onPreview={setPreviewDoc}
          onDownload={onDownload}
          selectedDocIds={selectedDocIds}
          onToggleSelect={toggleSelectDoc}
        />
      )}

      {/* DOCUMENT PREVIEW OVERLAY */}
      {previewDoc && (
        <DocumentQuickPreview 
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

    </div>
  );
};
