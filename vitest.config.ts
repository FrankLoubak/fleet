import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        global: { lines: 60, functions: 60, branches: 50 },
      },
      exclude: ['node_modules', 'dist', 'android', 'csv_export', '**/*.config.*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `jspdf` (Rodada C / C4) publica builds separados por condição "node"/"browser" no
      // package.json. Testes rodam em Node.js de verdade (o ambiente "jsdom" só simula o
      // DOM), e nem `resolve.conditions` nem `ssr.resolve.conditions` bastam pra forçar a
      // condição "browser" na resolução do Vitest — sem este alias direto pro arquivo, o
      // build node é carregado, e `.save()` escreve um .pdf de verdade no disco via `fs`
      // em vez de gerar um Blob de download. `vite build` (produção) já resolve "browser"
      // corretamente por conta própria, sem precisar disto.
      jspdf: path.resolve(__dirname, './node_modules/jspdf/dist/jspdf.es.min.js'),
    },
  },
});
