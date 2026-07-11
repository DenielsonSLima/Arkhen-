const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/modules/gestor/financeiro/components/*Tab.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // Remove the toggle div entirely
  content = content.replace(/<div className="financeiro-view-modes">[\s\S]*?<\/div>/, '');

  fs.writeFileSync(file, content);
}
