import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ upsert: vi.fn(), setItem: vi.fn() }));
vi.mock('../../../../../lib/supabase', () => ({ supabase: { from: () => ({ upsert: mock.upsert }) } }));
vi.mock('../../../../../lib/persistedStorage', () => ({ persistedStorage: { setItem: mock.setItem } }));
import { xmlModelosService, DEFAULT_XML_MODELOS } from './xmlModelosService';
beforeEach(() => vi.clearAllMocks());
it('recusa sucesso e cache definitivo quando banco rejeita a gravação', async () => {
  mock.upsert.mockResolvedValue({ error: { message: 'permission denied' } });
  await expect(xmlModelosService.save(DEFAULT_XML_MODELOS)).rejects.toThrow('permission denied');
  expect(mock.setItem).not.toHaveBeenCalled();
});
