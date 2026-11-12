// Type bridge only; Vite aliases and Deno pinned npm imports resolve the real package.
declare module 'npm:@xmldom/xmldom@0.8.15' {
  export { DOMParser } from '@xmldom/xmldom';
}

declare module 'npm:node-forge@1.3.1' { import forge from 'node-forge'; export default forge; }
