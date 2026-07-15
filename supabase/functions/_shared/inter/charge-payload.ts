import type { InterEnvironment, InterPreparedConfig } from "./types.ts";
import { asRecord, asString, parsePreparedConfig } from "./validation.ts";

export interface InterChargeCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface InterChargeData {
  clienteEmpresaId: string;
  contratoId: string;
  descricao: string;
  categoria: string;
  valor: number;
  dataVencimento: string;
  meioPagamento: "Pix" | "Boleto" | "Ambos";
  descontoPercentual: number;
  jurosPercentual: number;
  multaPercentual: number;
  mensagemBoleto: string;
}

export interface PreparedInterCharge {
  ambienteDb: "producao" | "homologacao";
  ambienteApi: InterEnvironment;
  config: InterPreparedConfig;
  cliente: InterChargeCustomer;
  cobranca: InterChargeData;
}

const numberBetween = (value: unknown, minimum: number, maximum: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, minimum), maximum);
};

const requireText = (label: string, value: unknown, maximum: number) => {
  const text = asString(value);
  if (!text || text.length > maximum || text.includes("\0")) {
    throw new Error(`${label} ausente ou invalido.`);
  }
  return text;
};

const onlyDigits = (value: unknown) => asString(value).replace(/\D/g, "");

const parsePaymentMethod = (
  value: unknown,
): InterChargeData["meioPagamento"] => {
  const method = asString(value).toLowerCase();
  if (method === "pix") return "Pix";
  if (method === "boleto") return "Boleto";
  if (method === "ambos") return "Ambos";
  throw new Error("Meio de pagamento nao suportado pelo Banco Inter.");
};

export const parsePreparedInterCharge = (
  value: unknown,
): PreparedInterCharge => {
  const prepared = asRecord(value);
  const customer = asRecord(prepared.cliente);
  const charge = asRecord(prepared.cobranca);
  const ambienteDb = asString(prepared.ambiente).toLowerCase() === "producao"
    ? "producao"
    : "homologacao";
  const cpfCnpj = onlyDigits(customer.cpfCnpj);
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new Error("CPF/CNPJ do pagador invalido para o Banco Inter.");
  }

  const valor = Number(charge.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor da cobranca invalido.");
  }
  const dataVencimento = requireText(
    "Data de vencimento",
    charge.dataVencimento,
    10,
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento)) {
    throw new Error("Data de vencimento invalida.");
  }

  const config = parsePreparedConfig(prepared);
  config.chavePix = asString(prepared.chavePix || prepared.chave_pix);
  config.webhookId = asString(prepared.webhookId || prepared.webhook_id);

  return {
    ambienteDb,
    ambienteApi: ambienteDb === "producao" ? "producao" : "sandbox",
    config,
    cliente: {
      id: requireText("Cliente", customer.id, 64),
      name: requireText("Nome do pagador", customer.name, 120),
      cpfCnpj,
      email: asString(customer.email).slice(0, 120),
      phone: onlyDigits(customer.phone).slice(0, 20),
      endereco: asString(customer.endereco).slice(0, 120),
      numero: asString(customer.numero).slice(0, 20),
      bairro: asString(customer.bairro).slice(0, 60),
      cidade: asString(customer.cidade).slice(0, 60),
      uf: asString(customer.uf).toUpperCase().slice(0, 2),
      cep: onlyDigits(customer.cep).slice(0, 8),
    },
    cobranca: {
      clienteEmpresaId: requireText(
        "Cliente da cobranca",
        charge.clienteEmpresaId,
        64,
      ),
      contratoId: asString(charge.contratoId),
      descricao: requireText("Descricao", charge.descricao, 500),
      categoria: asString(charge.categoria) || "Faturamento",
      valor,
      dataVencimento,
      meioPagamento: parsePaymentMethod(charge.meioPagamento),
      descontoPercentual: numberBetween(charge.descontoPercentual, 0, 100),
      jurosPercentual: numberBetween(charge.jurosPercentual, 0, 100),
      multaPercentual: numberBetween(charge.multaPercentual, 0, 100),
      mensagemBoleto: asString(charge.mensagemBoleto).slice(0, 220),
    },
  };
};

export const formatMoney = (value: number) => value.toFixed(2);

export const buildDeterministicReference = async (
  payload: Record<string, unknown>,
  prepared: PreparedInterCharge,
) => {
  const source = [
    asString(payload.request_id),
    asString(payload.external_reference),
    prepared.cobranca.contratoId,
    prepared.cobranca.clienteEmpresaId,
    prepared.cobranca.dataVencimento,
    formatMoney(prepared.cobranca.valor),
  ].join("|");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};
