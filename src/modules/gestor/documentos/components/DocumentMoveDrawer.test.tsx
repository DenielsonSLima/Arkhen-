/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const service = vi.hoisted(() => ({ getDrawerState: vi.fn(), setDrawerState: vi.fn() }));
vi.mock('../services/documentosPreferencesService', () => ({ documentosPreferencesService: service }));
import { DocumentMoveDrawer } from './DocumentMoveDrawer';
afterEach(cleanup);

it('mantém a gaveta utilizável quando a persistência remota rejeita', async () => {
  service.getDrawerState.mockResolvedValue(true);
  service.setDrawerState.mockRejectedValue(new Error('Sem conexão'));
  render(<DocumentMoveDrawer
    targets={[{ key: 'root', label: 'Raiz', targetFolder: null, description: '' }]}
    dropTargetKey={null} storageKey="pessoal" canDropOnFolder={() => true}
    onDropItem={() => {}} onDropTargetChange={() => {}}
  />);
  await waitFor(() => expect(service.setDrawerState).toHaveBeenCalledWith('pessoal', true));
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar destinos para mover' }));
  await waitFor(() => expect(service.setDrawerState).toHaveBeenCalledWith('pessoal', false));
  expect(screen.getByRole('button', { name: 'Abrir destinos para mover documentos' })).toBeTruthy();
});
