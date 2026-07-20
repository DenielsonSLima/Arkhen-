import React from 'react';
import { useContasBancariasQuery } from '../../configuracoes/contas-bancarias/queries/useContasBancariasQueries';
import { ModalPagarDespesa } from './ModalPagarDespesa';

type Props = Omit<React.ComponentProps<typeof ModalPagarDespesa>, 'contasBancarias'>;

export const ModalPagarDespesaWithAccounts: React.FC<Props> = (props) => {
  const contasBancariasQuery = useContasBancariasQuery();
  return <ModalPagarDespesa {...props} contasBancarias={contasBancariasQuery.data || []} />;
};
