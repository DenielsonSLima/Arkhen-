import { describe, expect, it } from 'vitest';
import { getAvisoPrevioOpcoes, normalizeAvisoPrevioModo } from './rescisaoAvisoPrevio';

describe('matriz de aviso-prévio por tipo de rescisão', () => {
  it.each([
    ['sem_justa_causa', ['cumprido', 'indenizado']],
    ['com_justa_causa', ['cumprido']],
    ['pedido_demissao', ['cumprido', 'descontado']],
  ])('expõe apenas os modos calculados pela RPC para %s', (tipo, esperados) => {
    expect(getAvisoPrevioOpcoes(tipo).map((opcao) => opcao.id)).toEqual(esperados);
  });

  it.each([
    ['sem_justa_causa', 'descontado', 'indenizado'],
    ['com_justa_causa', 'indenizado', 'cumprido'],
    ['pedido_demissao', 'indenizado', 'cumprido'],
  ] as const)('normaliza %s/%s para %s', (tipo, modo, esperado) => {
    expect(normalizeAvisoPrevioModo(tipo, modo)).toBe(esperado);
  });
});
