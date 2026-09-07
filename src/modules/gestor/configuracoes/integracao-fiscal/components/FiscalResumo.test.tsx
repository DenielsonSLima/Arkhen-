import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FiscalResumo } from './FiscalResumo';
import { DEFAULT_CONFIG, DEFAULT_STATS } from '../services/fiscalIntegrationDefaults';

const actions = {
  onTestConnection() {}, onTestCert() {}, onSyncData() {}, onQueryLastNfse() {}, onQueryNextNum() {}, onSwitchTab() {},
};
const props = { config: { ...DEFAULT_CONFIG, certificadoDiasRestantes: 365 }, stats: DEFAULT_STATS, history: [],
  syncing: false, testingConnection: false, testingCert: false, connectionResult: null, certResult: null, ...actions };

describe('Resumo de preparação WebISS', () => {
  it('certificado válido não implica emissão habilitada nem produção', () => {
    const markup = renderToStaticMarkup(<FiscalResumo {...props} isActive={false} />);
    expect(markup).toContain('Configuração desabilitada');
    expect(markup).toContain('Homologação — testes sem valor fiscal');
    expect(markup).not.toContain('Ativo / Em Produção');
  });

  it('exibe bloqueios do servidor e falha de assinatura como erro', () => {
    const markup = renderToStaticMarkup(<FiscalResumo {...props} isActive certResult={{ success: false, message: 'Senha incorreta' }}
      readiness={{ ready: false, blockers: ['Inscrição municipal ausente'], environment: 'homologacao', endpoint: '', certificateConfigured: false }} />);
    expect(markup).toContain('Configuração com pendências');
    expect(markup).toContain('Inscrição municipal ausente');
    expect(markup).toContain('class="error-banner"');
    expect(markup).not.toContain('Sincronizar Lotes');
  });

  it('pré-requisitos configurados continuam distintos da autorização municipal', () => {
    const markup = renderToStaticMarkup(<FiscalResumo {...props} isActive
      readiness={{ ready: true, blockers: [], environment: 'homologacao', endpoint: '', certificateConfigured: true }} />);
    expect(markup).toContain('Pré-requisitos configurados');
    expect(markup).toContain('precisam estar aprovados no portal municipal');
    expect(markup).toContain('Ver próximo RPS cadastrado');
  });
});
