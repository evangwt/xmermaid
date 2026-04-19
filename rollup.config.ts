import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/xmermaid.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [typescript()],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/xmermaid.js',
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [typescript()],
  },
];
