import { describe, expect, it } from 'vitest';
import {
  isUuid,
  isValidCpf,
  normalizeContactEmail,
  normalizeCpf,
  normalizeEmployeeName,
  normalizePhone,
  parseAccessConfig,
  parseCpfLoginCredentials,
  parseDefaultSupabaseSecretKey,
  parseEmployeeStatus,
  parseForwardedFor,
  validateEmployeeName,
  validatePassword,
} from './validation.ts';

const VALID_CPF = '529.982.247-25';

describe('CPF validation', () => {
  it('normaliza uma representação formatada', () => {
    expect(normalizeCpf(VALID_CPF)).toBe('52998224725');
    expect(normalizeCpf(null)).toBe('');
  });

  it.each([VALID_CPF, '168.995.350-09', '111.444.777-35'])(
    'aceita o CPF válido %s',
    (cpf) => expect(isValidCpf(cpf)).toBe(true),
  );

  it.each([
    '',
    '123',
    '111.111.111-11',
    '529.982.247-24',
    'cpf: 529.982.247-25',
  ])('rejeita o CPF inválido %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });
});

describe('employee input validation', () => {
  it('normaliza credenciais de login sem aplicar política de criação à senha', () => {
    expect(parseCpfLoginCredentials(VALID_CPF, 'SenhaExistente1')).toEqual({
      cpf: '52998224725',
      password: 'SenhaExistente1',
    });
  });

  it.each([
    ['529.982.247-24', 'SenhaExistente1'],
    [VALID_CPF, ''],
    [VALID_CPF, `Senha1${'x'.repeat(128)}`],
    [VALID_CPF, 'Senha\n1'],
  ])('rejeita credenciais de login estruturalmente inválidas', (cpf, password) => {
    expect(() => parseCpfLoginCredentials(cpf, password)).toThrow('CPF ou senha inválidos');
  });

  it.each(['SenhaForte1', 'Contr@senha2026'])(
    'aceita a senha válida %s',
    (password) => expect(validatePassword(password, VALID_CPF)).toBeNull(),
  );

  it.each([
    ['Curta1', 'curta'],
    ['senhasemnumero', 'sem número'],
    ['1234567890', 'sem letra'],
    ['A529.982.247-25x', 'contém CPF formatado'],
    [`A${'1'.repeat(128)}`, 'mais de 128 caracteres'],
  ])('rejeita a senha %s (%s)', (password) => {
    expect(validatePassword(password, VALID_CPF)).not.toBeNull();
  });

  it('normaliza e valida o nome sem aceitar marcação', () => {
    expect(normalizeEmployeeName('  Maria   da Silva ')).toBe('Maria da Silva');
    expect(validateEmployeeName('Maria da Silva')).toBeNull();
    expect(validateEmployeeName('<script>')).not.toBeNull();
  });

  it('normaliza contatos opcionais e preserva null quando ausentes', () => {
    expect(normalizeContactEmail('  MARIA.SILVA+FINANCEIRO@EXEMPLO.COM '))
      .toBe('maria.silva+financeiro@exemplo.com');
    expect(normalizeContactEmail('')).toBeNull();
    expect(normalizeContactEmail(undefined)).toBeNull();
    expect(normalizePhone(' (79) 99999-9999 ')).toBe('79999999999');
    expect(normalizePhone(null)).toBeNull();
  });

  it.each([
    'sem-arroba.example.com',
    'usuario@localhost',
    '.usuario@example.com',
    'usuario..teste@example.com',
    `${'a'.repeat(140)}@example.com`,
    '<usuario>@example.com',
  ])('rejeita o e-mail de contato inválido %s', (email) => {
    expect(() => normalizeContactEmail(email)).toThrow('e-mail de contato válido');
  });

  it.each([
    '799999999',
    '5579999999999',
    '(79) 9999-999A',
    '1'.repeat(41),
  ])('rejeita o telefone inválido %s', (phone) => {
    expect(() => normalizePhone(phone)).toThrow('10 ou 11 dígitos');
  });

  it('aceita apenas status compatíveis com uma conta Auth provisionada', () => {
    expect(parseEmployeeStatus(undefined)).toBe('Ativo');
    expect(parseEmployeeStatus(null)).toBe('Ativo');
    expect(parseEmployeeStatus('Ativo')).toBe('Ativo');
    expect(parseEmployeeStatus('Inativo')).toBe('Inativo');
    expect(parseEmployeeStatus('Pendente')).toBe('Pendente');
    expect(() => parseEmployeeStatus('')).toThrow('status do funcionário');
  });

  it('aceita somente UUID canônico com variante e versão válidas', () => {
    expect(isUuid('8d080b9c-f3f7-4c92-9064-8f75104b2a47')).toBe(true);
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(isUuid('usuario-1')).toBe(false);
  });

  it('normaliza a configuração de acesso e ordena os dias', () => {
    expect(parseAccessConfig({
      enabled: true,
      days: [5, 1, 3],
      intervals: [{ start: '08:00', end: '18:00' }],
      message: ' Fora do horário. ',
    })).toEqual({
      enabled: true,
      days: [1, 3, 5],
      intervals: [{ start: '08:00', end: '18:00' }],
      message: 'Fora do horário.',
    });
  });

  it.each([
    { enabled: true, days: [], intervals: [{ start: '08:00', end: '18:00' }] },
    { enabled: true, days: [1], intervals: [{ start: '18:00', end: '08:00' }] },
    { enabled: true, days: [7], intervals: [{ start: '08:00', end: '18:00' }] },
    {
      enabled: true,
      days: [1],
      intervals: [{ start: '08:00', end: '18:00' }],
      message: '<script>',
    },
  ])('rejeita a configuração de acesso inválida %#', (accessConfig) => {
    expect(() => parseAccessConfig(accessConfig)).toThrow();
  });
});

describe('login infrastructure validation', () => {
  it('extrai somente a chave secreta nomeada default', () => {
    expect(parseDefaultSupabaseSecretKey(
      JSON.stringify({ default: 'sb_secret_abcdefgh12345678', other: 'ignored' }),
    )).toBe('sb_secret_abcdefgh12345678');
  });

  it.each([
    '',
    'sb_secret_abcdefgh12345678',
    '[]',
    '{}',
    JSON.stringify({ default: 'eyJhbGciOiJIUzI1NiJ9.legacy' }),
  ])('rejeita coleção/chave secreta inválida (%j)', (keys) => {
    expect(() => parseDefaultSupabaseSecretKey(keys)).toThrow(
      'Chave secreta de login indisponível',
    );
  });

  it.each([
    ['203.0.113.7', '203.0.113.7'],
    [' 2001:db8::1 ', '2001:db8::1'],
    ['203.0.113.7, 10.0.0.2', '203.0.113.7, 10.0.0.2'],
  ])('preserva o IP encaminhado válido %s', (value, expected) => {
    expect(parseForwardedFor(value)).toBe(expected);
  });

  it.each([null, '', 'unknown', '203.0.113.7\nX-Test: 1'])(
    'rejeita IP encaminhado ausente ou inválido (%j)',
    (value) => expect(() => parseForwardedFor(value)).toThrow('IP de origem indisponível'),
  );
});
