import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/xmermaid.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [typescript()],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/xmermaid.cjs',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    plugins: [typescript()],
  },
];
