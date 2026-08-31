/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrimeirosPassosCard } from './PrimeirosPassosCard';
import type { InicioSetupStatus } from '../services/inicioSetupService';

const incompleteStatus: InicioSetupStatus = {
  empresaCompleta: true,
  logoConfigurado: true,
  marcasDaguaConfiguradas: false,
  identidadeCompleta: false,
  clientesAtivos: 1,
  clientesComModelos: 1,
  modelosAtivos: 6,
  modelosVinculados: true,
  rotinasAtivas: 0,
  tarefasAtivas: 0,
  operacaoPlanejada: false,
  usuariosAtivos: 1,
  essenciaisConcluidos: 3,
  essenciaisTotal: 4,
  configuracaoEssencialCompleta: false,
  configuracaoRecomendadaCompleta: false,
};

describe('PrimeirosPassosCard', () => {
  afterEach(cleanup);

  it('mostra progresso real e abre diretamente a marca d’água quando falta essa etapa', () => {
    const onNavigate = vi.fn();
    render(
      <PrimeirosPassosCard
        status={incompleteStatus}
        isLoading={false}
        isError={false}
        onNavigate={onNavigate}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('3 de 4 etapas essenciais concluídas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /identidade visual/i }));
    expect(onNavigate).toHaveBeenCalledWith({
      moduleId: 'configuracoes',
      configSubTab: 'marca-dagua',
    });
  });

  it('direciona rotinas e obrigações para a configuração do cliente', () => {
    const onNavigate = vi.fn();
    render(
      <PrimeirosPassosCard
        status={incompleteStatus}
        isLoading={false}
        isError={false}
        onNavigate={onNavigate}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /rotinas e obrigações/i }));

    expect(onNavigate).toHaveBeenCalledWith({ moduleId: 'clientes' });
  });
});
