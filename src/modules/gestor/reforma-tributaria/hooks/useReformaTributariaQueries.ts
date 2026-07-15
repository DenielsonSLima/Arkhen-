import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reformaTributariaKeys, reformaTributariaQueries } from '../queries/reformaTributariaQueries';
import { reformaTributariaService } from '../services/reformaTributariaService';
import type { AdequacaoInput, ChecklistItemId } from '../services/reformaTributaria.types';

const useInvalidateReforma = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: reformaTributariaKeys.all });
};

export const useReformaPainelQuery = () => useQuery(reformaTributariaQueries.painel());
export const useReformaHistoricoQuery = (clienteId?: string | null) => (
  useQuery(reformaTributariaQueries.historico(clienteId))
);

export const useSaveAdequacaoMutation = () => {
  const invalidate = useInvalidateReforma();
  return useMutation({ mutationFn: reformaTributariaService.saveAdequacao, onSuccess: invalidate });
};

export const useToggleChecklistMutation = () => {
  const invalidate = useInvalidateReforma();
  return useMutation({
    mutationFn: (input: { clienteId: string; item: ChecklistItemId; concluido: boolean }) => (
      reformaTributariaService.toggleChecklist(input.clienteId, input.item, input.concluido)
    ),
    onSuccess: invalidate,
  });
};

export const useValidateXmlMutation = () => {
  const invalidate = useInvalidateReforma();
  return useMutation({
    mutationFn: (input: { clienteId: string; file: File }) => reformaTributariaService.validateXml(input.clienteId, input.file),
    onSuccess: invalidate,
  });
};

export const useIbsCbsSimulationMutation = () => {
  const invalidate = useInvalidateReforma();
  return useMutation({
    mutationFn: (input: { clienteId: string; values: Record<string, string> }) => reformaTributariaService.simulateIbsCbs(input.clienteId, input.values),
    onSuccess: invalidate,
  });
};

export const useSplitSimulationMutation = () => {
  const invalidate = useInvalidateReforma();
  return useMutation({
    mutationFn: (input: { clienteId: string; values: Record<string, string> }) => reformaTributariaService.simulateSplitPayment(input.clienteId, input.values),
    onSuccess: invalidate,
  });
};

export const useSaveDecisaoMutation = () => {
  const invalidate = useInvalidateReforma();
  return useMutation({
    mutationFn: (input: { clienteId: string; values: Record<string, string | null> }) => reformaTributariaService.saveDecisao(input.clienteId, input.values),
    onSuccess: invalidate,
  });
};

export type { AdequacaoInput };
