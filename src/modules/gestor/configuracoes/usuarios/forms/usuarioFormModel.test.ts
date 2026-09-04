import { describe, expect, it } from 'vitest';
import type { PerfilAcesso } from '../../perfis/services/perfisService';
import type { SaveUsuarioInput } from '../services/usuariosService';
import {
  canUseCpfAccess,
  getDefaultCpfAccessProfile,
  validateUsuarioForm,
} from './usuarioFormModel';

const createPerfil = (
  codigo: string,
  nome: string,
  permissoes: string[],
): PerfilAcesso => ({
  id: codigo,
  codigo,
  nome,
  descricao: '',
  tipo: 'Sistema',
  sistema: true,
  permissoes,
  usuariosCount: 0,
  dataCriacao: '01/01/2026',
  ordem: 1,
});

const funcionario = createPerfil('funcionario', 'Funcionário', ['inicio:view', 'atividades:view']);
const fiscal = createPerfil('fiscal', 'Analista Fiscal', ['inicio:view', 'clientes:view']);
const gestor = createPerfil('gestor', 'Gestor', ['usuarios:manage', 'perfis:manage']);
const perfis = [gestor, fiscal, funcionario];

const createInput = (patch: Partial<SaveUsuarioInput> = {}): SaveUsuarioInput => ({
  nome: 'Maria da Silva',
  formaAcesso: 'cpf',
  email: '',
  cpf: '529.982.247-25',
  telefone: '',
  senha: undefined,
  confirmacaoSenha: undefined,
  perfilId: funcionario.id,
  perfil: 'Funcionário',
  status: 'Ativo',
  accessConfig: {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    intervals: [{ start: '08:00', end: '18:00' }],
    message: 'Acesso fora do horário permitido.',
  },
  ...patch,
});

describe('usuarioFormModel', () => {
  it('aceita funcionário por CPF sem e-mail e telefone e normaliza os dados', () => {
    const result = validateUsuarioForm(createInput(), perfis);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.cpf).toBe('52998224725');
    expect(result.data.email).toBe('');
    expect(result.data.telefone).toBe('');
  });

  it('rejeita CPF inválido', () => {
    const result = validateUsuarioForm(createInput({ cpf: '111.111.111-11' }), perfis);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.cpf).toContain('CPF válido');
  });

  it('não recebe senha digitada pelo gestor no novo acesso por CPF', () => {
    const result = validateUsuarioForm(createInput({ senha: 'abc', confirmacaoSenha: '' }), perfis);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.senha).toBeUndefined();
    expect(result.data.confirmacaoSenha).toBeUndefined();
  });

  it('não exige senha inicial ao editar um acesso por CPF', () => {
    const result = validateUsuarioForm(createInput({
      id: 'usuario-1',
      senha: '',
      confirmacaoSenha: '',
    }), perfis);

    expect(result.success).toBe(true);
  });

  it('rejeita e-mail no novo cadastro marcado como somente CPF', () => {
    const result = validateUsuarioForm(createInput({ email: 'contato@empresa.com' }), perfis);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.email).toContain('deixe o e-mail em branco');
  });

  it.each([
    gestor,
    createPerfil('coordenador', 'Coordenador', ['configuracoes:manage']),
  ])('bloqueia o perfil de gestão $nome no modo CPF', (perfil) => {
    const result = validateUsuarioForm(
      createInput({ perfil: perfil.nome, perfilId: perfil.id }),
      [...perfis, perfil],
    );

    expect(canUseCpfAccess(perfil)).toBe(false);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.perfil).toContain('perfil operacional');
  });

  it('prioriza o perfil Funcionário como padrão do acesso por CPF', () => {
    expect(getDefaultCpfAccessProfile(perfis)).toBe(funcionario);
  });

  it('preserva o cadastro legado por e-mail sem exigir senha inicial', () => {
    const result = validateUsuarioForm(createInput({
      formaAcesso: 'email',
      email: 'GESTAO@EXEMPLO.COM',
      telefone: '(79) 99999-9999',
      senha: undefined,
      confirmacaoSenha: undefined,
      perfilId: gestor.id,
      perfil: 'Gestor',
      status: 'Pendente',
    }), perfis);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe('gestao@exemplo.com');
    expect(result.data.telefone).toBe('79999999999');
    expect(result.data.senha).toBeUndefined();
  });

  it('preserva e normaliza e-mail de contato ao editar um acesso por CPF', () => {
    const result = validateUsuarioForm(createInput({
      id: 'usuario-1',
      email: 'CONTATO@EMPRESA.COM',
    }), perfis);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe('contato@empresa.com');
  });
});
