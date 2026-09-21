/**
 * ARQUIVO: src/lib/reports/ExcelExporter.ts
 * O QUE FAZ: gera um arquivo .xlsx a partir de um ReportData e dispara o download no
 *   navegador, usando a biblioteca `exceljs`.
 * PARA QUE SERVE: Rodada C / C4 — exportação em Excel (TR Salgueiro/PE, item 5.6.2-b).
 * DECISÃO DE DEPENDÊNCIA (item 1/5 da PARTE 8/9): a biblioteca mais popular para isto
 *   (`xlsx`/SheetJS) tem 2 vulnerabilidades HIGH sem correção publicada no registro
 *   público do npm (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) — confirmado via
 *   `npm audit` antes de escolher. Optou-se por `exceljs`, que não depende de `xlsx`.
 *   `exceljs` carrega `uuid@8.3.2` (GHSA-w5hq-g745-h8pq, moderate), mas essa falha só é
 *   explorável quando o CHAMADOR passa um buffer próprio para `uuid()` — `exceljs` nunca
 *   faz isso na sua própria API, então a superfície de ataque não é alcançável aqui.
 *   Nenhuma biblioteca de geração de PDF/Excel no ambiente de skills do Claude Code se
 *   aplica: essas skills produzem arquivos para o próprio operador do Claude Code, não
 *   podem ser embutidas no bundle React entregue ao usuário final do FleetManager.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/reports/ReportExporter.ts — interface implementada aqui
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-22 — criação inicial (Rodada C / C4)
 */

import ExcelJS from 'exceljs';
import type { ReportData, ReportExporter } from './ReportExporter';

export class ExcelExporter implements ReportExporter {
  readonly format = 'excel' as const;
  readonly label = 'Excel (.xlsx)';

  async export(report: ReportData): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FleetManager';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(report.title.slice(0, 31) || 'Relatório');

    sheet.addRow([`FleetManager — ${report.title}`]).font = { bold: true, size: 14 };
    if (report.period) sheet.addRow([`Período: ${report.period}`]);
    sheet.addRow([`Gerado em: ${new Date().toLocaleString('pt-BR')}`]);
    sheet.addRow([]);

    const headerRow = sheet.addRow(report.columns.map((c) => c.header));
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    });

    for (const row of report.rows) {
      sheet.addRow(report.columns.map((c) => row[c.key] ?? ''));
    }

    sheet.columns.forEach((col) => {
      col.width = 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.filename}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
