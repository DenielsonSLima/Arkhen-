import { describe, expect, it } from 'vitest';
import type { ModeloAtividade } from '../services/atividadesService';
import {
  ESCRITORIO_SCOPE_ID,
  applyModeloToRotinaForm,
  blankRotinaProgramadaForm,
  buildRotinaFromForm,
  validateRotinaProgramadaForm,
} from './rotinaProgramadaFormModel';

const modelo: ModeloAtividade = {
  id: '10000000-0000-4000-8000-000000000001',
  nome: 'Fechamento fiscal',
  descricao: 'Checklist técnico do fechamento.',
  etapas: ['Receber documentos', 'Revisar apuração', 'Registrar protocolo'],
};

describe('formulário de rotina programada', () => {
  it('inicia sem frequência, data ou vínculo predefinidos', () => {
    const values = blankRotinaProgramadaForm();

    expect(values.frequencia).toBe('');
    expect(values.proximaExecucao).toBe('');
    expect(values.clienteScopeId).toBe('');
  });

  it('herda uma cópia do checklist do modelo sem transformar o modelo em rotina', () => {
    const values = applyModeloToRotinaForm(blankRotinaProgramadaForm(), modelo);

    expect(values.modeloId).toBe(modelo.id);
    expect(values.nome).toBe('Fechamento fiscal');
    expect(values.checklistText).toBe('Receber documentos\nRevisar apuração\nRegistrar protocolo');
    expect(modelo.etapas).toEqual(['Receber documentos', 'Revisar apuração', 'Registrar protocolo']);
  });

  it('exige escolhas operacionais conscientes antes de salvar', () => {
    expect(validateRotinaProgramadaForm(blankRotinaProgramadaForm(), '2026-08-25'))
      .toBe('Selecione o modelo que fornecerá o checklist da rotina.');
  });

  it('constrói a rotina interna apenas após a escolha explícita do escritório', () => {
    const inherited = applyModeloToRotinaForm(blankRotinaProgramadaForm(), modelo);
    const values = {
      ...inherited,
      categoria: 'Fiscal' as const,
      frequencia: 'Mensal' as const,
      responsavel: 'Ana Contadora',
      responsavelUserId: '20000000-0000-4000-8000-000000000001',
      responsavelConfigUsuarioId: '30000000-0000-4000-8000-000000000001',
      clienteScopeId: ESCRITORIO_SCOPE_ID,
      clienteNome: 'Escritório',
      proximaExecucao: '2026-09-01',
      prioridade: 'Alta' as const,
    };

    expect(validateRotinaProgramadaForm(values, '2026-08-25')).toBeNull();
    expect(buildRotinaFromForm(values)).toMatchObject({
      modeloId: modelo.id,
      cliente: 'Escritório',
      clienteId: undefined,
      frequencia: 'Mensal',
      intervaloDias: 30,
      checklist: modelo.etapas,
    });
  });
});
