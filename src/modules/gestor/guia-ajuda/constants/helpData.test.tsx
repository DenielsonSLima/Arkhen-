import { describe, expect, it } from 'vitest';
import { HELP_DATA } from './helpData';

describe('HELP_DATA', () => {
  it('documenta os módulos presentes na navegação atual', () => {
    const titulos = HELP_DATA.map((modulo) => modulo.titulo);

    expect(titulos).toContain('Conformidade');
    expect(titulos).toContain('Reforma Tributária');
    expect(titulos).not.toContain('Relatórios');
  });

  it('usa os cinco destinos atuais de Atividades', () => {
    const atividades = HELP_DATA.find((modulo) => modulo.titulo === 'Atividades');

    expect(atividades?.submodulos?.map((submodulo) => submodulo.nome)).toEqual([
      'Minha Fila',
      'Equipe',
      'Fechamentos de Clientes',
      'Rotinas programadas',
      'Painel Operacional',
    ]);
  });

  it('orienta as Configurações pelos grupos exibidos na página', () => {
    const configuracoes = HELP_DATA.find((modulo) => modulo.titulo === 'Configurações');

    expect(configuracoes?.submodulos?.map((submodulo) => submodulo.nome)).toEqual([
      'Comece por aqui',
      'Acessos e governança',
      'Integrações e ferramentas',
    ]);
    expect(JSON.stringify(HELP_DATA)).not.toContain('parametrizacao');
  });

  it('explica o fluxo operacional das solicitações de documentos', () => {
    const documentos = HELP_DATA.find((modulo) => modulo.titulo === 'Documentos');
    const solicitacoes = documentos?.submodulos?.find((submodulo) => submodulo.nome === 'Solicitações');

    expect(solicitacoes?.comoUsar).toContain('cliente');
    expect(solicitacoes?.comoUsar).toContain('competência');
    expect(solicitacoes?.comoUsar).toContain('Pendente até Concluído');
  });
});
