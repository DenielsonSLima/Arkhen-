import type { PreparedInterCharge } from "./charge-payload.ts";
import type { InterEndpoints } from "./types.ts";

const requireCompleteAddress = (prepared: PreparedInterCharge) => {
  const { cliente } = prepared;
  if (
    !cliente.endereco || !cliente.numero || !cliente.bairro ||
    !cliente.cidade || !/^[A-Z]{2}$/.test(cliente.uf) ||
    !/^\d{8}$/.test(cliente.cep)
  ) {
    throw new Error(
      "Endereco completo do pagador e obrigatorio para emitir BolePix.",
    );
  }
};

export const getBolePixChargeUrl = (endpoints: InterEndpoints) => (
  `${endpoints.boletoUrl}/cobrancas`
);

export const getBolePixDetailUrl = (
  endpoints: InterEndpoints,
  codigoSolicitacao: string,
) =>
  `${endpoints.boletoUrl}/cobrancas/${encodeURIComponent(codigoSolicitacao)}`;

export const getBolePixPdfUrl = (
  endpoints: InterEndpoints,
  codigoSolicitacao: string,
) => `${getBolePixDetailUrl(endpoints, codigoSolicitacao)}/pdf`;

export const getBolePixCancelUrl = (
  endpoints: InterEndpoints,
  codigoSolicitacao: string,
) => `${getBolePixDetailUrl(endpoints, codigoSolicitacao)}/cancelar`;

export const buildBolePixPayload = (
  prepared: PreparedInterCharge,
  referenceHash: string,
) => {
  requireCompleteAddress(prepared);
  const { cliente, cobranca } = prepared;
  if (cobranca.valor < 2.5) {
    throw new Error("O valor minimo para BolePix no Banco Inter e R$ 2,50.");
  }

  const phone = cliente.phone.length >= 10
    ? { ddd: cliente.phone.slice(0, 2), telefone: cliente.phone.slice(2) }
    : {};
  const pagador: Record<string, unknown> = {
    cpfCnpj: cliente.cpfCnpj,
    tipoPessoa: cliente.cpfCnpj.length === 11 ? "FISICA" : "JURIDICA",
    nome: cliente.name,
    endereco: cliente.endereco,
    numero: cliente.numero,
    bairro: cliente.bairro,
    cidade: cliente.cidade,
    uf: cliente.uf,
    cep: cliente.cep,
    ...phone,
  };
  if (cliente.email) pagador.email = cliente.email;

  const payload: Record<string, unknown> = {
    seuNumero: referenceHash.slice(0, 15).toUpperCase(),
    valorNominal: Number(cobranca.valor.toFixed(2)),
    dataVencimento: cobranca.dataVencimento,
    numDiasAgenda: 30,
    pagador,
    formasRecebimento: cobranca.meioPagamento === "Ambos"
      ? ["BOLETO", "PIX"]
      : ["BOLETO"],
  };

  if (cobranca.descontoPercentual > 0) {
    payload.desconto = {
      codigo: "PERCENTUALDATAINFORMADA",
      taxa: cobranca.descontoPercentual,
      quantidadeDias: 0,
    };
  }
  if (cobranca.multaPercentual > 0) {
    payload.multa = {
      codigo: "PERCENTUAL",
      taxa: cobranca.multaPercentual,
    };
  }
  if (cobranca.jurosPercentual > 0) {
    payload.mora = {
      codigo: "TAXAMENSAL",
      taxa: cobranca.jurosPercentual,
    };
  }
  const message = cobranca.mensagemBoleto || cobranca.descricao;
  if (message) payload.mensagem = { linha1: message.slice(0, 78) };
  return payload;
};
