/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleRenderErrorBoundary } from './ModuleRenderErrorBoundary';

describe('ModuleRenderErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides technical details and recovers without reloading the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;
    const TemporaryFailure = () => {
      if (shouldThrow) throw new Error('database-internal-secret');
      return <span>Módulo recuperado</span>;
    };

    render(
      <ModuleRenderErrorBoundary moduleName="financeiro" onReset={vi.fn()}>
        <TemporaryFailure />
      </ModuleRenderErrorBoundary>,
    );

    expect(screen.queryByText('database-internal-secret')).toBeNull();
    expect(screen.getByText(/falha temporária/i)).toBeDefined();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(screen.getByText('Módulo recuperado')).toBeDefined();
  });
});
