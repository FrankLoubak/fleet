/**
 * ARQUIVO: src/lib/reports/ReportExporter.ts
 * O QUE FAZ: define o contrato comum a todo exportador de relatório (Excel, PDF, TXT) —
 *   permite adicionar novos formatos sem alterar quem os aciona (botões nas páginas).
 * PARA QUE SERVE: Rodada C / C4 — exportação de relatórios (TR Salgueiro/PE, item 5.6.2-b),
 *   seguindo o mesmo padrão de interface desacoplada da PARTE 4.1 usado em
 *   TelemetryProvider/AlertRule/DriverAuthProvider.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/reports/ExcelExporter.ts, PdfExporter.ts, TxtExporter.ts — implementações
 *   - src/lib/reports/index.ts — ponto único de acesso (reportExporters)
 *   - src/components/ExportMenu.tsx — UI que aciona a exportação
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-22 — criação inicial (Rodada C / C4)
 */

export interface ReportColumn {
  header: string;
  key: string;
}

/**
 * Dados tabulares genéricos de um relatório — o mesmo shape serve para jornadas,
 * alertas ou histórico de rotas, o que muda é quem monta o objeto (cada página).
 * `period` já vem formatado (ex.: "01/09/2026 a 30/09/2026") porque cada consumidor
 * decide seu próprio formato de filtro de período.
 */
export interface ReportData {
  title: string;
  period?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  filename: string;
}

export interface ReportExporter {
  readonly format: 'excel' | 'pdf' | 'txt';
  readonly label: string;
  export(report: ReportData): Promise<void>;
}
