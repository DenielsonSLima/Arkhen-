import { createClient } from "https://esm.sh/@supabase/supabase-js@2.109.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) => (
  new Response(JSON.stringify(payload), { status, headers: corsHeaders })
);

interface InvitePayload {
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
  perfil: string;
  accessConfig?: {
    enabled?: boolean;
    days?: number[];
    intervals?: Array<{ start?: string; end?: string }>;
    message?: string;
  };
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const requiredText = (value: unknown, label: string, maxLength: number) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} é obrigatório.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label} excede o tamanho permitido.`);
  }
  return normalized;
};

const normalizeEmail = (value: unknown) => {
  const email = requiredText(value, "E-mail", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  return email;
};

const optionalText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error("Um dos campos excede o tamanho permitido.");
  }
  return normalized;
};

const normalizeTime = (value: unknown, fallback: string) => (
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback
);

const normalizeAccessConfig = (value: unknown) => {
  const config = asRecord(value);
  const rawDays = Array.isArray(config.days) ? config.days : [1, 2, 3, 4, 5];
  const days = [
    ...new Set(
      rawDays.map(Number).filter((day) =>
        Number.isInteger(day) && day >= 0 && day <= 6
      ),
    ),
  ];
  const rawIntervals = Array.isArray(config.intervals)
    ? config.intervals.slice(0, 4)
    : [];
  const intervals = rawIntervals.map((item) => {
    const interval = asRecord(item);
    return {
      start: normalizeTime(interval.start, "08:00"),
      end: normalizeTime(interval.end, "18:00"),
    };
  }).filter((item) => item.start < item.end);

  return {
    enabled: config.enabled === true,
    days: days.length > 0 ? days.sort() : [1, 2, 3, 4, 5],
    intervals: intervals.length > 0
      ? intervals
      : [{ start: "08:00", end: "18:00" }],
    message: optionalText(config.message, 240) ||
      "Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor.",
  };
};

const membershipRoleForProfileCode = (profileCode: unknown) => (
  typeof profileCode === "string" &&
    ["administrador", "gestor"].includes(profileCode.trim().toLowerCase())
    ? "admin"
    : "membro"
);

const parsePayload = async (req: Request): Promise<InvitePayload> => {
  const raw = await req.text();
  if (raw.length > 32 * 1024) {
    throw new Error("Payload excede o tamanho permitido.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Payload JSON inválido.");
  }
  const input = asRecord(parsed);
  return {
    nome: requiredText(input.nome, "Nome", 160),
    email: normalizeEmail(input.email),
    cpf: optionalText(input.cpf, 20) || undefined,
    telefone: optionalText(input.telefone, 30) || undefined,
    perfil: requiredText(input.perfil, "Perfil", 80),
    accessConfig: normalizeAccessConfig(input.accessConfig),
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const authorization = req.headers.get("Authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return jsonResponse({
      ok: false,
      error: "Serviço de convites indisponível.",
    }, 503);
  }
  if (!jwt) return jsonResponse({ ok: false, error: "Sessão ausente." }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await adminClient.auth.getUser(
    jwt,
  );
  if (authError || !authData.user) {
    return jsonResponse({ ok: false, error: "Sessão inválida." }, 401);
  }

  try {
    const input = await parsePayload(req);
    const { data: empresaId, error: empresaError } = await userClient.rpc(
      "current_empresa_id",
    );
    if (empresaError || typeof empresaId !== "string") {
      throw new Error("Empresa ativa não encontrada.");
    }

    const { data: isAdmin, error: permissionError } = await userClient.rpc(
      "current_user_is_empresa_admin",
      { p_empresa_id: empresaId },
    );
    if (permissionError || isAdmin !== true) {
      return jsonResponse({
        ok: false,
        error:
          "Somente administradores podem convidar e definir perfis de acesso.",
      }, 403);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("configuracoes_perfis_acesso")
      .select("id,nome,codigo")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .eq("nome", input.perfil)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error("Selecione um perfil de acesso ativo desta empresa.");
    }
    const membershipRole = membershipRoleForProfileCode(profile.codigo);

    const { data: existingConfig, error: existingError } = await adminClient
      .from("configuracoes_usuarios")
      .select(
        "id,auth_user_id,perfil_id,nome,email,cpf,telefone,perfil,status,access_config",
      )
      .eq("empresa_id", empresaId)
      .ilike("email", input.email)
      .maybeSingle();
    if (existingError) {
      throw new Error("Não foi possível verificar o usuário existente.");
    }
    if (existingConfig?.auth_user_id) {
      throw new Error("Este e-mail já possui acesso vinculado à empresa.");
    }

    const appOrigin = (Deno.env.get("APP_URL") || "https://arkhen.vercel.app")
      .replace(/\/+$/, "");
    const { data: invited, error: inviteError } = await adminClient.auth.admin
      .inviteUserByEmail(
        input.email,
        {
          redirectTo: `${appOrigin}/redefinir-senha`,
          data: {
            nome: input.nome,
            empresa_id: empresaId,
            convite_arkhen: true,
          },
        },
      );
    if (inviteError || !invited.user) {
      throw new Error(
        "Não foi possível enviar o convite. Verifique se o e-mail já possui uma conta.",
      );
    }

    const { data: membership, error: membershipError } = await adminClient
      .from("perfis")
      .insert({
        user_id: invited.user.id,
        empresa_id: empresaId,
        nome: input.nome,
        papel: membershipRole,
        ativo: true,
      })
      .select("id")
      .single();

    if (membershipError || !membership) {
      const { error: authRollbackError } = await adminClient.auth.admin
        .deleteUser(invited.user.id, false);
      if (authRollbackError) {
        console.error(
          "[invite-accounting-user] Falha no rollback do Auth após erro de membership.",
        );
      }
      throw new Error(
        "O convite não pôde ser vinculado à empresa. Nenhum acesso foi concedido.",
      );
    }

    const payload = {
      empresa_id: empresaId,
      auth_user_id: invited.user.id,
      perfil_id: membership.id,
      nome: input.nome,
      email: input.email,
      cpf: input.cpf || null,
      telefone: input.telefone || null,
      perfil: profile.nome,
      status: "Ativo",
      access_config: input.accessConfig,
    };
    const query = existingConfig?.id
      ? adminClient.from("configuracoes_usuarios").update(payload).eq(
        "id",
        existingConfig.id,
      )
      : adminClient.from("configuracoes_usuarios").insert(payload);
    const { data: saved, error: saveError } = await query
      .select(
        "id,auth_user_id,nome,email,cpf,telefone,perfil,status,access_config,ultimo_acesso_em,created_at",
      )
      .single();

    if (saveError || !saved) {
      const rollbackResults = await Promise.all([
        adminClient.from("perfis").delete().eq("id", membership.id).eq(
          "empresa_id",
          empresaId,
        ),
        existingConfig?.id
          ? adminClient.from("configuracoes_usuarios").update({
            auth_user_id: existingConfig.auth_user_id,
            perfil_id: existingConfig.perfil_id,
            nome: existingConfig.nome,
            email: existingConfig.email,
            cpf: existingConfig.cpf,
            telefone: existingConfig.telefone,
            perfil: existingConfig.perfil,
            status: existingConfig.status,
            access_config: existingConfig.access_config,
          }).eq("id", existingConfig.id).eq("empresa_id", empresaId)
          : adminClient.from("configuracoes_usuarios")
            .delete()
            .eq("empresa_id", empresaId)
            .eq("auth_user_id", invited.user.id),
      ]);
      const { error: authRollbackError } = await adminClient.auth.admin
        .deleteUser(invited.user.id, false);
      if (rollbackResults.some((result) => result.error) || authRollbackError) {
        console.error(
          "[invite-accounting-user] Rollback incompleto; revisão administrativa necessária.",
        );
      }
      throw new Error(
        "O convite não pôde ser vinculado à empresa. O acesso foi revertido.",
      );
    }

    return jsonResponse(
      { ok: true, usuario: saved, conviteEnviado: true },
      201,
    );
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error
        ? error.message
        : "Não foi possível convidar o usuário.",
    }, 400);
  }
});
