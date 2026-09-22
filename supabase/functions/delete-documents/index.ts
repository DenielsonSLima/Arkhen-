import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.6';
import { assertManagedCredentialVersion } from '../_shared/managed-auth.ts';
import { deleteDocuments } from './handler.ts';
import { readLimitedRequestText } from '../_shared/inter/validation.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return response({ ok: false }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key || !anon) return response({ ok: false }, 503);
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return response({ ok: false }, 401);
  try { assertManagedCredentialVersion(jwt, data.user); } catch { return response({ ok: false }, 401); }
  const actor = data.user.id;
  const user = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  try {
    const body = JSON.parse(await readLimitedRequestText(req, 8192));
    if (!body || Array.isArray(body) || Object.keys(body).some((k) => k !== 'documentIds')) throw new Error('Requisição inválida.');
    const ids = body.documentIds;
    if (!Array.isArray(ids) || ids.length > 100 || ids.some((id: unknown) => typeof id !== 'string' || !UUID.test(id))) throw new Error('Seleção inválida.');
    // Even a cleanup-only request must have a currently authorized session.
    const access = await user.rpc('current_empresa_id');
    if (access.error || !access.data) throw new Error('Sessão sem acesso ativo.');
    const membership = await user.rpc('is_empresa_member', { p_empresa_id: access.data });
    if (membership.error || membership.data !== true) throw new Error('Sessão sem acesso ativo.');
    return response(await deleteDocuments(actor, ids, {
      prepare: async (id, documentIds) => {
        const result = await user.rpc('preparar_exclusao_documentos', { p_operacao_id: id, p_documento_ids: documentIds });
        if (result.error) throw new Error(result.error.code === '23503' ? 'Documento vinculado a uma solicitação. Nenhum arquivo foi removido.' : 'Não foi possível autorizar a exclusão. Nenhum arquivo foi removido.');
      },
      pending: async () => {
        const result = await admin.rpc('listar_arquivos_exclusao_pendentes', { p_actor_id: actor });
        if (result.error) throw new Error('Exclusão registrada. A limpeza será retomada ao abrir Documentos.');
        return result.data || [];
      },
      remove: async (bucket, path) => {
        const result = await admin.storage.from(bucket).remove([path]);
        if (result.error) throw new Error('Exclusão registrada. A limpeza será retomada ao abrir Documentos.');
      },
      complete: async (row) => {
        const result = await admin.rpc('confirmar_limpeza_documento', { p_actor_id: actor, p_operacao_id: row.operacao_id, p_documento_id: row.documento_id });
        if (result.error || result.data !== true) throw new Error('Exclusão registrada. A confirmação da limpeza será retomada.');
      },
    }));
  } catch (error) {
    return response({ ok: false, error: error instanceof Error ? error.message : 'Não foi possível concluir a exclusão.' }, 400);
  }
});
