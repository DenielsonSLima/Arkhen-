import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.6";
import { assertManagedCredentialVersion } from "../_shared/managed-auth.ts";
import { jsonResponse } from "../_shared/inter/http.ts";
import { handleRecurrenceWorker } from "./handler.ts";

// Gateway verify_jwt=false allows the dedicated cron capability. User requests
// still verify JWT+managed credentials and tenant permission before any claim.
Deno.serve(async (request: Request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return jsonResponse({ ok: false, error: "Servico indisponivel." }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return await handleRecurrenceWorker(request, admin, {
    productionEnabled: Deno.env.get("WEBISS_DRAFT_PRODUCTION_ENABLED") === "true",
    authorize: async (req, executionId) => {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!jwt) throw new Error("Sessao ausente.");
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user) throw new Error("Sessao invalida.");
      assertManagedCredentialVersion(jwt, data.user);
      const user = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const permission = await user.rpc("autorizar_execucao_recorrencia", { p_execucao_id: executionId });
      if (permission.error || permission.data?.id !== executionId || !permission.data?.empresaId) throw new Error("Acesso negado.");
      return { empresaId: permission.data.empresaId };
    },
  });
});
