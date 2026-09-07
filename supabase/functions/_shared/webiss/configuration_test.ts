import { configurationBlockers } from "./configuration.ts";
const cfg = {
  inscricaoMunicipal: "123", codigoCnae: "6920601", codigoServico: "1719", itemListaServico: "17.19 - Contabilidade",
  serieRps: "A", proximoNumeroRps: "10", optanteSimplesNacional: "2", issRetido: "2 - Nao",
  naturezaOperacao: "1 - Exigivel", incentivadorCultural: "2 - Nao", regimeEspecial: "0", aliquotaIss: "5",
};
Deno.test("Readiness exige opcoes fiscais validas, inclusive responsavel retencao", () => {
  if (configurationBlockers(cfg).length) throw new Error("Configuracao valida rejeitada");
  if (!configurationBlockers({ ...cfg, optanteSimplesNacional: "9" }).some((item) => item.includes("Simples"))) throw new Error("Simples invalido aceito");
  if (!configurationBlockers({ ...cfg, issRetido: "1" }).some((item) => item.includes("responsavel"))) throw new Error("Retencao incompleta aceita");
  if (!configurationBlockers({ ...cfg, proximoNumeroRps: "1a" }).some((item) => item.includes("numero RPS"))) throw new Error("RPS invalido aceito");
});
