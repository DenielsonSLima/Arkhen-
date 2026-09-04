import { z } from 'zod';
import { isValidCpf, normalizeCpf } from '../../../../../lib/cpf';
import type { PerfilAcesso } from '../../perfis/services/perfisService';
import type { SaveUsuarioInput } from '../services/usuariosService';

const GESTAO_PERMISSIONS = new Set([
  'usuarios:manage',
  'perfis:manage',
  'configuracoes:manage',
]);

const EMAIL_SCHEMA = z.string().email('Informe um e-mail válido.');
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const accessConfigSchema = z.object({
  enabled: z.boolean(),
  days: z.array(z.number().int().min(0).max(6)),
  intervals: z.array(z.object({
    start: z.string().regex(TIME_PATTERN, 'Informe um horário inicial válido.'),
    end: z.string().regex(TIME_PATTERN, 'Informe um horário final válido.'),
  })),
  message: z.string().trim().max(300, 'A mensagem deve ter no máximo 300 caracteres.'),
});

const usuarioFormBaseSchema = z.object({
  id: z.string().nullable().optional(),
  nome: z.string().trim()
    .min(2, 'Informe o nome completo.')
    .max(150, 'O nome deve ter no máximo 150 caracteres.'),
  formaAcesso: z.enum(['email', 'cpf']),
  email: z.string().trim().max(150, 'O e-mail deve ter no máximo 150 caracteres.'),
  cpf: z.string().trim(),
  telefone: z.string().trim().max(30, 'O telefone deve ter no máximo 30 caracteres.'),
  senha: z.string().max(128, 'A senha deve ter no máximo 128 caracteres.').optional(),
  confirmacaoSenha: z.string().max(128, 'A confirmação deve ter no máximo 128 caracteres.').optional(),
  perfilId: z.string().trim().optional(),
  perfil: z.string().trim().min(1, 'Selecione um perfil de acesso.'),
  status: z.enum(['Ativo', 'Inativo', 'Pendente']),
  accessConfig: accessConfigSchema,
});

export const canUseCpfAccess = (
  perfil?: Pick<PerfilAcesso, 'codigo' | 'permissoes'> | null,
) => Boolean(
  perfil
  && perfil.codigo !== 'gestor'
  && !perfil.permissoes.some((permission) => GESTAO_PERMISSIONS.has(permission)),
);

export const getCpfAccessProfiles = (perfis: PerfilAcesso[]) => perfis.filter(canUseCpfAccess);

export const getDefaultCpfAccessProfile = (perfis: PerfilAcesso[]) => {
  const allowedProfiles = getCpfAccessProfiles(perfis);
  return allowedProfiles.find((perfil) => perfil.codigo === 'funcionario') || allowedProfiles[0] || null;
};

const createUsuarioFormSchema = (perfis: PerfilAcesso[]) => usuarioFormBaseSchema
  .superRefine((value, context) => {
    const selectedPerfil = perfis.find((perfil) => perfil.id === value.perfilId);
    const phoneDigits = value.telefone.replace(/\D/g, '');
    if (!isValidCpf(value.cpf)) {
      context.addIssue({
        code: 'custom',
        path: ['cpf'],
        message: 'Informe um CPF válido com 11 dígitos.',
      });
    }
    if (value.email && !EMAIL_SCHEMA.safeParse(value.email).success) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'Informe um e-mail válido.' });
    }

    if (value.formaAcesso === 'email' && !value.email) {
      context.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'O e-mail é obrigatório para esta forma de acesso.',
      });
    }

    if (!value.id && value.formaAcesso === 'cpf' && value.email) {
      context.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'Para acesso somente por CPF, deixe o e-mail em branco.',
      });
    }

    if (value.formaAcesso === 'email' && !phoneDigits) {
      context.addIssue({
        code: 'custom',
        path: ['telefone'],
        message: 'O telefone é obrigatório no cadastro por e-mail.',
      });
    }

    if (phoneDigits && ![10, 11].includes(phoneDigits.length)) {
      context.addIssue({
        code: 'custom',
        path: ['telefone'],
        message: 'Informe um telefone com 10 ou 11 dígitos.',
      });
    }

    if (value.formaAcesso === 'cpf') {
      if (!selectedPerfil
        || selectedPerfil.nome !== value.perfil
        || !canUseCpfAccess(selectedPerfil)) {
        context.addIssue({
          code: 'custom',
          path: ['perfil'],
          message: 'Selecione um perfil operacional, sem permissões de gestão.',
        });
      }

    }

    if (value.accessConfig.enabled) {
      if (value.accessConfig.days.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['accessConfig'],
          message: 'Selecione ao menos um dia permitido.',
        });
      }
      if (value.accessConfig.intervals.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['accessConfig'],
          message: 'Adicione ao menos um intervalo permitido.',
        });
      }
      value.accessConfig.intervals.forEach((interval) => {
        if (TIME_PATTERN.test(interval.start)
          && TIME_PATTERN.test(interval.end)
          && interval.start >= interval.end) {
          context.addIssue({
            code: 'custom',
            path: ['accessConfig'],
            message: 'O horário final deve ser posterior ao horário inicial.',
          });
        }
      });
    }
  })
  .transform((value): SaveUsuarioInput => ({
    ...value,
    cpf: normalizeCpf(value.cpf),
    telefone: value.telefone.replace(/\D/g, ''),
    perfilId: perfis.find((perfil) => perfil.id === value.perfilId)?.id
      || perfis.find((perfil) => perfil.nome === value.perfil)?.id,
    perfil: perfis.find((perfil) => perfil.id === value.perfilId)?.nome || value.perfil,
    email: !value.id && value.formaAcesso === 'cpf' ? '' : value.email.toLowerCase(),
    senha: undefined,
    confirmacaoSenha: undefined,
  }));

export type UsuarioFormErrorField =
  | 'nome'
  | 'formaAcesso'
  | 'email'
  | 'cpf'
  | 'telefone'
  | 'senha'
  | 'confirmacaoSenha'
  | 'perfil'
  | 'status'
  | 'accessConfig';

export type UsuarioFormErrors = Partial<Record<UsuarioFormErrorField, string>>;

export type UsuarioFormValidationResult =
  | { success: true; data: SaveUsuarioInput; errors: UsuarioFormErrors }
  | { success: false; message: string; errors: UsuarioFormErrors };

export const validateUsuarioForm = (
  input: SaveUsuarioInput,
  perfis: PerfilAcesso[],
): UsuarioFormValidationResult => {
  const result = createUsuarioFormSchema(perfis).safeParse(input);
  if (result.success) return { success: true, data: result.data, errors: {} };

  const errors: UsuarioFormErrors = {};
  result.error.issues.forEach((issue) => {
    const field = String(issue.path[0] || '') as UsuarioFormErrorField;
    if (field && !errors[field]) errors[field] = issue.message;
  });

  return {
    success: false,
    message: result.error.issues[0]?.message || 'Revise os dados informados.',
    errors,
  };
};
