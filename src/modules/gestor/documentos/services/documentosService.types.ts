import type { Company, CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';

export interface DocumentCategory {
  id: string;
  nome: string;
  ativo: boolean;
  sistema?: boolean;
}

export type StoredDocumentCategory = DocumentCategory | string;
export type DocumentScope = 'pessoal' | 'empresa';

export interface MeusDocumentosData {
  pastas: string[];
  categorias: DocumentCategory[];
  documentos: CompanyDocument[];
}

export interface UploadDocumentInput {
  file: File;
  category: string;
  description: string;
  targetFolder: string;
  dataValidade?: string;
}

export interface UploadCompanyDocumentInput extends UploadDocumentInput {
  companyId: string;
}

export interface DocumentRow {
  id: string;
  scope: DocumentScope;
  cliente_id: string | null;
  storage_bucket: string;
  storage_path: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  pasta: string | null;
  data_upload: string | null;
  data_validade: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string | null;
}

export interface EmpresaRow {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  status: string | null;
  tipo: Company['tipo'] | null;
  tipo_estabelecimento: Company['tipoEstabelecimento'] | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  pastas_documentos: string[] | null;
  categorias_documentos: string[] | null;
}

export interface DocumentCategoryRow {
  id: string;
  cliente_id: string | null;
  nome: string;
  ativo: boolean | null;
  sistema: boolean | null;
  ordem: number | null;
}

export interface DocumentMetadataUpdate {
  id: string;
  nome?: string;
  pasta?: string | null;
}
