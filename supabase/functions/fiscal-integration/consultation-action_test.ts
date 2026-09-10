import { handleConsultationAction } from "./consultation-action.ts";
import { safeConsultationDiagnostic } from "../_shared/webiss/consultation-error.ts";
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
Deno.test("acao classifica prepare certificado e cache sem vazar mensagem RPC", async () => {
  for (const stage of ["prepare", "certificate", "save"]) {
    let calls = 0;
    const admin = {
      rpc: () => {
        calls++;
        return Promise.resolve(
          stage === "prepare" || (stage === "save" && calls === 2)
            ? {
              data: null,
              error: { message: "PRIVATE_SECRET", code: "42501" },
            }
            : { data: prepared, error: null },
        );
      },
    };
    let caught: unknown;
    try {
      await handleConsultationAction(admin, "user", payload, {
        ...deps,
        parseCertificate: () => {
          if (stage === "certificate") {
            throw new Error(
              "Certificado PFX/P12 corrompido ou senha incorreta.",
            );
          }
          return {} as FiscalCertificate;
        },
      });
    } catch (error) {
      caught = error;
    }
    const diagnostic = safeConsultationDiagnostic(caught);
    assert(
      diagnostic?.stage === stage &&
        !diagnostic.message.includes("PRIVATE_SECRET"),
    );
    assert(calls === (stage === "save" ? 2 : 1));
  }
});
Deno.test("acao reserva e aguarda intervalo global antes de cada pagina", async () => {
  const events: string[] = [];
  const admin = {
    rpc: (name: string, args?: Record<string, unknown>) => {
      events.push(name);
      if (name === "reservar_intervalo_consulta_webiss") {
        assert(args?.p_ambiente === payload.ambiente);
        return Promise.resolve({ data: { aguardarMs: 3000 }, error: null });
      }
      return Promise.resolve({ data: prepared, error: null });
    },
  };
  await handleConsultationAction(admin, "user", payload, {
    ...deps,
    wait: async (ms) => {
      assert(ms === 3000);
      events.push("wait");
    },
    collect: async (
      _context,
      _period,
      _certificate,
      _requestPage,
      beforeRequest,
    ) => {
      await beforeRequest!();
      events.push("page1");
      await beforeRequest!();
      events.push("page2");
      return deps.collect();
    },
  });
  assert(
    events.join(",") ===
      "preparar_consulta_parceiro_webiss,reservar_intervalo_consulta_webiss,wait,page1,reservar_intervalo_consulta_webiss,wait,page2,registrar_notas_consultadas_webiss",
  );
});
Deno.test("acao recusa gate RPC invalido sem esperar consultar ou salvar", async () => {
  for (
    const data of [{ aguardarMs: -1 }, { aguardarMs: 60001 }, {
      aguardarMs: "3000",
    }, null]
  ) {
    let calls = 0, waited = false;
    const admin = {
      rpc: () => {
        calls++;
        return Promise.resolve({
          data: calls === 1 ? prepared : data,
          error: null,
        });
      },
    };
    let caught: unknown;
    try {
      await handleConsultationAction(admin, "user", payload, {
        ...deps,
        wait: async () => {
          waited = true;
        },
        collect: async (
          _context,
          _period,
          _certificate,
          _requestPage,
          beforeRequest,
        ) => {
          await beforeRequest!();
          return deps.collect();
        },
      });
    } catch (error) {
      caught = error;
    }
    assert(
      safeConsultationDiagnostic(caught)?.code === "TRANSPORT_GATE" &&
        calls === 2 && !waited,
    );
  }
});
