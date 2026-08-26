import { describe, expect, it } from 'vitest';
import {
  ALLOWED_ACCOUNTING_EXTENSIONS,
  combineFolders,
  formatBytesLabel,
  formatRemainingTime,
  getFileExtension,
  getRelativeFolder,
} from './documentUploadModel';

describe('documentUploadModel', () => {
  it('mantém a validação de extensões contábeis sem diferenciar maiúsculas', () => {
    expect(getFileExtension('balanco.PDF')).toBe('.pdf');
    expect(getFileExtension('sped.EFD')).toBe('.efd');
    expect(ALLOWED_ACCOUNTING_EXTENSIONS).toContain('.pdf');
    expect(ALLOWED_ACCOUNTING_EXTENSIONS).toContain('.pfx');
  });

  it('preserva a estrutura relativa de pastas selecionadas', () => {
    expect(getRelativeFolder('Fiscal/2026/janeiro.xml', 'janeiro.xml')).toBe('Fiscal/2026');
    expect(getRelativeFolder('arquivo.pdf', 'arquivo.pdf')).toBe('');
    expect(combineFolders('Cliente A', 'Fiscal/2026')).toBe('Cliente A/Fiscal/2026');
    expect(combineFolders(null, 'Fiscal')).toBe('Fiscal');
  });

  it('formata progresso e tamanho como antes da extração', () => {
    expect(formatBytesLabel(0)).toBe('0 B');
    expect(formatBytesLabel(1536)).toBe('1.5 KB');
    expect(formatRemainingTime(30_000)).toBe('30s');
    expect(formatRemainingTime(90_000)).toBe('1min 30s');
  });
});
