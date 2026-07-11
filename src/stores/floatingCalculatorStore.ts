import { DEFAULT_CALCULATOR_SIZE, type CalculatorSize } from '../components/calculators/calculatorGeometry';

export type CalculatorModel = 'normal' | 'accounting' | 'tax';

export interface CalculatorState {
  isOpen: boolean;
  position: { x: number; y: number };
  size: CalculatorSize;
  activeModel: CalculatorModel;
  history: string[];
  // Estados de inputs salvos para cada modelo de calculadora
  normalMemory: {
    display: string;
    equation: string;
    prevVal: string | null;
    operation: string | null;
    resetOnNextInput: boolean;
  };
  accountingMemory: {
    // Acréscimo/Desconto
    adValor: string;
    adPercentual: string;
    // Regra de Três
    rtA: string;
    rtB: string;
    rtC: string;
    // Pró-Rata
    prValorMensal: string;
    prDiasTotais: string;
    prDiasTrabalhados: string;
    // Juros Simples
    jsCapital: string;
    jsTaxaMensal: string;
    jsTempoMeses: string;
    // Multa Simples
    msValor: string;
    msTaxaMulta: string;
    // Líquido / Bruto
    lbValor: string;
    lbTaxaDesconto: string;
    lbIsBrutoParaLiquido: boolean;
  };
  taxMemory: {
    // Cálculo por Alíquota
    caBaseCalculo: string;
    caAliquota: string;
    // Base de Cálculo
    bcValorComImposto: string;
    bcAliquota: string;
    // Retenção
    retValorBruto: string;
    retTipo: 'csrf' | 'irrf' | 'iss' | 'inss' | 'custom';
    retAliquotaCustom: string;
    // Vencimento em Atraso
    vaValorOriginal: string;
    vaDiasAtraso: string;
  };
}

const POSITION_STORAGE_KEY = 'contabil_calculator_position';
const SIZE_STORAGE_KEY = 'contabil_calculator_size';
const MODEL_STORAGE_KEY = 'contabil_calculator_last_model';
const PREFS_STORAGE_KEY = 'contabil_calculator_prefs_'; // concatenado com userId futuramente

const defaultInitialState: CalculatorState = {
  isOpen: false,
  position: { x: 100, y: 100 }, // Posição padrão (será atualizada pelo localStorage ou centralizada na montagem)
  size: DEFAULT_CALCULATOR_SIZE,
  activeModel: 'normal',
  history: [],
  normalMemory: {
    display: '0',
    equation: '',
    prevVal: null,
    operation: null,
    resetOnNextInput: false,
  },
  accountingMemory: {
    adValor: '',
    adPercentual: '',
    rtA: '',
    rtB: '',
    rtC: '',
    prValorMensal: '',
    prDiasTotais: '30',
    prDiasTrabalhados: '',
    jsCapital: '',
    jsTaxaMensal: '',
    jsTempoMeses: '',
    msValor: '',
    msTaxaMulta: '',
    lbValor: '',
    lbTaxaDesconto: '',
    lbIsBrutoParaLiquido: true,
  },
  taxMemory: {
    caBaseCalculo: '',
    caAliquota: '',
    bcValorComImposto: '',
    bcAliquota: '',
    retValorBruto: '',
    retTipo: 'csrf',
    retAliquotaCustom: '',
    vaValorOriginal: '',
    vaDiasAtraso: '',
  }
};

let state: CalculatorState = { ...defaultInitialState };

// Inicializar do localStorage
try {
  const savedPos = localStorage.getItem(POSITION_STORAGE_KEY);
  if (savedPos) {
    state.position = JSON.parse(savedPos);
  } else {
    // Centralizado mais ou menos por padrão
    state.position = { x: window.innerWidth - DEFAULT_CALCULATOR_SIZE.width - 40, y: 120 };
  }

  const savedSize = localStorage.getItem(SIZE_STORAGE_KEY);
  if (savedSize) {
    const parsedSize = JSON.parse(savedSize);
    if (
      parsedSize
      && typeof parsedSize.width === 'number'
      && typeof parsedSize.height === 'number'
    ) {
      state.size = parsedSize;
    }
  }

  const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
  if (savedModel && ['normal', 'accounting', 'tax'].includes(savedModel)) {
    state.activeModel = savedModel as CalculatorModel;
  }
} catch (e) {
  console.error('Erro ao ler estado da calculadora do localStorage:', e);
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(updater: (current: CalculatorState) => CalculatorState) {
  state = updater(state);
  notify();
}

export const floatingCalculatorStore = {
  getState(): CalculatorState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  // Inicializar o modelo padrão a partir das configurações do usuário atual
  initDefaultModel(userId: string) {
    try {
      const savedPrefs = localStorage.getItem(`${PREFS_STORAGE_KEY}${userId}`);
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        if (prefs && prefs.defaultModel) {
          // Se não houver último modelo usado salvo, ou se for a primeira vez
          const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
          if (!savedModel) {
            setState(current => ({
              ...current,
              activeModel: prefs.defaultModel,
            }));
          }
        }
      }
    } catch (e) {
      console.error('Erro ao ler modelo padrão:', e);
    }
  },

  openCalculator() {
    setState(current => ({
      ...current,
      isOpen: true,
    }));
  },

  closeCalculator() {
    setState(current => ({
      ...current,
      isOpen: false,
    }));
  },

  toggleCalculator() {
    setState(current => ({
      ...current,
      isOpen: !current.isOpen,
    }));
  },

  setPosition(pos: { x: number; y: number }) {
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(pos));
    } catch (e) {
      console.error(e);
    }
    setState(current => ({
      ...current,
      position: pos,
    }));
  },

  setSize(size: CalculatorSize) {
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
    } catch (e) {
      console.error(e);
    }
    setState(current => ({
      ...current,
      size,
    }));
  },

  setModel(model: CalculatorModel) {
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch (e) {
      console.error(e);
    }
    setState(current => ({
      ...current,
      activeModel: model,
    }));
  },

  addHistory(calculation: string) {
    setState(current => ({
      ...current,
      history: [calculation, ...current.history.slice(0, 19)], // guarda até 20 itens
    }));
  },

  clearHistory() {
    setState(current => ({
      ...current,
      history: [],
    }));
  },

  updateNormalMemory(memory: Partial<CalculatorState['normalMemory']>) {
    setState(current => ({
      ...current,
      normalMemory: {
        ...current.normalMemory,
        ...memory,
      },
    }));
  },

  updateAccountingMemory(memory: Partial<CalculatorState['accountingMemory']>) {
    setState(current => ({
      ...current,
      accountingMemory: {
        ...current.accountingMemory,
        ...memory,
      },
    }));
  },

  updateTaxMemory(memory: Partial<CalculatorState['taxMemory']>) {
    setState(current => ({
      ...current,
      taxMemory: {
        ...current.taxMemory,
        ...memory,
      },
    }));
  }
};
