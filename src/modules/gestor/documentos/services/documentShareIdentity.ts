import { supabase } from '../../../../lib/supabase';

interface CompanyIdentityRow {
  nome_fantasia: string | null;
  razao_social: string | null;
}

interface UserIdentityRow {
  nome: string | null;
}

export interface DocumentShareIdentity {
  empresaId: string;
  empresaNome: string;
  usuarioNome: string;
}

const normalizeName = (value: unknown) => (
  typeof value === 'string' && value.trim() ? value.trim() : ''
);

export const resolveDocumentShareIdentity = async (): Promise<DocumentShareIdentity> => {
  const [{ data: empresaId, error: empresaError }, { data: authData, error: authError }] = await Promise.all([
    supabase.rpc('current_empresa_id'),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  if (empresaError || !empresaId) {
    throw new Error('Não foi possível identificar a empresa ativa para compartilhar o documento.');
  }
  if (authError || !user) {
    throw new Error('Sua sessão não pôde ser identificada. Entre novamente antes de compartilhar.');
  }

  const normalizedEmpresaId = String(empresaId);
  const [companyResult, profileResult] = await Promise.all([
    supabase
      .from('configuracoes_empresa')
      .select('nome_fantasia,razao_social')
      .eq('empresa_id', normalizedEmpresaId)
      .maybeSingle(),
    supabase
      .from('configuracoes_usuarios')
      .select('nome')
      .eq('empresa_id', normalizedEmpresaId)
      .eq('auth_user_id', user.id)
      .eq('status', 'Ativo')
      .maybeSingle(),
  ]);

  if (companyResult.error) {
    throw new Error(`Não foi possível identificar o escritório: ${companyResult.error.message}`);
  }
  if (profileResult.error) {
    throw new Error(`Não foi possível identificar o responsável: ${profileResult.error.message}`);
  }

  const company = companyResult.data as CompanyIdentityRow | null;
  const profile = profileResult.data as UserIdentityRow | null;
  const empresaNome = normalizeName(company?.nome_fantasia) || normalizeName(company?.razao_social);
  const usuarioNome = normalizeName(profile?.nome);

  if (!empresaNome) {
    throw new Error('Complete o nome do escritório em Dados da Empresa antes de compartilhar documentos.');
  }
  if (!usuarioNome) {
    throw new Error('Complete seu nome em Meu Perfil antes de compartilhar documentos.');
  }

  return { empresaId: normalizedEmpresaId, empresaNome, usuarioNome };
};
