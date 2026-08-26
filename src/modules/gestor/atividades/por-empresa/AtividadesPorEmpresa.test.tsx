/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AtividadesPorEmpresa } from './AtividadesPorEmpresa';

const emptyMetrics = { total: 0, completed: 0, inProgress: 0, pending: 0 };

describe('AtividadesPorEmpresa empty states', () => {
  it('leva à configuração quando ainda não existem fechamentos', () => {
    const onShowConfig = vi.fn();

    render(
      <AtividadesPorEmpresa
        globalFilter="todas"
        setGlobalFilter={vi.fn()}
        companyGroups={[]}
        isLoading={false}
        setSelectedGroup={vi.fn()}
        metrics={emptyMetrics}
        onShowConfig={onShowConfig}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /configurar modelos e vínculos/i }));

    expect(onShowConfig).toHaveBeenCalledOnce();
  });

  it('permite limpar um filtro sem resultados', () => {
    const setGlobalFilter = vi.fn();

    render(
      <AtividadesPorEmpresa
        globalFilter="pendentes"
        setGlobalFilter={setGlobalFilter}
        companyGroups={[]}
        isLoading={false}
        setSelectedGroup={vi.fn()}
        metrics={{ ...emptyMetrics, total: 2 }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver todas as empresas/i }));

    expect(setGlobalFilter).toHaveBeenCalledWith('todas');
  });
});
