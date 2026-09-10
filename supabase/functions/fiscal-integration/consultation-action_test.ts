import { handleConsultationAction } from "./consultation-action.ts";
import type { FiscalCertificate } from "../_shared/webiss/certificate.ts";
const assert = (value: unknown) => {
  if (!value) throw new Error("Falha na verificacao");
};
const config = "11111111-1111-4111-8111-111111111111",
  customer = "22222222-2222-4222-8222-222222222222";
const payload = {
  fiscalConfigId: config,
  clienteId: customer,
  ambiente: "homologacao",
  dataInicial: "2026-09-01",
  dataFinal: "2026-09-09",
};
const prepared = {
  fiscalConfigId: config,
  clienteId: customer,
  ambiente: "homologacao",
  endpoint: "https://homologacao.webiss.com.br/ws/nfse.asmx",
  prestador: { cnpj: "35898750000107", inscricaoMunicipal: "5938914" },
  tomador: { documento: "28767294000109" },
  certificadoBase64: "SEGREDO",
  certificadoSenha: "SEGREDO",
};
const deps = {
  parseCertificate: () => ({} as FiscalCertificate),
  assertCertificate: () => {},
  collect: async () => ({
    notes: [],
    pagesRead: 1,
    coverage: "complete" as const,
    periodo: { inicio: payload.dataInicial, fim: payload.dataFinal },
    warning: undefined,
  }),
};
Deno.test("acao consulta prepara tenant e persiste cache sem emitir ou devolver segredos", async () => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const admin = {
    rpc: (name: string, args?: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve({
        data: name.startsWith("preparar") ? prepared : [],
        error: null,
      });
    },
  };
  const result = await handleConsultationAction(admin, "user", payload, deps);
  assert(
    calls.map((value) => value.name).join(",") ===
      "preparar_consulta_parceiro_webiss,registrar_notas_consultadas_webiss",
  );
  assert(
    result.notesCount === 0 && !JSON.stringify(result).includes("SEGREDO") &&
      !JSON.stringify(calls[1]).includes("SEGREDO"),
  );
});
Deno.test("acao consulta recusa troca de contexto antes de rede/cache", async () => {
  let calls = 0, collected = false, failed = false;
  const admin = {
    rpc: () => {
      calls++;
      return Promise.resolve({
        data: { ...prepared, ambiente: "producao" },
        error: null,
      });
    },
  };
  try {
    await handleConsultationAction(admin, "user", payload, {
      ...deps,
      collect: async () => {
        collected = true;
        return deps.collect();
      },
    });
  } catch {
    failed = true;
  }
  assert(failed && calls === 1 && !collected);
});
Deno.test("acao consulta falha de transporte nao persiste nem gera nova operacao", async () => {
  let calls = 0, failed = false;
  const admin = {
    rpc: () => {
      calls++;
      return Promise.resolve({ data: prepared, error: null });
    },
  };
  try {
    await handleConsultationAction(admin, "user", payload, {
      ...deps,
      collect: () => {
        throw new Error("timeout");
      },
    });
  } catch {
    failed = true;
  }
  assert(failed && calls === 1);
});
