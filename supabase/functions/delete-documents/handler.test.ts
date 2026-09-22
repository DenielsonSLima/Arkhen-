import { describe, expect, it, vi } from 'vitest';
import { deleteDocuments, operationIdFor } from './handler';
const row = { operacao_id: 'op', documento_id: 'doc', storage_bucket: 'documentos', storage_path: 'tenant/file' };
const dependencies = () => ({ prepare: vi.fn().mockResolvedValue(undefined), pending: vi.fn().mockResolvedValue([row]), remove: vi.fn().mockResolvedValue(undefined), complete: vi.fn().mockResolvedValue(undefined) });
describe('exclusão documental reconciliável', () => {
  it('FK rejeitada impede qualquer chamada Storage', async () => {
    const dep = dependencies(); dep.prepare.mockRejectedValue(new Error('FK restrict'));
    await expect(deleteDocuments('actor', ['doc'], dep)).rejects.toThrow('FK restrict');
    expect(dep.pending).not.toHaveBeenCalled(); expect(dep.remove).not.toHaveBeenCalled();
  });
  it('falha Storage preserva pendência sem confirmar', async () => {
    const dep = dependencies(); dep.remove.mockRejectedValue(new Error('timeout'));
    await expect(deleteDocuments('actor', ['doc'], dep)).rejects.toThrow('timeout');
    expect(dep.complete).not.toHaveBeenCalled();
  });
  it('retry após remoção confirmada mas resposta perdida repete somente limpeza idempotente', async () => {
    const dep = dependencies(); dep.complete.mockRejectedValueOnce(new Error('timeout'));
    await expect(deleteDocuments('actor', ['doc'], dep)).rejects.toThrow('timeout');
    await expect(deleteDocuments('actor', ['doc'], dep)).resolves.toEqual({ ok: true });
    expect(dep.prepare.mock.calls[0][0]).toBe(dep.prepare.mock.calls[1][0]);
    expect(dep.remove).toHaveBeenCalledTimes(2);
  });
  it('retomada sem seleção processa apenas fila do servidor', async () => {
    const dep = dependencies(); await deleteDocuments('actor', [], dep);
    expect(dep.prepare).not.toHaveBeenCalled(); expect(dep.remove).toHaveBeenCalledWith('documentos', 'tenant/file');
  });
  it('idempotência é isolada pelo ator', async () => {
    expect(await operationIdFor('a', ['doc'])).not.toBe(await operationIdFor('b', ['doc']));
  });
});
