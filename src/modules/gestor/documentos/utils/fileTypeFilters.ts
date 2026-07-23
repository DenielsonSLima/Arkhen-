import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';

const getExtension = (value?: string) => {
  if (!value) return '';
  const clean = value.split('?')[0].split('#')[0];
  const fileName = clean.split('/').pop() || clean;
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
};

const getDocumentExtensions = (doc: CompanyDocument) => new Set([
  getExtension(doc.nome),
  getExtension(doc.storagePath),
  getExtension(doc.url),
].filter(Boolean));

export const matchesDocumentFileType = (doc: CompanyDocument, fileTypeFilter: string) => {
  if (fileTypeFilter === 'Todos') return true;

  const extensions = getDocumentExtensions(doc);
  const mimeType = (doc.mimeType || '').toLowerCase();
  const hasExt = (...items: string[]) => items.some((item) => extensions.has(item));

  if (fileTypeFilter === 'image') return hasExt('png', 'jpg', 'jpeg', 'webp') || mimeType.startsWith('image/');
  if (fileTypeFilter === 'pdf') return hasExt('pdf') || mimeType === 'application/pdf' || mimeType.includes('/pdf');
  if (fileTypeFilter === 'docx') return hasExt('docx', 'doc') || mimeType.includes('wordprocessingml') || mimeType === 'application/msword';
  if (fileTypeFilter === 'xlsx') return hasExt('xlsx', 'xls') || mimeType.includes('spreadsheetml') || mimeType === 'application/vnd.ms-excel';
  if (fileTypeFilter === 'xml') return hasExt('xml') || mimeType === 'application/xml' || mimeType === 'text/xml';
  if (fileTypeFilter === 'text') return hasExt('txt', 'efd', 'ecd', 'ecf') || mimeType.startsWith('text/');
  if (fileTypeFilter === 'csv') return hasExt('csv') || mimeType === 'text/csv';
  if (fileTypeFilter === 'bank') return hasExt('ofx', 'qif', 'rem', 'ret', 'cnab');
  if (fileTypeFilter === 'certificate') return hasExt('pfx', 'p12', 'cer', 'crt', 'pem', 'p7s', 'key');
  if (fileTypeFilter === 'archive') return hasExt('zip', 'rar', '7z') || mimeType.includes('zip') || mimeType.includes('compressed');
  if (fileTypeFilter === 'email') return hasExt('eml', 'msg') || mimeType === 'message/rfc822';

  return true;
};
