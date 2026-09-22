import { expect, it } from 'vitest';
import { buildFinanceiroPdf } from './financeiroPdfService';
it('exports server totals, selected history and recent payments as a PDF',async()=>{
  const pdf=await buildFinanceiroPdf({totalFaturado:0,totalRecebido:0,totalPendente:0,taxaInadimplencia:0,patrimonioLiquido:890,receitasPorParceiro:[],despesasPorCategoria:[],saldoDisponivel:890,contasReceber:0,contasPagar:0,receitasRecebidas:0,despesasPagas:110,lucroMes:-110,
    desempenho:[{name:'Set',receita:0,despesas:110,lucro:-110}],contas:[],saidasRecentes:[{id:'1',data:'2026-09-21',descricao:'Aluguel',valor:110}]},12);
  const output=pdf.output();expect(output.startsWith('%PDF')).toBe(true);expect(output).toContain('110,00');expect(output).toContain('21/09/2026');expect(output).toContain('Aluguel');
});
