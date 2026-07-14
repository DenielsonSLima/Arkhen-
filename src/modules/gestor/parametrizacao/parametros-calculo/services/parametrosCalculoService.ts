import { persistedStorage } from '../../../../../lib/persistedStorage';

export interface TipoRescisaoParametro {
  id: string;
  label: string;
  descricao: string;
  geraAvisoPrevio: boolean;
  geraMultaFgts: boolean;
  ativo: boolean;
}

export interface FaixaDasParametro {
  faixa: number;
  limiteSuperior: number;
  aliquota: number;
  deducao: number;
}

export interface AnexoDasParametro {
  id: string;
  label: string;
  descricao: string;
  ativo: boolean;
  faixas: FaixaDasParametro[];
}

export interface RegimePisCofinsParametro {
  id: string;
  label: string;
  descricao: string;
  aliquotaPis: number;
  aliquotaCofins: number;
  permiteCreditoEntrada: boolean;
  ativo: boolean;
}

export interface RegrasGeraisParametro {
  aliquotaFgts: number;
  aliquotaInssPatronal: number;
  provisaoFerias13: number;
  aliquotaSimplesPj: number;
  multaFgtsRescisao: number;
}

export interface ParametrosCalculo {
  version?: number;
  tiposRescisao: TipoRescisaoParametro[];
  anexosDas: AnexoDasParametro[];
  regimesPisCofins: RegimePisCofinsParametro[];
  regrasGerais: RegrasGeraisParametro;
}

const STORAGE_KEY = 'contabil_parametrizacao_parametros_calculo';
const CURRENT_VERSION = 3;
export const PARAMETROS_CALCULO_EVENT = 'contabil:parametros-calculo-updated';

const defaultFaixas: Record<string, FaixaDasParametro[]> = {
  I: [
    { faixa: 1, limiteSuperior: 180000, aliquota: 4.0, deducao: 0 },
    { faixa: 2, limiteSuperior: 360000, aliquota: 7.3, deducao: 5940 },
    { faixa: 3, limiteSuperior: 720000, aliquota: 9.5, deducao: 13860 },
    { faixa: 4, limiteSuperior: 1800000, aliquota: 10.7, deducao: 22500 },
    { faixa: 5, limiteSuperior: 3600000, aliquota: 14.3, deducao: 87300 },
    { faixa: 6, limiteSuperior: 4800000, aliquota: 19.0, deducao: 378000 },
  ],
  II: [
    { faixa: 1, limiteSuperior: 180000, aliquota: 4.5, deducao: 0 },
    { faixa: 2, limiteSuperior: 360000, aliquota: 7.8, deducao: 5940 },
    { faixa: 3, limiteSuperior: 720000, aliquota: 10.0, deducao: 13860 },
    { faixa: 4, limiteSuperior: 1800000, aliquota: 11.2, deducao: 22500 },
    { faixa: 5, limiteSuperior: 3600000, aliquota: 14.7, deducao: 85500 },
    { faixa: 6, limiteSuperior: 4800000, aliquota: 30.0, deducao: 720000 },
  ],
  III: [
    { faixa: 1, limiteSuperior: 180000, aliquota: 6.0, deducao: 0 },
    { faixa: 2, limiteSuperior: 360000, aliquota: 11.2, deducao: 9360 },
    { faixa: 3, limiteSuperior: 720000, aliquota: 13.5, deducao: 17640 },
    { faixa: 4, limiteSuperior: 1800000, aliquota: 16.0, deducao: 35640 },
    { faixa: 5, limiteSuperior: 3600000, aliquota: 21.0, deducao: 125640 },
    { faixa: 6, limiteSuperior: 4800000, aliquota: 33.0, deducao: 648000 },
  ],
  IV: [
    { faixa: 1, limiteSuperior: 180000, aliquota: 4.5, deducao: 0 },
    { faixa: 2, limiteSuperior: 360000, aliquota: 9.0, deducao: 8100 },
    { faixa: 3, limiteSuperior: 720000, aliquota: 10.2, deducao: 12420 },
    { faixa: 4, limiteSuperior: 1800000, aliquota: 14.0, deducao: 39780 },
    { faixa: 5, limiteSuperior: 3600000, aliquota: 22.0, deducao: 183780 },
    { faixa: 6, limiteSuperior: 4800000, aliquota: 33.0, deducao: 828000 },
  ],
  V: [
    { faixa: 1, limiteSuperior: 180000, aliquota: 15.5, deducao: 0 },
    { faixa: 2, limiteSuperior: 360000, aliquota: 18.0, deducao: 4500 },
    { faixa: 3, limiteSuperior: 720000, aliquota: 19.5, deducao: 9900 },
    { faixa: 4, limiteSuperior: 1800000, aliquota: 20.5, deducao: 17100 },
    { faixa: 5, limiteSuperior: 3600000, aliquota: 23.0, deducao: 62100 },
    { faixa: 6, limiteSuperior: 4800000, aliquota: 30.5, deducao: 540000 },
  ],
};

export const DEFAULT_PARAMETROS_CALCULO: ParametrosCalculo = {
  version: CURRENT_VERSION,
  tiposRescisao: [
    { id: 'sem_justa_causa', label: 'Sem Justa Causa', descricao: 'Com aviso prévio e multa de FGTS.', geraAvisoPrevio: true, geraMultaFgts: true, ativo: true },
    { id: 'com_justa_causa', label: 'Com Justa Causa', descricao: 'Sem aviso prévio indenizado e sem multa de FGTS.', geraAvisoPrevio: false, geraMultaFgts: false, ativo: true },
    { id: 'pedido_demissao', label: 'Pedido de Demissão', descricao: 'Pedido do funcionário, sem multa de FGTS.', geraAvisoPrevio: false, geraMultaFgts: false, ativo: true },
  ],
  anexosDas: [
    { id: 'I', label: 'Anexo I', descricao: 'Comércio em geral', ativo: true, faixas: defaultFaixas.I },
    { id: 'II', label: 'Anexo II', descricao: 'Indústria e fabricação', ativo: true, faixas: defaultFaixas.II },
    { id: 'III', label: 'Anexo III', descricao: 'Serviços em geral', ativo: true, faixas: defaultFaixas.III },
    { id: 'IV', label: 'Anexo IV', descricao: 'Serviços regulamentados', ativo: true, faixas: defaultFaixas.IV },
    { id: 'V', label: 'Anexo V', descricao: 'Serviços especializados', ativo: true, faixas: defaultFaixas.V },
  ],
  regimesPisCofins: [
    { id: 'cumulativo', label: 'Cumulativo (LP)', descricao: 'PIS 0,65% / COFINS 3%', aliquotaPis: 0.65, aliquotaCofins: 3.0, permiteCreditoEntrada: false, ativo: true },
    { id: 'nao_cumulativo', label: 'Não-Cumulativo (LR)', descricao: 'PIS 1,65% / COFINS 7,6%', aliquotaPis: 1.65, aliquotaCofins: 7.6, permiteCreditoEntrada: true, ativo: true },
  ],
  regrasGerais: {
    aliquotaFgts: 8.0,
    aliquotaInssPatronal: 20.0,
    provisaoFerias13: 19.44,
    aliquotaSimplesPj: 6.0,
    multaFgtsRescisao: 40.0,
  }
};

function normalizeParametros(data: Partial<ParametrosCalculo>): ParametrosCalculo {
  const defaultsById = {
    tipos: new Map(DEFAULT_PARAMETROS_CALCULO.tiposRescisao.map((item) => [item.id, item])),
    anexos: new Map(DEFAULT_PARAMETROS_CALCULO.anexosDas.map((item) => [item.id, item])),
    regimes: new Map(DEFAULT_PARAMETROS_CALCULO.regimesPisCofins.map((item) => [item.id, item])),
  };
  const shouldRefreshLabels = data.version !== CURRENT_VERSION;

  return {
    version: CURRENT_VERSION,
    tiposRescisao: data.tiposRescisao?.length
      ? data.tiposRescisao.map((item) => {
          const defaults = defaultsById.tipos.get(item.id);
          return shouldRefreshLabels && defaults
            ? { ...item, label: defaults.label, descricao: defaults.descricao }
            : item;
        })
      : DEFAULT_PARAMETROS_CALCULO.tiposRescisao,
    anexosDas: data.anexosDas?.length
      ? data.anexosDas.map((item) => {
          const defaults = defaultsById.anexos.get(item.id);
          return shouldRefreshLabels && defaults
            ? { ...item, label: defaults.label, descricao: defaults.descricao }
            : item;
        })
      : DEFAULT_PARAMETROS_CALCULO.anexosDas,
    regimesPisCofins: data.regimesPisCofins?.length
      ? data.regimesPisCofins.map((item) => {
          const defaults = defaultsById.regimes.get(item.id);
          return shouldRefreshLabels && defaults
            ? { ...item, label: defaults.label, descricao: defaults.descricao }
            : item;
        })
      : DEFAULT_PARAMETROS_CALCULO.regimesPisCofins,
    regrasGerais: data.regrasGerais
      ? {
          aliquotaFgts: Number(data.regrasGerais.aliquotaFgts ?? DEFAULT_PARAMETROS_CALCULO.regrasGerais.aliquotaFgts),
          aliquotaInssPatronal: Number(data.regrasGerais.aliquotaInssPatronal ?? DEFAULT_PARAMETROS_CALCULO.regrasGerais.aliquotaInssPatronal),
          provisaoFerias13: Number(data.regrasGerais.provisaoFerias13 ?? DEFAULT_PARAMETROS_CALCULO.regrasGerais.provisaoFerias13),
          aliquotaSimplesPj: Number(data.regrasGerais.aliquotaSimplesPj ?? DEFAULT_PARAMETROS_CALCULO.regrasGerais.aliquotaSimplesPj),
          multaFgtsRescisao: Number(data.regrasGerais.multaFgtsRescisao ?? DEFAULT_PARAMETROS_CALCULO.regrasGerais.multaFgtsRescisao),
        }
      : DEFAULT_PARAMETROS_CALCULO.regrasGerais,
  };
}

function emitUpdate() {
  window.dispatchEvent(new CustomEvent(PARAMETROS_CALCULO_EVENT));
}

export const parametrosCalculoService = {
  async getParametros(): Promise<ParametrosCalculo> {
    const data = persistedStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        const normalized = normalizeParametros(JSON.parse(data) as Partial<ParametrosCalculo>);
        persistedStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      } catch {
        return DEFAULT_PARAMETROS_CALCULO;
      }
    }

    persistedStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PARAMETROS_CALCULO));
    return DEFAULT_PARAMETROS_CALCULO;
  },

  async saveParametros(parametros: ParametrosCalculo): Promise<ParametrosCalculo> {
    const normalized = normalizeParametros(parametros);
    persistedStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    emitUpdate();
    await new Promise((resolve) => setTimeout(resolve, 250));
    return normalized;
  },

  async resetParametros(): Promise<ParametrosCalculo> {
    persistedStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PARAMETROS_CALCULO));
    emitUpdate();
    await new Promise((resolve) => setTimeout(resolve, 250));
    return DEFAULT_PARAMETROS_CALCULO;
  },
};
