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
      // Fechamento formal da Rodada C (2026-09-22): a chave `global: {...}` aninhada
      // (herdada da Rodada A) não é reconhecida pelo Vitest 2.x — ele interpreta "global"
      // como um padrão glob de arquivo, que nunca casa com nada, então o limite nunca era
      // aplicado de verdade (confirmado forçando 99% e vendo o comando não falhar antes
      // desta correção). As chaves de limite globais ficam direto neste nível.
      // Números abaixo da cobertura real atual (48.2% linhas / 39.59% funções / 80.83%
      // branches) — servem de PISO contra regressão, não de meta; as páginas novas da
      // Rodada C (Geofences.tsx, RouteHistory.tsx, Profile.tsx) só têm cobertura via
      // src/lib/ e validação manual/e2e, sem teste de componente dedicado (ver
      // DEVELOPER_MANUAL.md seção 13, pendência 5). Subir de volta a 60% exige escrever
      // esses testes de componente — fora do escopo deste fechamento.
      thresholds: { lines: 40, functions: 30, branches: 75 },
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
