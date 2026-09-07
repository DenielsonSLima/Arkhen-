// Isolated PostgreSQL tests. Requires @electric-sql/pglite@0.3.14 in a temporary directory.
// Usage: node supabase/tests/run-webiss.mjs /tmp/contabil-webiss-sql/node_modules/@electric-sql/pglite/dist/index.js
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
if (!process.argv[2]) throw new Error('Provide the path to the temporary PGlite package entry point.');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
try {
  for (const file of [
    'fixtures/webiss_schema.sql',
    '../migrations/20260907135151_webiss_emissao_segura.sql',
    '../migrations/20260907135202_webiss_parametros_diagnostico.sql',
    'webiss_emissao_behaviour.sql',
  ]) {
    await db.exec(await readFile(new URL(file, import.meta.url), 'utf8'));
    console.log(`PASS ${file}`);
  }
} finally { await db.close(); }
