/**
 * ARQUIVO: src/lib/reports/index.ts
 * O QUE FAZ: ponto único de acesso aos exportadores de relatório disponíveis.
 * PARA QUE SERVE: Rodada C / C4 — ExportMenu.tsx e as páginas consumidoras escolhem o
 *   formato sem conhecer ExcelExporter/PdfExporter/TxtExporter diretamente.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/reports/ExcelExporter.ts, PdfExporter.ts, TxtExporter.ts
 *   - src/components/ExportMenu.tsx — consome reportExporters
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-22 — criação inicial (Rodada C / C4)
 */

import type { ReportExporter } from './ReportExporter';
import { ExcelExporter } from './ExcelExporter';
import { PdfExporter } from './PdfExporter';
import { TxtExporter } from './TxtExporter';

export type { ReportExporter, ReportData, ReportColumn } from './ReportExporter';

export const reportExporters: ReportExporter[] = [new ExcelExporter(), new PdfExporter(), new TxtExporter()];
