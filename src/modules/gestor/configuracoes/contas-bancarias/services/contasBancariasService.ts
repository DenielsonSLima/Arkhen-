export interface ContaBancaria {
  id: string;
  banco: string;
  agencia: string;
  numeroConta: string;
  tipoConta: 'corrente' | 'poupança';
  saldoInicial: number;
  saldoAtual: number;
}

const LOCAL_STORAGE_ACCOUNTS_KEY = 'contabil_contas_bancarias';

const defaultAccounts: ContaBancaria[] = [
  {
    id: 'conta-1',
    banco: 'Banco do Brasil',
    agencia: '1234-5',
    numeroConta: '98765-4',
    tipoConta: 'corrente',
    saldoInicial: 15000,
    saldoAtual: 15000,
  },
  {
    id: 'conta-2',
    banco: 'Itaú Unibanco',
    agencia: '0345',
    numeroConta: '44332-1',
    tipoConta: 'corrente',
    saldoInicial: 85200.5,
    saldoAtual: 85200.5,
  },
  {
    id: 'conta-3',
    banco: 'Asaas Conta Digital',
    agencia: '0001',
    numeroConta: '112233-4',
    tipoConta: 'corrente',
    saldoInicial: 3200,
    saldoAtual: 3200,
  },
];

export const contasBancariasService = {
  async getContas(): Promise<ContaBancaria[]> {
    const data = localStorage.getItem(LOCAL_STORAGE_ACCOUNTS_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return defaultAccounts;
      }
    }
    localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(defaultAccounts));
    return defaultAccounts;
  },

  async saveConta(conta: Omit<ContaBancaria, 'saldoAtual'>): Promise<ContaBancaria> {
    const contas = await this.getContas();
    const isNew = !conta.id;
    let targetAccount: ContaBancaria;

    if (isNew) {
      targetAccount = {
        ...conta,
        id: `conta-${Date.now()}`,
        saldoAtual: conta.saldoInicial,
      };
      contas.push(targetAccount);
    } else {
      const index = contas.findIndex((item) => item.id === conta.id);
      if (index === -1) throw new Error('Conta não encontrada.');
      const diff = conta.saldoInicial - contas[index].saldoInicial;
      targetAccount = {
        ...contas[index],
        ...conta,
        saldoAtual: contas[index].saldoAtual + diff,
      };
      contas[index] = targetAccount;
    }

    localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(contas));
    await new Promise((resolve) => setTimeout(resolve, 800));
    return targetAccount;
  },

  async deleteConta(id: string): Promise<boolean> {
    const contas = await this.getContas();
    localStorage.setItem(LOCAL_STORAGE_ACCOUNTS_KEY, JSON.stringify(contas.filter((item) => item.id !== id)));
    await new Promise((resolve) => setTimeout(resolve, 600));
    return true;
  },
};
