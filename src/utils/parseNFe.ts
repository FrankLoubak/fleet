import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Worker local via Vite — garante compatibilidade exata com a versão instalada
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface NFeItem {
  descricao: string;   // descrição completa do produto
  medida: string;      // ex: "275/80R22.5" extraído da descrição
  quantidade: number;
  dataCompra: string;  // ISO "YYYY-MM-DD"
  valorUnitario?: number;
}

// ---------------------------------------------------------------------------
// XML NF-e parser
// ---------------------------------------------------------------------------
export function parseNFeXML(xmlContent: string): NFeItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // Data de emissão — pode vir como dhEmi (com hora) ou dEmi (só data)
  const dhEmi =
    doc.querySelector('dhEmi')?.textContent ||
    doc.querySelector('dEmi')?.textContent || '';
  const dataCompra = dhEmi.split('T')[0].split('-').reverse().join('/');
  // dataCompra agora está em dd/mm/aaaa — converter para ISO
  const dataISO = dataCompra ? convertDateToISO(dataCompra) : new Date().toISOString().split('T')[0];

  const dets = Array.from(doc.querySelectorAll('det'));
  const items: NFeItem[] = [];

  for (const det of dets) {
    const xProd = det.querySelector('xProd')?.textContent?.trim() || '';
    const qCom = parseFloat(
      (det.querySelector('qCom')?.textContent || '0').replace(',', '.')
    );
    const vUnCom = parseFloat(
      (det.querySelector('vUnCom')?.textContent || '0').replace(',', '.')
    );

    if (qCom <= 0) continue;

    items.push({
      descricao: xProd,
      medida: extractMedida(xProd),
      quantidade: Math.round(qCom),
      dataCompra: dataISO,
      valorUnitario: vUnCom || undefined,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// PDF DANFE parser — reconstrói linhas por posição Y antes de aplicar regex
// ---------------------------------------------------------------------------
export async function parseNFePDF(file: File): Promise<NFeItem[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  interface RawItem { str: string; x: number; y: number }
  const rawItems: RawItem[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items) {
      const t = it as { str: string; transform: number[] };
      if (t.str && t.str.trim()) {
        rawItems.push({ str: t.str, x: t.transform[4], y: t.transform[5] });
      }
    }
  }

  // Agrupa itens por linha (y arredondado a 1 decimal)
  const lineMap = new Map<number, RawItem[]>();
  for (const item of rawItems) {
    const key = Math.round(item.y * 2) / 2; // resolução 0.5pt
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key)!.push(item);
  }

  // Ordena linhas topo→base (y maior = mais alto na página)
  const lines = [...lineMap.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, items]) =>
      items
        .sort((a, b) => a.x - b.x)
        .map(i => i.str)
        .join(' ')
    );

  const fullText = lines.join('\n');
  return parseDanfeText(fullText);
}

// ---------------------------------------------------------------------------
// Parseia texto reconstruído do DANFE
// ---------------------------------------------------------------------------
function parseDanfeText(text: string): NFeItem[] {
  const items: NFeItem[] = [];
  const found = new Set<string>();

  // Data de emissão
  const dateMatch = text.match(/DATA\s+DE\s+EMISS[ÃA]O\s+(\d{2}\/\d{2}\/\d{4})/i);
  const dataCompra = dateMatch
    ? convertDateToISO(dateMatch[1])
    : new Date().toISOString().split('T')[0];

  // ── Estratégia 1: linha completa com NCM ────────────────────────────────
  // Padrão: COD DESCRIÇÃO 8dNCM 3dCST 4dCFOP UN qtd
  const lineRegex =
    /[A-Z0-9]{3,20}\s+([\w\/\s.,%-]+?)\s+\d{8}\s+\d{3}\s+\d{4}\s+UN\s+([\d,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = lineRegex.exec(text)) !== null) {
    const desc = m[1].trim().replace(/\s+/g, ' ');
    if (!desc || desc.toLowerCase().includes('descri')) continue;
    const qty = Math.round(parseFloat(m[2].replace(',', '.')));
    if (qty <= 0 || qty > 999) continue;
    const key = `${desc}|${qty}`;
    if (!found.has(key)) {
      found.add(key);
      items.push({ descricao: desc, medida: extractMedida(desc), quantidade: qty, dataCompra });
    }
  }

  if (items.length > 0) return items;

  // ── Estratégia 2: medida de pneu + UN + qtd (sem depender do NCM) ───────
  // Varre o texto inteiro procurando "275/80R22.5 ... UN 2,0000"
  const tireRegex = /(\d{3}\/\d{2,3}R[\d.]+(?:\s+[\w./-]+){0,6}?)\s+(?:\d{5,}\s+\d+\s+\d+\s+)?UN\s+([\d,]+)/gi;
  while ((m = tireRegex.exec(text)) !== null) {
    const desc = m[1].trim().replace(/\s+/g, ' ');
    const qty = Math.round(parseFloat(m[2].replace(',', '.')));
    if (qty <= 0 || qty > 999) continue;
    const key = `${desc}|${qty}`;
    if (!found.has(key)) {
      found.add(key);
      items.push({ descricao: desc, medida: extractMedida(desc), quantidade: qty, dataCompra });
    }
  }

  if (items.length > 0) return items;

  // ── Estratégia 3: só medida de pneu + quantidade após UN ─────────────────
  const lines = text.split('\n');
  for (const line of lines) {
    const sizeMatch = line.match(/(\d{3}\/\d{2,3}R[\d.]+)/);
    if (!sizeMatch) continue;
    const qtyMatch = line.match(/UN\s+([\d,]+)/i);
    if (!qtyMatch) continue;
    const qty = Math.round(parseFloat(qtyMatch[1].replace(',', '.')));
    if (qty <= 0 || qty > 999) continue;
    const desc = line.substring(line.indexOf(sizeMatch[1])).split(/\s{3,}/)[0].trim();
    const key = `${desc}|${qty}`;
    if (!found.has(key)) {
      found.add(key);
      items.push({ descricao: desc, medida: sizeMatch[1], quantidade: qty, dataCompra });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extrai medida no formato "275/80R22.5" de uma descrição de pneu */
export function extractMedida(descricao: string): string {
  const m = descricao.match(/(\d{3}\/\d{2,3}R[\d.]+)/);
  return m ? m[1] : descricao.split(' ')[0];
}

/** Converte "dd/mm/aaaa" → "aaaa-mm-dd" */
export function convertDateToISO(dateBR: string): string {
  const parts = dateBR.split('/');
  if (parts.length !== 3) return dateBR;
  return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
}
