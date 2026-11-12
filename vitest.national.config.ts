import { defineConfig } from 'vitest/config';
export default defineConfig({
 resolve: { alias: {
  'npm:node-forge@1.3.1': 'node-forge',
    'npm:xml-crypto@6.4.0': 'xml-crypto',
  'npm:@xmldom/xmldom@0.8.15': '@xmldom/xmldom',
  'npm:libxml2-wasm@0.7.2': 'libxml2-wasm',
 } },
 test: { include: ['supabase/functions/_shared/nfse-national/*.test.ts',
  'supabase/functions/fiscal-integration/national-action.test.ts'], testTimeout: 15000 },
});
