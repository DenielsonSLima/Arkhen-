import { useCallback, useSyncExternalStore } from 'react';
import type { CalculatorSize } from '../components/calculators/calculatorGeometry';
import { floatingCalculatorStore, type CalculatorModel, type CalculatorState } from '../stores/floatingCalculatorStore';

export const useFloatingCalculator = () => {
  const state = useSyncExternalStore(
    floatingCalculatorStore.subscribe,
    floatingCalculatorStore.getState
  );
  const openCalculator = useCallback(() => floatingCalculatorStore.openCalculator(), []);
  const closeCalculator = useCallback(() => floatingCalculatorStore.closeCalculator(), []);
  const toggleCalculator = useCallback(() => floatingCalculatorStore.toggleCalculator(), []);
  const setPosition = useCallback((pos: { x: number; y: number }) => {
    floatingCalculatorStore.setPosition(pos);
  }, []);
  const setSize = useCallback((size: CalculatorSize) => {
    floatingCalculatorStore.setSize(size);
  }, []);
  const setModel = useCallback((model: CalculatorModel) => floatingCalculatorStore.setModel(model), []);
  const addHistory = useCallback((calc: string) => floatingCalculatorStore.addHistory(calc), []);
  const clearHistory = useCallback(() => floatingCalculatorStore.clearHistory(), []);
  const updateNormalMemory = useCallback((mem: Partial<CalculatorState['normalMemory']>) => {
    floatingCalculatorStore.updateNormalMemory(mem);
  }, []);
  const updateAccountingMemory = useCallback((mem: Partial<CalculatorState['accountingMemory']>) => {
    floatingCalculatorStore.updateAccountingMemory(mem);
  }, []);
  const updateTaxMemory = useCallback((mem: Partial<CalculatorState['taxMemory']>) => {
    floatingCalculatorStore.updateTaxMemory(mem);
  }, []);
  const initDefaultModel = useCallback((userId: string) => floatingCalculatorStore.initDefaultModel(userId), []);

  return {
    isOpen: state.isOpen,
    position: state.position,
    size: state.size,
    activeModel: state.activeModel,
    history: state.history,
    normalMemory: state.normalMemory,
    accountingMemory: state.accountingMemory,
    taxMemory: state.taxMemory,

    openCalculator,
    closeCalculator,
    toggleCalculator,
    setPosition,
    setSize,
    setModel,
    addHistory,
    clearHistory,
    updateNormalMemory,
    updateAccountingMemory,
    updateTaxMemory,
    initDefaultModel,
  };
};
