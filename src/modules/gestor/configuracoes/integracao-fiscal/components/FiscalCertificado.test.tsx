// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiscalCertificado } from './FiscalCertificado';
import { DEFAULT_CONFIG } from '../services/fiscalIntegrationDefaults';
import type { FiscalConfigData } from '../services/fiscalIntegrationService';

afterEach(cleanup);
function Form({ saved = false }: { saved?: boolean }) {
  const [config, setConfig] = useState<FiscalConfigData>({ ...DEFAULT_CONFIG,
    certificadoNome: saved ? 'empresa.pfx' : '', certificadoValidade: saved ? '2027-11-12' : '',
    certificadoDiasRestantes: saved ? 365 : 0 });
  return <FiscalCertificado config={config} setConfig={setConfig} dragActive={false}
    testingCert={false} certResult={null} onTestCert={vi.fn()} onDrag={vi.fn()}
    onDrop={vi.fn()} onFileChange={vi.fn()} getCertBadge={days => <span>{days} dias</span>} />;
}
describe('Certificado fiscal A1', () => {
  it('identifica o campo e permite mostrar/ocultar sem alterar a senha', () => {
    render(<Form />);
    const input = screen.getByLabelText('Senha do Certificado') as HTMLInputElement;
    fireEvent.change(input, { target: { value: ' senha com espaços ' } });
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha do certificado' }));
    expect(input.type).toBe('text');
    expect(input.value).toBe(' senha com espaços ');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha do certificado' }));
    expect(input.type).toBe('password');
    expect(input.value).toBe(' senha com espaços ');
  });
  it('orienta senha antes do arquivo e não testa sem certificado salvo', () => {
    render(<Form />);
    expect(screen.getByText(/digite a senha e selecione o arquivo/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Testar Assinatura' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('mantém dados e validade do certificado salvo visíveis', () => {
    render(<Form saved />);
    expect((screen.getByLabelText('Data de validade') as HTMLInputElement).value).toBe('12/11/2027');
    expect((screen.getByRole('button', { name: 'Testar Assinatura' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
