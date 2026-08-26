import React, { Suspense } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { DocumentCategory } from '../services/documentosService';
import type { ShareableDocument, SharedDocumentLink } from '../services/documentShareService';
import '../styles/DocumentosOverlays.css';

const DocumentCategoriesModal = React.lazy(() => import('./DocumentCategoriesModal').then((module) => ({ default: module.DocumentCategoriesModal })));
const CreateFolderModal = React.lazy(() => import('./CreateFolderModal').then((module) => ({ default: module.CreateFolderModal })));
const ShareDocumentModal = React.lazy(() => import('./ShareDocumentModal').then((module) => ({ default: module.ShareDocumentModal })));
const DocumentUploadModal = React.lazy(() => import('../../gestao-empresarial/components/DocumentUploadModal').then((module) => ({ default: module.DocumentUploadModal })));

export interface DocumentosQuickModalState {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
}

interface DocumentosPageOverlaysProps {
  showCategories: boolean;
  categories: DocumentCategory[];
  categoriesDescription: string;
  onCloseCategories: () => void;
  onSaveCategories: (categories: DocumentCategory[]) => void;
  showCreateFolder: boolean;
  parentFolderName: string | null;
  onCloseCreateFolder: () => void;
  onCreateFolder: (folderName: string) => void;
  showUpload: boolean;
  uploadCategories: string[];
  currentFolder: string | null;
  onCloseUpload: () => void;
  onCreateCategory: (categoryName: string) => Promise<string> | string;
  onUpload: (
    file: File,
    category: string,
    description: string,
    targetFolder: string,
    dataValidade?: string,
  ) => Promise<CompanyDocument | undefined>;
  showShare: boolean;
  shareDocuments: ShareableDocument[];
  onCloseShare: () => void;
  onShareCreated: (links: SharedDocumentLink[]) => void;
  successToast: string | null;
  quickModal: DocumentosQuickModalState | null;
  onCloseQuickModal: () => void;
}

export const DocumentosPageOverlays: React.FC<DocumentosPageOverlaysProps> = ({
  showCategories,
  categories,
  categoriesDescription,
  onCloseCategories,
  onSaveCategories,
  showCreateFolder,
  parentFolderName,
  onCloseCreateFolder,
  onCreateFolder,
  showUpload,
  uploadCategories,
  currentFolder,
  onCloseUpload,
  onCreateCategory,
  onUpload,
  showShare,
  shareDocuments,
  onCloseShare,
  onShareCreated,
  successToast,
  quickModal,
  onCloseQuickModal,
}) => (
  <>
    <Suspense fallback={null}>
      {showCategories && (
        <DocumentCategoriesModal
          isOpen
          categories={categories}
          description={categoriesDescription}
          onClose={onCloseCategories}
          onSave={onSaveCategories}
        />
      )}
      {showCreateFolder && (
        <CreateFolderModal
          isOpen
          onClose={onCloseCreateFolder}
          onSubmit={onCreateFolder}
          parentFolderName={parentFolderName}
        />
      )}
      {showUpload && (
        <DocumentUploadModal
          isOpen
          onClose={onCloseUpload}
          categories={uploadCategories}
          currentFolder={currentFolder}
          onCreateCategory={onCreateCategory}
          onUpload={onUpload}
        />
      )}
      {showShare && (
        <ShareDocumentModal
          isOpen
          documents={shareDocuments}
          onClose={onCloseShare}
          onCreated={onShareCreated}
        />
      )}
    </Suspense>

    {successToast && (
      <div className="documents-success-toast animate-fade-in" role="status" aria-live="polite">
        <CheckCircle2 size={18} aria-hidden />
        <span>{successToast}</span>
      </div>
    )}

    <SystemQuickModal
      isOpen={quickModal !== null}
      title={quickModal?.title || ''}
      message={quickModal?.message || ''}
      confirmLabel={quickModal?.confirmLabel}
      danger={quickModal?.danger}
      onConfirm={quickModal?.onConfirm}
      onClose={onCloseQuickModal}
    />
  </>
);
