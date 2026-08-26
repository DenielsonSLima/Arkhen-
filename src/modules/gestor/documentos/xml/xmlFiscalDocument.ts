import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export const isXmlDocument = (document: Pick<CompanyDocument, 'nome' | 'mimeType'>) => {
  const extension = document.nome.split('.').pop()?.toLowerCase();
  return extension === 'xml'
    || document.mimeType === 'application/xml'
    || document.mimeType === 'text/xml';
};
