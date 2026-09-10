import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.6";
import { handleImportWorker } from "./handler.ts";
import type { FiscalRpcClient } from "../fiscal-integration/emission-action.ts";

// JWT gateway validation is disabled only for this worker. A single-use job capability is claimed atomically by the handler.
Deno.serve(async (req: Request) => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("unavailable");
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as FiscalRpcClient;
    return await handleImportWorker(req, admin);
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Servico de importacao indisponivel.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }
});
