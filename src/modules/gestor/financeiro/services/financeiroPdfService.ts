import type { DashboardStats } from './financeiroTypes';

export async function buildFinanceiroPdf(stats: DashboardStats, meses: number) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  let y = 20;
  const line = (text: string) => {
    const lines = pdf.splitTextToSize(text, 175) as string[];
    for (const value of lines) {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.text(value, 18, y); y += 7;
    }
  };
  pdf.setFontSize(16); line('Arkhen - Resumo financeiro');
  pdf.setFontSize(10);
  line(`Emitido em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio' })}`);
  line(`Saldo disponível: ${currency(stats.saldoDisponivel)}`);
  line(`Contas a receber: ${currency(stats.contasReceber)} | Contas a pagar: ${currency(stats.contasPagar)}`);
  line(`Receitas recebidas: ${currency(stats.receitasRecebidas)} | Despesas pagas: ${currency(stats.despesasPagas)}`);
  line(`Lucro do mês: ${currency(stats.lucroMes)}`);
  line(`Desempenho - últimos ${meses} meses`);
  for (const item of stats.desempenho) {
    line(`${item.name}: Receitas ${currency(item.receita)} | Despesas ${currency(item.despesas)} | Lucro ${currency(item.lucro)}`);
  }
  line('Contas bancárias');
  for (const conta of stats.contas) line(`${conta.banco} | Ag. ${conta.agencia} | Conta ${conta.conta} | ${currency(conta.saldo)}`);
  for (const [title, items] of [['Últimas entradas', stats.entradasRecentes], ['Últimas saídas', stats.saidasRecentes]] as const) {
    line(title);
    if (!items?.length) line('Nenhuma movimentação registrada.');
    for (const item of items ?? []) line(`${item.data.split('-').reverse().join('/')} | ${item.descricao} | ${currency(item.valor)}`);
  }
  return pdf;
}

export async function downloadFinanceiroPdf(stats: DashboardStats, meses: number) {
  const pdf = await buildFinanceiroPdf(stats, meses);
  pdf.save('arkhen-resumo-financeiro.pdf');
}
