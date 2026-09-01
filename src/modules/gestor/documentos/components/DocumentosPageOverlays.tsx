import React, { Suspense } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentosTab } from '../hooks/useDocumentos';
import type { DocumentCategory } from '../services/documentosService';
import type { ShareableDocument } from '../services/documentShareService';

const DocumentCategoriesModal = React.lazy(() => import('./DocumentCategoriesModal').then((module) => ({ default: module.DocumentCategoriesModal })));
const CreateFolderModal = React.lazy(() => import('./CreateFolderModal').then((module) => ({ default: module.CreateFolderModal })));
const ShareDocumentModal = React.lazy(() => import('./ShareDocumentModal').then((module) => ({ default: module.ShareDocumentModal })));
const DocumentUploadModal = React.lazy(() => import('../../gestao-empresarial/components/DocumentUploadModal').then((module) => ({ default: module.DocumentUploadModal })));

interface DocumentosPageOverlaysProps {
  activeTab: DocumentosTab;
  showCategoriesModal: boolean;
  onCloseCategories: () => void;
  personalCategories: DocumentCategory[];
  companyCategoriesForModal: DocumentCategory[];
  onSaveCategories: (categories: DocumentCategory[]) => Promise<void> | void;
  showCreateFolderModal: boolean;
  onCloseCreateFolder: () => void;
  onCreatePersonalFolder: (folderName: string) => void;
  onCreateCompanyFolder: (folderName: string) => void;
  personalFolder: string | null;
  companyFolder: string | null;
  showUploadModal: boolean;
  onCloseUpload: () => void;
  personalCategoryNames: string[];
  companyCategoryNames: string[];
  onCreateUploadCategory: (categoryName: string) => Promise<string> | string;
  onUploadPersonal: (file: File, category: string, description: string, targetFolder: string, dataValidade?: string) => Promise<CompanyDocument>;
  onUploadCompany: (file: File, category: string, description: string, targetFolder: string, dataValidade?: string) => Promise<CompanyDocument | undefined>;
  showShareModal: boolean;
  shareDocuments: ShareableDocument[];
  onCloseShare: () => void;
  onShareCreated: (count: number) => void;
  successToast: string | null;
}

const getFolderLabel = (path: string) => path.split('/').at(-1) || null;

export const DocumentosPageOverlays: React.FC<DocumentosPageOverlaysProps> = ({
  activeTab, showCategoriesModal, onCloseCategories, personalCategories,
  companyCategoriesForModal, onSaveCategories, showCreateFolderModal,
  onCloseCreateFolder, onCreatePersonalFolder, onCreateCompanyFolder,
  personalFolder, companyFolder, showUploadModal, onCloseUpload,
  personalCategoryNames, companyCategoryNames, onCreateUploadCategory,
  onUploadPersonal, onUploadCompany, showShareModal, shareDocuments,
  onCloseShare, onShareCreated, successToast,
}) => (
  <>
    <Suspense fallback={null}>
      {showCategoriesModal && (
        <DocumentCategoriesModal
          isOpen={showCategoriesModal}
          categories={activeTab === 'meus' ? personalCategories : companyCategoriesForModal}
          description={activeTab === 'meus'
            ? 'Categorias padrão ficam sempre ativas; suas categorias extras ficam salvas no Supabase.'
            : 'Categorias padrão ficam sempre ativas; categorias criadas aqui ficam só nesta empresa.'}
          onClose={onCloseCategories}
          onSave={onSaveCategories}
        />
      )}
      {showCreateFolderModal && (
        <CreateFolderModal
          isOpen={showCreateFolderModal}
          onClose={onCloseCreateFolder}
          onSubmit={activeTab === 'meus' ? onCreatePersonalFolder : onCreateCompanyFolder}
          parentFolderName={activeTab === 'meus'
            ? (personalFolder ? getFolderLabel(personalFolder) : null)
            : (companyFolder ? getFolderLabel(companyFolder) : null)}
        />
      )}
      {showUploadModal && (
        <DocumentUploadModal
          isOpen={showUploadModal}
          onClose={onCloseUpload}
          categories={activeTab === 'meus' ? personalCategoryNames : companyCategoryNames}
          currentFolder={activeTab === 'meus' ? personalFolder : companyFolder}
          onCreateCategory={onCreateUploadCategory}
          onUpload={activeTab === 'meus' ? onUploadPersonal : onUploadCompany}
        />
      )}
      {showShareModal && (
        <ShareDocumentModal
          isOpen={showShareModal}
          documents={shareDocuments}
          onClose={onCloseShare}
          onCreated={(links) => onShareCreated(links.length)}
        />
      )}
    </Suspense>

    {successToast && (
      <div
        className="animate-fade-in"
        style={{
          position: 'fixed', top: '18px', right: '18px', zIndex: 2200,
          width: 'min(360px, calc(100vw - 32px))', padding: '12px 14px',
          borderRadius: '10px', background: '#0f172a',
          border: '1px solid rgba(197, 146, 53, 0.5)', color: '#ffffff',
          boxShadow: '0 18px 46px rgba(15, 23, 42, 0.28)', display: 'flex',
          alignItems: 'center', gap: '10px', fontSize: '0.82rem', fontWeight: 600,
        }}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 size={18} style={{ color: '#d9a441', flexShrink: 0 }} />
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{successToast}</span>
      </div>
    )}
  </>
);
