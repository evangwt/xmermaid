import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { readFileSync } from 'node:fs';

const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
const replacePackageVersion = {
  name: 'replace-package-version',
  transform(code: string, id: string) {
    if (!id.endsWith('/src/support.ts')) return null;
    return {
      code: code.replaceAll('__XMERMAID_VERSION__', JSON.stringify(packageVersion)),
      map: null,
    };
  },
};

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/xmermaid.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [nodeResolve(), json(), typescript(), replacePackageVersion],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/xmermaid.cjs',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [nodeResolve(), json(), typescript(), replacePackageVersion],
  },
];
