/**
 * Testes de src/lib/reports — Rodada C / C4.
 */
import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { jsPDF as JsPdfCtor } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TxtExporter } from '../lib/reports/TxtExporter';
import { ExcelExporter } from '../lib/reports/ExcelExporter';
import { PdfExporter } from '../lib/reports/PdfExporter';
import type { ReportData } from '../lib/reports/ReportExporter';

const REPORT: ReportData = {
  title: 'Jornadas',
  period: '01/09/2026 a 30/09/2026',
  filename: 'jornadas-teste',
  columns: [
    { header: 'Veículo', key: 'veiculo' },
    { header: 'Observações', key: 'obs' },
  ],
  rows: [
    { veiculo: 'ABC-1234', obs: 'Sem intercorrências' },
    { veiculo: 'DEF-5678', obs: 'Parou; reabasteceu' },
  ],
};

// jsdom não implementa `Blob.prototype.text()`/`arrayBuffer()` (ver src/tests/setup.ts) —
// FileReader funciona nesse ambiente e serve pra ler de volta o conteúdo gerado.
function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}
function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

// Captura o Blob que cada exporter cria antes de disparar o download
// (createElement('a').click()), pra inspecionar o conteúdo gerado.
function captureBlob() {
  const blobs: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
    blobs.push(blob);
    return 'blob:mock';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return blobs;
}

describe('TxtExporter', () => {
  it('gera TXT delimitado por ; com cabeçalho e escapa campos com ;', async () => {
    const blobs = captureBlob();
    await new TxtExporter().export(REPORT);

    const text = await readBlobAsText(blobs[0]);
    expect(text).toContain('FleetManager — Jornadas');
    expect(text).toContain('Período: 01/09/2026 a 30/09/2026');
    expect(text).toContain('Veículo;Observações');
    expect(text).toContain('ABC-1234;Sem intercorrências');
    // Campo com ";" dentro precisa vir entre aspas, senão quebraria as colunas.
    expect(text).toContain('DEF-5678;"Parou; reabasteceu"');
  });
});

describe('ExcelExporter', () => {
  it('gera um .xlsx válido com o cabeçalho e as linhas de dados', async () => {
    const blobs = captureBlob();
    await new ExcelExporter().export(REPORT);

    const buffer = await readBlobAsArrayBuffer(blobs[0]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    expect(sheet.getCell('A1').value).toContain('Jornadas');
    // linha 1: título, 2: período, 3: gerado em, 4: vazia, 5: cabeçalho, 6+: dados
    expect(sheet.getRow(5).getCell(1).value).toBe('Veículo');
    expect(sheet.getRow(6).getCell(1).value).toBe('ABC-1234');
  });
});

describe('PdfExporter', () => {
  it('export() resolve sem lançar erro', async () => {
    await expect(new PdfExporter().export(REPORT)).resolves.toBeUndefined();
  });

  it('produz um documento com assinatura %PDF válida para os mesmos dados', () => {
    // jsPDF.save() dispara o download por um caminho interno que não expõe o buffer
    // gerado (não usa URL.createObjectURL neste ambiente) — replica aqui a mesma
    // montagem de doc.text()+autoTable() de PdfExporter.export() para inspecionar
    // doc.output() diretamente, sem duplicar a decisão de layout (só a chamada).
    const doc = new JsPdfCtor({ orientation: 'landscape' });
    doc.text(`FleetManager — ${REPORT.title}`, 14, 15);
    autoTable(doc, {
      head: [REPORT.columns.map((c) => c.header)],
      body: REPORT.rows.map((row) => REPORT.columns.map((c) => String(row[c.key] ?? ''))),
    });
    expect(doc.output().startsWith('%PDF')).toBe(true);
  });
});
