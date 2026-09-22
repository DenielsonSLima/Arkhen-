type Row = { operacao_id: string; documento_id: string; storage_bucket: string; storage_path: string };
export interface DeletionDependencies {
  prepare: (operationId: string, documentIds: string[]) => Promise<void>;
  pending: () => Promise<Row[]>;
  remove: (bucket: string, path: string) => Promise<void>;
  complete: (row: Row) => Promise<void>;
}

export const operationIdFor = async (actor: string, ids: string[]) => {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${actor}:${ids.join(',')}`)));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};

export const deleteDocuments = async (actor: string, ids: string[], dependencies: DeletionDependencies) => {
  const unique = [...new Set(ids)].sort();
  if (unique.length) await dependencies.prepare(await operationIdFor(actor, unique), unique);
  // Durable queue remains pending if storage or confirmation fails. Removal and
  // confirmation are idempotent, including timeout after successful removal.
  const pending = await dependencies.pending();
  for (const row of pending) {
    if (row.storage_bucket !== 'documentos' || !row.storage_path) throw new Error('Fila de exclusão inválida.');
    await dependencies.remove(row.storage_bucket, row.storage_path);
    await dependencies.complete(row);
  }
  return { ok: true };
};
