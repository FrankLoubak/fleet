/**
 * ARQUIVO: src/pages/RouteHistory.tsx
 * O QUE FAZ: consulta o histórico de posições de um veículo num intervalo de datas,
 *   como tabela paginada (sem mapa — RESPOSTA confirmada na PARTE 7, pergunta 6).
 * PARA QUE SERVE: Rodada C / C3 — histórico de rotas (TR Salgueiro/PE, item 5.6.1-d).
 * MÓDULOS RELACIONADOS:
 *   - src/lib/routes/RouteHistoryService.ts — consulta paginada
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — criação inicial (Rodada C / C3)
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Menu, Loader2, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { Vehicle } from '../types';
import { supabase } from '../lib/supabase';
import { routeHistoryService } from '../lib/routes/RouteHistoryService';
import type { VehiclePosition } from '../lib/telemetry/TelemetryProvider';

const PAGE_SIZE = 20;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export default function RouteHistory() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [startDate, setStartDate] = useState(yesterdayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [page, setPage] = useState(1);
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (!userJson) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userJson);
    if (user.role !== 'Admin' && user.role !== 'Root') {
      navigate('/daily-report');
      return;
    }

    supabase.from('vehicles').select('*').order('plate').then(({ data }) => {
      const list = (data ?? []) as Vehicle[];
      setVehicles(list);
      if (list.length > 0) setSelectedVehicleId(list[0].id);
    });
  }, [navigate]);

  useEffect(() => {
    if (!selectedVehicleId) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const from = new Date(`${startDate}T00:00:00`);
        const to = new Date(`${endDate}T23:59:59`);
        const result = await routeHistoryService.getHistory(selectedVehicleId, from, to, page, PAGE_SIZE);
        setPositions(result.items);
        setTotalCount(result.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar histórico de rota.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedVehicleId, startDate, endDate, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col overflow-auto">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold dark:text-white flex items-center gap-2">
              <History size={20} className="text-primary" />
              Histórico de Rotas
            </h2>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          <div className="card p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Veículo</label>
              <select
                className="input-field"
                value={selectedVehicleId}
                onChange={(e) => { setSelectedVehicleId(e.target.value); setPage(1); }}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">De</label>
              <input type="date" className="input-field" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Até</label>
              <input type="date" className="input-field" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
            </div>
          </div>

          <div className="card overflow-hidden border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Data/Hora</th>
                    <th className="px-6 py-4">Latitude</th>
                    <th className="px-6 py-4">Longitude</th>
                    <th className="px-6 py-4 text-center">Velocidade (km/h)</th>
                    <th className="px-6 py-4 text-center">Ignição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-red-600 dark:text-red-400 text-sm">{error}</td>
                    </tr>
                  ) : positions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        <MapPin className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                        Nenhuma posição registrada no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    positions.map((p, i) => (
                      <tr key={`${p.recordedAt}-${i}`}>
                        <td className="px-6 py-3 font-medium dark:text-white">{new Date(p.recordedAt).toLocaleString('pt-BR')}</td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{p.latitude.toFixed(5)}</td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{p.longitude.toFixed(5)}</td>
                        <td className="px-6 py-3 text-center text-slate-600 dark:text-slate-300">{p.speedKmh ?? '—'}</td>
                        <td className="px-6 py-3 text-center">
                          {p.ignitionOn === null ? '—' : p.ignitionOn ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ligada</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-medium">Desligada</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && totalCount > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-500">
                  Página {page} de {totalPages} — {totalCount} posições
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
