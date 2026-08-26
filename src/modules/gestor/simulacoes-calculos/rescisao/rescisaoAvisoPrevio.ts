import type { AvisoPrevioModo } from '../hooks/useSimulacoesCalculos';

const AVISO_PREVIO_OPCOES: Array<{
  id: AvisoPrevioModo;
  label: string;
  desc: string;
}> = [
  { id: 'cumprido', label: 'Cumpriu 30 dias', desc: 'Não soma nem desconta aviso prévio.' },
  { id: 'descontado', label: 'Não cumpriu', desc: 'Desconta 30 dias de aviso do valor líquido.' },
  { id: 'indenizado', label: 'Indenizado', desc: 'Soma aviso prévio indenizado nas verbas.' },
];

const AVISO_NAO_APLICAVEL = {
  id: 'cumprido' as const,
  label: 'Não se aplica',
  desc: 'A rescisão por justa causa não gera aviso-prévio.',
};

const AVISO_PREVIO_POR_TIPO: Record<string, AvisoPrevioModo[]> = {
  sem_justa_causa: ['cumprido', 'indenizado'],
  com_justa_causa: ['cumprido'],
  pedido_demissao: ['cumprido', 'descontado'],
};

export const getAvisoPrevioOpcoes = (tipo: string) => {
  if (tipo === 'com_justa_causa') return [AVISO_NAO_APLICAVEL];
  const permitidos = AVISO_PREVIO_POR_TIPO[tipo] || ['cumprido'];
  return AVISO_PREVIO_OPCOES.filter((opcao) => permitidos.includes(opcao.id));
};

export const normalizeAvisoPrevioModo = (
  tipo: string,
  modo: AvisoPrevioModo,
): AvisoPrevioModo => {
  const opcoes = getAvisoPrevioOpcoes(tipo);
  if (opcoes.some((opcao) => opcao.id === modo)) return modo;
  return tipo === 'sem_justa_causa' ? 'indenizado' : 'cumprido';
};
