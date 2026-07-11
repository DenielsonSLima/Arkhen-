const fs = require('fs');
let content = fs.readFileSync('src/modules/gestor/financeiro/components/CaixaTab.tsx', 'utf-8');

// The new mock data to insert
const newMock = `
const mockReceitasPorParceiro = [
  { id: 1, nome: 'TechCorp', valor: 35000, percentual: 45.0 },
  { id: 2, nome: 'Loja A', valor: 15000, percentual: 19.2 },
  { id: 3, nome: 'Mercado B', valor: 12000, percentual: 15.4 },
  { id: 4, nome: 'Padaria C', valor: 9000, percentual: 11.5 },
  { id: 5, nome: 'Outros', valor: 7000, percentual: 8.9 },
];
`;

content = content.replace('const mockCategoriasDespesas = [', newMock + '\nconst mockCategoriasDespesas = [');

// Now extract the components
const chartStart = '{/* Chart */}';
const chartEnd = '{/* Despesas por Categoria */}';
const despesasStart = '{/* Despesas por Categoria */}';
const despesasEnd = '        </div>\n\n        <div style={{ display: \'flex\', flexDirection: \'column\', gap: \'24px\' }}>';

const saldosStart = '{/* Saldos Bancários */}';
const saldosEnd = '{/* Últimas Entradas */}';

const creditosStart = '{/* Últimas Entradas */}';
const creditosEnd = '{/* Últimas Saídas */}';

const debitosStart = '{/* Últimas Saídas */}';
const debitosEnd = '        </div>\n\n      </div>\n    </div>\n  );\n};\n';

const chartBlock = content.substring(content.indexOf(chartStart), content.indexOf(chartEnd)).trim();
const despesasBlock = content.substring(content.indexOf(despesasStart), content.indexOf(despesasEnd)).trim();
const saldosBlock = content.substring(content.indexOf(saldosStart), content.indexOf(saldosEnd)).trim();
const creditosBlock = content.substring(content.indexOf(creditosStart), content.indexOf(creditosEnd)).trim();
const debitosBlock = content.substring(content.indexOf(debitosStart), content.indexOf(debitosEnd)).trim();

// Construct new Receitas block based on Despesas
const receitasBlock = despesasBlock
  .replace('Despesas por Categoria', 'Receitas por Tipo de Parceiro')
  .replace('Maiores ofensores do período selecionado', 'Maiores fontes de receita do período')
  .replace('mockCategoriasDespesas', 'mockReceitasPorParceiro')
  .replace('#ef4444', '#10b981')
  .replace('#ef4444', '#10b981')
  .replace('#ef4444', '#10b981'); // Need to be careful, we want the bar to be green

const newLayout = `
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
        ${chartBlock}
        ${saldosBlock}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        ${receitasBlock.replace(/#ef4444/g, '#10b981')}
        ${despesasBlock}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        ${creditosBlock}
        ${debitosBlock}
      </div>
    </div>
  );
};
`;

const replaceStart = '<div style={{ display: \'grid\', gridTemplateColumns: \'1fr 380px\', gap: \'24px\', alignItems: \'start\' }}>';

content = content.substring(0, content.indexOf(replaceStart)) + newLayout;

fs.writeFileSync('src/modules/gestor/financeiro/components/CaixaTab.tsx', content);
