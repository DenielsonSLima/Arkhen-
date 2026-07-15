import type { PreparedInterCharge } from "./charge-payload.ts";
import type { InterEndpoints } from "./types.ts";

export const getPixDueChargeUrl = (
  endpoints: InterEndpoints,
  txid: string,
) => `${endpoints.pixUrl}/cobv/${encodeURIComponent(txid)}`;

export const buildPixDuePayload = (prepared: PreparedInterCharge) => {
  const { cliente, cobranca, config } = prepared;
  const chavePix = config.chavePix?.trim() || "";
  if (!chavePix || chavePix.length > 77) {
    throw new Error("Chave Pix do Banco Inter ausente ou invalida.");
  }

  const devedor: Record<string, string> = {
    nome: cliente.name,
    [cliente.cpfCnpj.length === 11 ? "cpf" : "cnpj"]: cliente.cpfCnpj,
  };
  if (cliente.endereco) devedor.logradouro = cliente.endereco;
  if (cliente.cidade) devedor.cidade = cliente.cidade;
  if (cliente.uf) devedor.uf = cliente.uf;
  if (cliente.cep) devedor.cep = cliente.cep;

  const valor: Record<string, unknown> = {
    original: cobranca.valor.toFixed(2),
  };
  if (cobranca.multaPercentual > 0) {
    valor.multa = {
      modalidade: "2",
      valorPerc: cobranca.multaPercentual.toFixed(2),
    };
  }
  if (cobranca.jurosPercentual > 0) {
    valor.juros = {
      modalidade: "2",
      valorPerc: cobranca.jurosPercentual.toFixed(2),
    };
  }
  if (cobranca.descontoPercentual > 0) {
    valor.desconto = {
      modalidade: "1",
      descontoDataFixa: [{
        data: cobranca.dataVencimento,
        valorPerc: cobranca.descontoPercentual.toFixed(2),
      }],
    };
  }

  return {
    calendario: {
      dataDeVencimento: cobranca.dataVencimento,
      validadeAposVencimento: 30,
    },
    devedor,
    valor,
    chave: chavePix,
    solicitacaoPagador: (cobranca.mensagemBoleto || cobranca.descricao).slice(
      0,
      140,
    ),
  };
};
