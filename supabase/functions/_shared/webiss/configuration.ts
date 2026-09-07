import { text } from "./xml.ts";

/** Local prerequisites only: this does not prove CeC authorization or acceptance. */
export function configurationBlockers(cfg: Record<string, unknown>) {
  const blockers: string[] = [];
  const check = (valid: boolean, message: string) => { if (!valid) blockers.push(message); };
  check(text(cfg.inscricaoMunicipal).length > 0 && text(cfg.inscricaoMunicipal).length <= 15, "Inscricao municipal deve conter de 1 a 15 caracteres.");
  check(/^\d{7}$/.test(text(cfg.codigoCnae)), "CNAE deve conter 7 digitos.");
  check(text(cfg.codigoServico).length > 0 && text(cfg.codigoServico).length <= 20, "Codigo de servico deve conter de 1 a 20 caracteres.");
  check(/^\d{1,2}\.\d{2}$/.test(text(cfg.itemListaServico).split(" ")[0]), "Informe um item da lista de servico valido.");
  check(/^[A-Za-z0-9]{1,5}$/.test(text(cfg.serieRps)), "Serie RPS deve conter de 1 a 5 letras ou numeros.");
  check(/^[1-9][0-9]{0,14}$/.test(text(cfg.proximoNumeroRps)), "Proximo numero RPS deve ser um inteiro positivo de ate 15 digitos.");
  check(/^[12]$/.test(text(cfg.optanteSimplesNacional)), "Informe explicitamente a opcao pelo Simples Nacional.");
  const retido = text(cfg.issRetido).slice(0, 1);
  check(/^[12]$/.test(retido), "Informe se o ISS e retido.");
  if (retido === "1") check(/^[12]$/.test(text(cfg.responsavelRetencao)), "Informe o responsavel pela retencao do ISS.");
  check(/^[1-7]$/.test(text(cfg.naturezaOperacao).slice(0, 1)), "Informe a exigibilidade do ISS.");
  check(/^[12]$/.test(text(cfg.incentivadorCultural).slice(0, 1)), "Informe a opcao de incentivo fiscal.");
  const regime = text(cfg.regimeEspecial).slice(0, 1);
  check(!regime || /^[0-6]$/.test(regime), "Regime especial invalido.");
  const aliquota = text(cfg.aliquotaIss).replace(",", ".");
  check(!aliquota || (/^\d{1,3}(\.\d{1,4})?$/.test(aliquota) && Number(aliquota) <= 100), "Aliquota ISS invalida.");
  return blockers;
}
