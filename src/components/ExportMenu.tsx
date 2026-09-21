/**
 * ARQUIVO: src/components/ExportMenu.tsx
 * O QUE FAZ: botão com menu suspenso (Excel/PDF/TXT) que aciona a exportação de um
 *   ReportData já pronto — reutilizável em qualquer página que precise exportar dados.
 * PARA QUE SERVE: Rodada C / C4 — botão de exportação em Journeys.tsx, RouteHistory.tsx
 *   e Dashboard.tsx (TR Salgueiro/PE, item 5.6.2-b).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/reports/index.ts (reportExporters) — formatos disponíveis
 *   - src/pages/Journeys.tsx, RouteHistory.tsx, Dashboard.tsx — consumidores
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-22 — criação inicial (Rodada C / C4)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportExporters } from '../lib/reports';
import type { ReportData } from '../lib/reports';

interface ExportMenuProps {
  // Função em vez de objeto pronto: monta o ReportData só quando o usuário realmente
  // clica em exportar, evitando recalcular a cada render da página. Pode ser async —
  // RouteHistory.tsx precisa buscar o período inteiro antes de montar o relatório.
  buildReport: () => ReportData | Promise<ReportData>;
  disabled?: boolean;
}

export default function ExportMenu({ buildReport, disabled }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (formatIndex: number) => {
    const exporter = reportExporters[formatIndex];
    setExportingFormat(exporter.format);
    setIsOpen(false);
    try {
      const report = await buildReport();
      await exporter.export(report);
    } catch (_err) {
      toast.error(`Erro ao gerar relatório em ${exporter.label}.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const isExporting = exportingFormat !== null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        <span>Exportar</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          {reportExporters.map((exporter, index) => (
            <button
              key={exporter.format}
              type="button"
              onClick={() => handleExport(index)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-200 transition-colors"
            >
              {exporter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
