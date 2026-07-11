export interface AccountingProRataParams {
  valorMensal: number;
  diasTotais: number;
  diasTrabalhados: number;
}

export interface AccountingJurosParams {
  capital: number;
  taxaMensal: number; // em porcentagem, ex: 2 para 2%
  tempoMeses: number;
}

export interface AccountingMultaParams {
  valor: number;
  taxaMulta: number; // em porcentagem
}

export interface AccountingLiquidoBrutoParams {
  valor: number;
  taxaDesconto: number; // em porcentagem
  isBrutoParaLiquido: boolean;
}

export interface TaxCalculoParams {
  baseCalculo: number;
  aliquota: number; // em porcentagem
}

export interface TaxAtrasoParams {
  valorOriginal: number;
  diasAtraso: number;
  taxaMultaDiaria?: number; // padrão 0.33% ao dia
  limiteMulta?: number; // padrão 20%
  taxaJurosMensal?: number; // padrão 1% ao mês ou proporcional
}

export const calculatorService = {
  // --- CALCULADORA NORMAL ---
  calcularNormal(operacao: string, a: number, b: number): number {
    switch (operacao) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : Number.NaN;
      case '%': return (a * b) / 100;
      default: return 0;
    }
  },

  // --- CALCULADORA CONTÁBIL ---
  calcularAcrescimoPercentual(valor: number, percentual: number): number {
    return valor * (1 + percentual / 100);
  },

  calcularDescontoPercentual(valor: number, percentual: number): number {
    return valor * (1 - percentual / 100);
  },

  calcularRegraDeTres(a: number, b: number, c: number): number {
    // Se A está para B, assim como C está para X. Então X = (B * C) / A
    if (a === 0) return 0;
    return (b * c) / a;
  },

  calcularProRata(params: AccountingProRataParams): number {
    const { valorMensal, diasTotais, diasTrabalhados } = params;
    if (diasTotais <= 0) return 0;
    return (valorMensal / diasTotais) * diasTrabalhados;
  },

  calcularJurosSimples(params: AccountingJurosParams): { juros: number; total: number } {
    const { capital, taxaMensal, tempoMeses } = params;
    const juros = capital * (taxaMensal / 100) * tempoMeses;
    return {
      juros,
      total: capital + juros
    };
  },

  calcularMultaSimples(params: AccountingMultaParams): number {
    const { valor, taxaMulta } = params;
    return valor * (taxaMulta / 100);
  },

  calcularLiquidoBruto(params: AccountingLiquidoBrutoParams): number {
    const { valor, taxaDesconto, isBrutoParaLiquido } = params;
    if (isBrutoParaLiquido) {
      // Valor Líquido = Bruto * (1 - taxa)
      return valor * (1 - taxaDesconto / 100);
    } else {
      // Valor Bruto = Líquido / (1 - taxa)
      const divisor = 1 - taxaDesconto / 100;
      if (divisor <= 0) return 0;
      return valor / divisor;
    }
  },

  // --- CALCULADORA TRIBUTÁRIA / FISCAL ---
  calcularImpostoPorAliquota(params: TaxCalculoParams): { imposto: number; total: number } {
    const { baseCalculo, aliquota } = params;
    const imposto = baseCalculo * (aliquota / 100);
    return {
      imposto,
      total: baseCalculo + imposto
    };
  },

  calcularBaseDeCalculo(valorComImposto: number, aliquota: number): number {
    // Base = Valor com Imposto / (1 + Aliquota/100) ou (1 - Aliquota/100) dependendo se é "por dentro" ou "por fora".
    // Por padrão faremos por fora: Base = Valor / (1 + Aliquota/100)
    const divisor = 1 + aliquota / 100;
    if (divisor <= 0) return 0;
    return valorComImposto / divisor;
  },

  calcularValorSemImposto(valorTotal: number, aliquota: number): number {
    return this.calcularBaseDeCalculo(valorTotal, aliquota);
  },

  calcularRetencao(valorBruto: number, tipoRetencao: 'csrf' | 'irrf' | 'iss' | 'inss' | 'custom', aliquotaCustom?: number): {
    aliquota: number;
    valorRetido: number;
    valorLiquido: number;
  } {
    let aliquota = 0;
    switch (tipoRetencao) {
      case 'csrf':
        aliquota = 4.65; // PIS/COFINS/CSLL retido na fonte
        break;
      case 'irrf':
        aliquota = 1.5; // Alíquota comum IRRF serviços profissionais
        break;
      case 'iss':
        aliquota = 5.0; // Alíquota máxima de ISS
        break;
      case 'inss':
        aliquota = 11.0; // Alíquota INSS contribuinte individual
        break;
      case 'custom':
        aliquota = aliquotaCustom || 0;
        break;
    }

    const valorRetido = valorBruto * (aliquota / 100);
    return {
      aliquota,
      valorRetido,
      valorLiquido: valorBruto - valorRetido
    };
  },

  calcularAtraso(params: TaxAtrasoParams): {
    multa: number;
    juros: number;
    total: number;
  } {
    const {
      valorOriginal,
      diasAtraso,
      taxaMultaDiaria = 0.33,
      limiteMulta = 20,
      taxaJurosMensal = 1
    } = params;

    if (diasAtraso <= 0) {
      return { multa: 0, juros: 0, total: valorOriginal };
    }

    // Cálculo da multa: 0.33% ao dia limitado a 20%
    const calculoMultaPercent = Math.min(diasAtraso * taxaMultaDiaria, limiteMulta);
    const multa = valorOriginal * (calculoMultaPercent / 100);

    // Cálculo do juros: 1% ao mês (ou proporcional de forma simples: 1% para cada mês cheio ou fração)
    // Usaremos juros simples proporcional aos dias: (diasAtraso / 30) * taxaJurosMensal
    const jurosPercent = (diasAtraso / 30) * taxaJurosMensal;
    const juros = valorOriginal * (jurosPercent / 100);

    return {
      multa,
      juros,
      total: valorOriginal + multa + juros
    };
  }
};
