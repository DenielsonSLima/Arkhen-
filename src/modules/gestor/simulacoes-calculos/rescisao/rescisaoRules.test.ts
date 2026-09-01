import { describe, expect, it } from 'vitest';
import {
  getAvisosPermitidos,
  getLocalDateInputValue,
  normalizeAvisoPrevio,
} from './rescisaoRules';

describe('regras da Calculadora de Rescisão', () => {
  it('mantém apenas combinações de aviso aceitas pela RPC', () => {
    expect(getAvisosPermitidos('sem_justa_causa')).toEqual(['cumprido', 'indenizado']);
    expect(getAvisosPermitidos('com_justa_causa')).toEqual(['cumprido']);
    expect(getAvisosPermitidos('pedido_demissao')).toEqual(['cumprido', 'descontado']);
  });

  it('normaliza o aviso ao trocar o motivo da rescisão', () => {
    expect(normalizeAvisoPrevio('com_justa_causa', 'indenizado')).toBe('cumprido');
    expect(normalizeAvisoPrevio('pedido_demissao', 'indenizado')).toBe('cumprido');
    expect(normalizeAvisoPrevio('sem_justa_causa', 'indenizado')).toBe('indenizado');
  });

  it('usa a data local em Maceió no limite noturno, não a data UTC seguinte', () => {
    const afterNinePm = new Date('2026-09-01T00:30:00.000Z');
    expect(getLocalDateInputValue(afterNinePm, 180)).toBe('2026-08-31');
  });
});
