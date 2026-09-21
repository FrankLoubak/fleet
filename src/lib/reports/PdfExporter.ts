/**
 * ARQUIVO: src/lib/reports/PdfExporter.ts
 * O QUE FAZ: gera um arquivo .pdf a partir de um ReportData e dispara o download no
 *   navegador, usando `jspdf` + `jspdf-autotable` (tabela paginada automaticamente).
 * PARA QUE SERVE: Rodada C / C4 — exportação em PDF (TR Salgueiro/PE, item 5.6.2-b).
 *   Layout genérico (RESPOSTA confirmada na PARTE 7, pergunta 7): cabeçalho com nome do
 *   sistema + período, sem timbre/logotipo de prefeitura específica.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/reports/ReportExporter.ts — interface implementada aqui
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-22 — criação inicial (Rodada C / C4)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportData, ReportExporter } from './ReportExporter';

export class PdfExporter implements ReportExporter {
  readonly format = 'pdf' as const;
  readonly label = 'PDF';

  async export(report: ReportData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text(`FleetManager — ${report.title}`, 14, 15);
    doc.setFontSize(10);
    let y = 22;
    if (report.period) {
      doc.text(`Período: ${report.period}`, 14, y);
      y += 6;
    }
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, y);

    autoTable(doc, {
      startY: y + 6,
      head: [report.columns.map((c) => c.header)],
      body: report.rows.map((row) => report.columns.map((c) => String(row[c.key] ?? ''))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`${report.filename}.pdf`);
  }
}
