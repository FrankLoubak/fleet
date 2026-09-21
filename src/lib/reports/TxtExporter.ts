/**
 * ARQUIVO: src/lib/reports/TxtExporter.ts
 * O QUE FAZ: gera um arquivo TXT delimitado por ponto-e-vírgula (`;`) a partir de um
 *   ReportData e dispara o download no navegador.
 * PARA QUE SERVE: Rodada C / C4 — formato de texto delimitado (RESPOSTA confirmada na
 *   PARTE 7, pergunta 8: `;` evita conflito com vírgula decimal em campos numéricos).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/reports/ReportExporter.ts — interface implementada aqui
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-22 — criação inicial (Rodada C / C4)
 */

import type { ReportData, ReportExporter } from './ReportExporter';

// Campos com `;`, quebra de linha ou aspas precisam ser envolvidos em aspas (regra CSV
// padrão) — sem isto, uma observação de jornada com ";" dentro quebraria as colunas.
function escapeField(value: string | number): string {
  const str = String(value);
  if (str.includes(';') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class TxtExporter implements ReportExporter {
  readonly format = 'txt' as const;
  readonly label = 'TXT (;)';

  async export(report: ReportData): Promise<void> {
    const linhas: string[] = [];
    linhas.push(`FleetManager — ${report.title}`);
    if (report.period) linhas.push(`Período: ${report.period}`);
    linhas.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    linhas.push('');
    linhas.push(report.columns.map((c) => escapeField(c.header)).join(';'));
    for (const row of report.rows) {
      linhas.push(report.columns.map((c) => escapeField(row[c.key] ?? '')).join(';'));
    }

    const blob = new Blob([linhas.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
