const supported = new Set([
  "valor", "aliquotaIss", "issRetido", "responsavelRetencao", "exigibilidadeIss",
  "incentivoFiscal", "codigoMunicipio", "itemListaServico", "descricao", "codigoCnae",
  "codigoTributacaoMunicipio", "competencia", "municipioIncidencia", "codigoNbs",
  "regimeEspecial", "optanteSimplesNacional",
  // Draft fields mapped into RPS/customer by the preparation RPC.
  "dataEmissao", "tomadorNumero", "tomadorCodigoMunicipio",
]);
const monetary = /^(valor(deducoes|pis|cofins|inss|ir|csll|outrasretencoes|iss|issretido)|desconto(condicionado|incondicionado)|retencao(inss|pis|cofins|ir|csll))$/i;
const absent = (value: unknown) => value === null || value === undefined || value === "";
const empty = (value: unknown) => absent(value)
  || (typeof value === "string" && !value.trim())
  || (typeof value === "object" && value !== null && Object.keys(value).length === 0);

/** Never silently drop taxes or classifications that the builder cannot emit. */
export function assertSupportedRpsScope(prepared: Record<string, unknown>, service: Record<string, unknown>) {
  for (const [key, value] of Object.entries(service)) {
    if (supported.has(key) || empty(value)) continue;
    const normalized = key.replace(/_/g, "");
    if (monetary.test(normalized) && (value === 0 || (typeof value === "string" && /^0+(?:[.,]0+)?$/.test(value.trim())))) continue;
    // Do not echo supplied values in the attempt log (which may contain XML).
    throw new Error("Cenario fiscal contem campos ainda nao suportados pelo emissor WebISS. Revise tributos, descontos e grupos adicionais.");
  }
  for (const key of ["IBSCBS", "ibscbs", "intermediario", "Intermediario", "construcaoCivil", "ConstrucaoCivil", "RpsSubstituido", "rpsSubstituido"]) {
    if (!empty(prepared[key])) throw new Error("Grupo fiscal adicional ainda nao suportado pelo emissor WebISS.");
  }
}
