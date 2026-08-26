import React from 'react';
import { MinhaFilaAtividades } from './MinhaFilaAtividades';
import type { MinhaFilaFiltro } from './minhaFilaFilters';

interface AbaMinhasAtividadesProps {
  initialPeriodo?: 'dia' | 'semana' | 'mes';
  showInternasOnly?: boolean;
}

const FILTER_BY_PERIOD: Record<NonNullable<AbaMinhasAtividadesProps['initialPeriodo']>, MinhaFilaFiltro> = {
  dia: 'hoje',
  semana: 'semana',
  mes: 'mes',
};

export const AbaMinhasAtividades: React.FC<AbaMinhasAtividadesProps> = ({
  initialPeriodo = 'semana',
  showInternasOnly = false,
}) => (
  <MinhaFilaAtividades
    initialFilter={showInternasOnly ? 'internas' : FILTER_BY_PERIOD[initialPeriodo]}
  />
);
