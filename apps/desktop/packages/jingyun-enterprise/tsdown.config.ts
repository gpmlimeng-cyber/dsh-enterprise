import { defineConfig } from 'tsdown';

const id = '@jingyun-ai/jingyun-enterprise';

export default defineConfig([
  // 后端半：Cordis Host 插件（Node / ESM），出口 lib/index.mjs
  {
    entry: {
      index: 'src/index.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    clean: true,
    dts: false,
    external: [
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-credentials',
      '@deepseek-ai/dsh-llm-pi-ai',
      '@deepseek-ai/schemastery',
    ],
  },
  // 客户端半：DSH Web 插槽扩展（Browser / CJS 包装），出口 lib/client.js
  {
    entry: {
      client: 'src/client/index.tsx',
    },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'esnext',
    clean: false,
    dts: false,
    external: [
      'react',
      'react-dom',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-primitives',
    ],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]);
