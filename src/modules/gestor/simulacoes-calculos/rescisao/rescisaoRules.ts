import type { AvisoPrevioModo } from './rescisaoTypes';

export const getLocalDateInputValue = (
  now = new Date(),
  timezoneOffsetMinutes = now.getTimezoneOffset(),
) => {
  const localTime = new Date(now.getTime() - (timezoneOffsetMinutes * 60_000));
  return localTime.toISOString().slice(0, 10);
};

const AVISOS_POR_TIPO: Record<string, AvisoPrevioModo[]> = {
  sem_justa_causa: ['cumprido', 'indenizado'],
  com_justa_causa: ['cumprido'],
  pedido_demissao: ['cumprido', 'descontado'],
};

export const getAvisosPermitidos = (tipo: string): AvisoPrevioModo[] => (
  AVISOS_POR_TIPO[tipo] ?? ['cumprido']
);

export const normalizeAvisoPrevio = (
  tipo: string,
  atual: AvisoPrevioModo,
): AvisoPrevioModo => {
  const permitidos = getAvisosPermitidos(tipo);
  return permitidos.includes(atual) ? atual : permitidos[0];
};
