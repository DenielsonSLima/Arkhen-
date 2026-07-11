import { supabase } from '../../../../../lib/supabase';

export interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string;
  numeroConta: string;
  tipoConta: 'corrente' | 'poupança';
  saldoInicial: number;
  saldoAtual: number;
}

export interface ContasBancariasResumo {
  saldoInicial: number;
  saldoAtual: number;
  totalContas: number;
}

interface ContaBancariaRow {
  id: string;
  banco: string;
  agencia: string;
  numero_conta: string;
  tipo_conta: 'corrente' | 'poupanca';
  saldo_inicial: number | string;
  saldo_atual: number | string;
}

const fromRow = (row: ContaBancariaRow): ContaBancaria => ({
  id: row.id,
  banco: row.banco,
  agencia: row.agencia,
  numeroConta: row.numero_conta,
  tipoConta: row.tipo_conta === 'poupanca' ? 'poupança' : 'corrente',
  saldoInicial: Number(row.saldo_inicial || 0),
  saldoAtual: Number(row.saldo_atual || 0),
});

const toPayload = (conta: Omit<ContaBancaria, 'saldoAtual'>) => ({
  id: conta.id || '',
  banco: conta.banco.trim(),
  agencia: conta.agencia.trim(),
  numero_conta: conta.numeroConta.trim(),
  tipo_conta: conta.tipoConta === 'poupança' ? 'poupanca' : 'corrente',
  saldo_inicial: conta.saldoInicial,
});

const emptyResumo: ContasBancariasResumo = {
  saldoInicial: 0,
  saldoAtual: 0,
  totalContas: 0,
};

export const contasBancariasService = {
  async getContas(): Promise<ContaBancaria[]> {
    const { data, error } = await supabase
      .from('configuracoes_contas_bancarias')
      .select('id,banco,agencia,numero_conta,tipo_conta,saldo_inicial,saldo_atual')
      .order('banco', { ascending: true });

    if (error) throw new Error(`Erro ao carregar contas bancárias: ${error.message}`);
    return ((data || []) as ContaBancariaRow[]).map(fromRow);
  },

  async getResumo(): Promise<ContasBancariasResumo> {
    const { data, error } = await supabase.rpc('get_contas_bancarias_resumo');
    if (error) throw new Error(`Erro ao carregar resumo bancário: ${error.message}`);

    const resumo = (data || emptyResumo) as Partial<ContasBancariasResumo>;
    return {
      saldoInicial: Number(resumo.saldoInicial || 0),
      saldoAtual: Number(resumo.saldoAtual || 0),
      totalContas: Number(resumo.totalContas || 0),
    };
  },

  async saveConta(conta: Omit<ContaBancaria, 'saldoAtual'>): Promise<ContaBancaria> {
    const { data, error } = await supabase.rpc('salvar_conta_bancaria', {
      p_payload: toPayload(conta),
    });

    if (error) throw new Error(`Erro ao salvar conta bancária: ${error.message}`);
    return fromRow(data as ContaBancariaRow);
  },

  async deleteConta(id: string): Promise<void> {
    const { error } = await supabase
      .from('configuracoes_contas_bancarias')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Erro ao remover conta bancária: ${error.message}`);
  },
};
