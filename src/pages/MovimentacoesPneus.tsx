import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Loader2, ArrowRightLeft, ChevronDown, Search, X, BarChart3, Truck, CircleDot } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { User as UserType, Pneu } from '../types';
import { supabase } from '../lib/supabase';
import { derivarVida } from '../utils/tirePositions';

// ─── Local types ────────────────────────────────────────────────────────────

interface MovRow {
  id: string;
  pneuId: string;
  numeroFogo: string;
  tipo: string;
  vehiclePlate?: string;
  posicaoAnterior?: string;
  posicaoNova?: string;
  data: string;
  kmTotalPneu?: number;
  houveRecape?: boolean;
  profundidadeSulco?: number;
  motivoSucateamento?: string;
  createdAt: string;
}

type PneuRow = Pneu & { vehiclePlate?: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  entrada_estoque: 'Entrada Estoque',
  montagem: 'Montagem',
  desmontagem: 'Desmontagem',
  saida_conserto: 'Saída Conserto',
  retorno_conserto: 'Retorno Conserto',
  sucata: 'Sucata',
  medicao_sulco: 'Medição Sulco',
};

const TIPO_COLORS: Record<string, string> = {
  entrada_estoque: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  montagem: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  desmontagem: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  saida_conserto: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  retorno_conserto: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  sucata: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medicao_sulco: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const STATUS_LABEL: Record<string, string> = {
  estoque: 'Estoque',
  montado: 'Montado',
  conserto: 'Conserto',
  sucata: 'Sucata',
};

const VIDA_LABELS = ['1ª Vida', '2ª Vida', '3ª Vida'];

const PAGE_SIZE = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePneuRow(r: Record<string, unknown>): PneuRow {
  const v = r.vehicles as Record<string, unknown> | null;
  return {
    id: r.id as string,
    numeroFogo: r.numero_fogo as string,
    marca: r.marca as string,
    medida: r.medida as string,
    dataCompra: r.data_compra as string,
    data1Reforma: r.data_1_reforma as string | null,
    data2Reforma: r.data_2_reforma as string | null,
    kmTotal: Number(r.km_total),
    status: r.status as Pneu['status'],
    vehicleId: r.vehicle_id as string | null,
    posicao: r.posicao as string | null,
    createdAt: r.created_at as string,
    profundidadeSulco1vida: r.profundidade_sulco_1vida != null ? Number(r.profundidade_sulco_1vida) : null,
    profundidadeSulco2vida: r.profundidade_sulco_2vida != null ? Number(r.profundidade_sulco_2vida) : null,
    profundidadeSulco3vida: r.profundidade_sulco_3vida != null ? Number(r.profundidade_sulco_3vida) : null,
    kmNoUltimoSulco: Number(r.km_no_ultimo_sulco ?? 0),
    vehiclePlate: v?.plate as string | undefined,
  };
}

function rowClass(pneu: Pneu): string {
  if (pneu.status === 'sucata') return 'bg-slate-50 dark:bg-slate-900/50 text-slate-400';
  if (pneu.status === 'conserto') return 'bg-amber-50 dark:bg-amber-900/10';
  const vida = derivarVida(pneu);
  if (vida === 0) return 'bg-green-50 dark:bg-green-900/10';
  if (vida === 1) return 'bg-amber-50 dark:bg-amber-900/10';
  return 'bg-red-50 dark:bg-red-900/10';
}

function sulcoAtual(pneu: Pneu): string {
  const vida = derivarVida(pneu);
  const val = vida === 0
    ? pneu.profundidadeSulco1vida
    : vida === 1
    ? pneu.profundidadeSulco2vida
    : pneu.profundidadeSulco3vida;
  return val != null ? `${val.toFixed(1)} mm` : '—';
}

function fmtKm(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toLocaleString('pt-BR')} km`;
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

interface VidaKm { vida: number; km: number }
interface VehicleKm { plate: string; km: number }
interface PosKm { pos: string; km: number }
interface SulcoRow { vida: number; sulcoInicial: number | null; sulcoFinal: number | null; km: number }

function computeAnalytics(
  pneu: PneuRow,
  allMovs: MovRow[]
): {
  vidaKms: VidaKm[];
  vehicleKms: VehicleKm[];
  posKms: PosKm[];
  sulcoRows: SulcoRow[];
} {
  const sorted = [...allMovs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // KM per vida: detect recape events
  const recapes = sorted.filter(m => m.tipo === 'retorno_conserto' && m.houveRecape);
  const vidaKms: VidaKm[] = [];
  let prevKm = 0;
  recapes.forEach((r, i) => {
    const km = (r.kmTotalPneu ?? 0) - prevKm;
    vidaKms.push({ vida: i, km: Math.max(0, km) });
    prevKm = r.kmTotalPneu ?? 0;
  });
  // remaining km in current life
  const currentKm = Math.max(0, pneu.kmTotal - prevKm);
  vidaKms.push({ vida: recapes.length, km: currentKm });

  // KM per vehicle: montagem → desmontagem pairs
  const vehicleMap: Record<string, number> = {};
  let lastMontagem: MovRow | null = null;
  for (const m of sorted) {
    if (m.tipo === 'montagem') {
      lastMontagem = m;
    } else if ((m.tipo === 'desmontagem' || m.tipo === 'sucata') && lastMontagem) {
      const delta = Math.max(0, (m.kmTotalPneu ?? 0) - (lastMontagem.kmTotalPneu ?? 0));
      const plate = m.vehiclePlate ?? lastMontagem.vehiclePlate ?? '?';
      vehicleMap[plate] = (vehicleMap[plate] ?? 0) + delta;
      lastMontagem = null;
    }
  }
  // If still mounted
  if (lastMontagem) {
    const delta = Math.max(0, pneu.kmTotal - (lastMontagem.kmTotalPneu ?? 0));
    const plate = pneu.vehiclePlate ?? lastMontagem.vehiclePlate ?? '?';
    if (delta > 0) vehicleMap[plate] = (vehicleMap[plate] ?? 0) + delta;
  }
  const vehicleKms: VehicleKm[] = Object.entries(vehicleMap)
    .map(([plate, km]) => ({ plate, km }))
    .sort((a, b) => b.km - a.km);

  // KM per position: montagem → desmontagem pairs (by posicaoNova)
  const posMap: Record<string, number> = {};
  let lastMontagemPos: MovRow | null = null;
  for (const m of sorted) {
    if (m.tipo === 'montagem') {
      lastMontagemPos = m;
    } else if ((m.tipo === 'desmontagem' || m.tipo === 'sucata') && lastMontagemPos) {
      const delta = Math.max(0, (m.kmTotalPneu ?? 0) - (lastMontagemPos.kmTotalPneu ?? 0));
      const pos = lastMontagemPos.posicaoNova ?? '?';
      posMap[pos] = (posMap[pos] ?? 0) + delta;
      lastMontagemPos = null;
    }
  }
  if (lastMontagemPos) {
    const delta = Math.max(0, pneu.kmTotal - (lastMontagemPos.kmTotalPneu ?? 0));
    const pos = lastMontagemPos.posicaoNova ?? pneu.posicao ?? '?';
    if (delta > 0) posMap[pos] = (posMap[pos] ?? 0) + delta;
  }
  const posKms: PosKm[] = Object.entries(posMap)
    .map(([pos, km]) => ({ pos, km }))
    .sort((a, b) => b.km - a.km);

  // Last sulco measurement
  const lastSulco = [...sorted].reverse().find(m => m.tipo === 'medicao_sulco' && m.profundidadeSulco != null);
  const currentSulco = lastSulco?.profundidadeSulco ?? null;

  // Sulco table
  const sulcoRows: SulcoRow[] = [];
  if (pneu.profundidadeSulco1vida != null || vidaKms[0]?.km) {
    sulcoRows.push({
      vida: 0,
      sulcoInicial: pneu.profundidadeSulco1vida ?? null,
      sulcoFinal: pneu.profundidadeSulco2vida ?? (recapes.length === 0 ? currentSulco : null),
      km: vidaKms[0]?.km ?? 0,
    });
  }
  if (recapes.length >= 1) {
    sulcoRows.push({
      vida: 1,
      sulcoInicial: pneu.profundidadeSulco2vida ?? null,
      sulcoFinal: pneu.profundidadeSulco3vida ?? (recapes.length === 1 ? currentSulco : null),
      km: vidaKms[1]?.km ?? 0,
    });
  }
  if (recapes.length >= 2) {
    sulcoRows.push({
      vida: 2,
      sulcoInicial: pneu.profundidadeSulco3vida ?? null,
      sulcoFinal: currentSulco,
      km: vidaKms[2]?.km ?? 0,
    });
  }

  return { vidaKms, vehicleKms, posKms, sulcoRows };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MovimentacoesPneus() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Pneu table
  const [pneus, setPneus] = useState<PneuRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Combobox
  const [fogoSearch, setFogoSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Selected pneu
  const [selectedPneuId, setSelectedPneuId] = useState<string | null>(null);
  const selectedPneu = pneus.find(p => p.id === selectedPneuId) ?? null;

  // Analytics movs (all, for selected pneu)
  const [analyticsMovs, setAnalyticsMovs] = useState<MovRow[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Movements table
  const [movimentacoes, setMovimentacoes] = useState<MovRow[]>([]);
  const [filterTipo, setFilterTipo] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMovs, setLoadingMovs] = useState(false);

  // ── Auth guard
  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (!userJson) { navigate('/login'); return; }
    const user = JSON.parse(userJson);
    if (user.role !== 'Admin' && user.role !== 'Root') { navigate('/daily-report'); return; }
    setCurrentUser(user);
  }, [navigate]);

  // ── Load pneus
  const loadPneus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pneus')
        .select('*, vehicles(plate)')
        .order('numero_fogo');
      if (error) throw error;
      setPneus((data ?? []).map(r => normalizePneuRow(r as Record<string, unknown>)));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadPneus();
  }, [currentUser, loadPneus]);

  // ── Load analytics movs when pneu selected
  useEffect(() => {
    if (!selectedPneuId) { setAnalyticsMovs([]); return; }
    let cancelled = false;
    setLoadingAnalytics(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('movimentacoes_pneus')
          .select('*, vehicles(plate)')
          .eq('pneu_id', selectedPneuId)
          .order('created_at', { ascending: true });
        if (cancelled) return;
        setAnalyticsMovs(
          (data ?? []).map((r: Record<string, unknown>) => {
            const veh = r.vehicles as Record<string, unknown> | null;
            return {
              id: r.id as string,
              pneuId: r.pneu_id as string,
              numeroFogo: '',
              tipo: r.tipo as string,
              vehiclePlate: veh?.plate as string | undefined,
              posicaoAnterior: r.posicao_anterior as string | undefined,
              posicaoNova: r.posicao_nova as string | undefined,
              data: r.data as string,
              kmTotalPneu: r.km_total_pneu != null ? Number(r.km_total_pneu) : undefined,
              houveRecape: r.houve_recape as boolean | undefined,
              profundidadeSulco: r.profundidade_sulco != null ? Number(r.profundidade_sulco) : undefined,
              motivoSucateamento: r.motivo_sucateamento as string | undefined,
              createdAt: r.created_at as string,
            };
          })
        );
      } finally {
        if (!cancelled) setLoadingAnalytics(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPneuId]);

  // ── Load paginated movimentacoes
  const loadMovs = useCallback(async () => {
    if (!currentUser) return;
    setLoadingMovs(true);
    try {
      let query = supabase
        .from('movimentacoes_pneus')
        .select('*, pneus!inner(numero_fogo), vehicles(plate)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (selectedPneuId) query = query.eq('pneu_id', selectedPneuId);
      if (filterTipo) query = query.eq('tipo', filterTipo);
      const { data, error, count } = await query;
      if (error) throw error;
      setTotal(count ?? 0);
      setMovimentacoes(
        (data ?? []).map((r: Record<string, unknown>) => {
          const pneu = r.pneus as Record<string, unknown> | null;
          const veh = r.vehicles as Record<string, unknown> | null;
          return {
            id: r.id as string,
            pneuId: r.pneu_id as string,
            numeroFogo: (pneu?.numero_fogo as string) ?? '—',
            tipo: r.tipo as string,
            vehiclePlate: veh?.plate as string | undefined,
            posicaoAnterior: r.posicao_anterior as string | undefined,
            posicaoNova: r.posicao_nova as string | undefined,
            data: r.data as string,
            kmTotalPneu: r.km_total_pneu != null ? Number(r.km_total_pneu) : undefined,
            houveRecape: r.houve_recape as boolean | undefined,
            profundidadeSulco: r.profundidade_sulco != null ? Number(r.profundidade_sulco) : undefined,
            motivoSucateamento: r.motivo_sucateamento as string | undefined,
            createdAt: r.created_at as string,
          };
        })
      );
    } catch {
      // silently fail
    } finally {
      setLoadingMovs(false);
    }
  }, [currentUser, selectedPneuId, filterTipo, page]);

  useEffect(() => { loadMovs(); }, [loadMovs]);

  // ── Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Combobox filtered list
  const comboOptions = fogoSearch.length >= 1
    ? pneus.filter(p => p.numeroFogo.toLowerCase().includes(fogoSearch.toLowerCase())).slice(0, 20)
    : pneus.slice(0, 20);

  const selectPneu = (p: PneuRow) => {
    setSelectedPneuId(p.id);
    setFogoSearch('');
    setShowDropdown(false);
    setPage(0);
  };

  const clearPneu = () => {
    setSelectedPneuId(null);
    setFogoSearch('');
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Analytics
  const analytics = selectedPneu && analyticsMovs.length >= 0
    ? computeAnalytics(selectedPneu, analyticsMovs)
    : null;

  const maxVehicleKm = analytics ? Math.max(...analytics.vehicleKms.map(v => v.km), 1) : 1;
  const maxPosKm = analytics ? Math.max(...analytics.posKms.map(v => v.km), 1) : 1;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex items-center gap-3 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <Menu size={20} />
          </button>
          <ArrowRightLeft size={20} className="text-primary hidden md:block" />
          <h2 className="text-xl font-bold dark:text-white">Movimentação de Pneus</h2>
        </header>

        <div className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">

          {/* ── Combobox ── */}
          <div className="card p-4" ref={comboRef}>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Buscar pneu por Nº Fogo
            </label>
            {selectedPneu ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <CircleDot size={14} className="text-primary shrink-0" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{selectedPneu.numeroFogo}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">— {selectedPneu.marca} {selectedPneu.medida}</span>
                  <span className="ml-auto text-xs font-semibold text-primary">{STATUS_LABEL[selectedPneu.status]}</span>
                </div>
                <button onClick={clearPneu} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-primary">
                  <Search size={15} className="ml-3 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Digite o Nº Fogo..."
                    value={fogoSearch}
                    onChange={e => { setFogoSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none dark:text-white"
                  />
                  <ChevronDown size={14} className="mr-3 text-slate-400" />
                </div>
                {showDropdown && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {comboOptions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">Nenhum pneu encontrado</div>
                    ) : (
                      comboOptions.map(p => (
                        <button
                          key={p.id}
                          onMouseDown={() => selectPneu(p)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                        >
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{p.numeroFogo}</span>
                          <span className="text-xs text-slate-400">{p.marca} · {p.medida} · {STATUS_LABEL[p.status]}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Pneu table ── */}
          <div className="card overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Todos os Pneus</h3>
              <span className="text-xs text-slate-400">{pneus.length} pneus</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                        {['Nº Fogo', 'Marca', 'Medida', 'Status', 'Vida', 'KM Total', 'Sulco Atual', 'Veículo', 'Posição'].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pneus.map(p => {
                        const isSelected = p.id === selectedPneuId;
                        const vida = derivarVida(p);
                        return (
                          <tr
                            key={p.id}
                            onClick={() => { setSelectedPneuId(isSelected ? null : p.id); setPage(0); }}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-400' : rowClass(p)} hover:brightness-95`}
                          >
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">{p.numeroFogo}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.marca}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-xs">{p.medida}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`text-xs font-semibold ${p.status === 'sucata' ? 'text-slate-400' : p.status === 'montado' ? 'text-blue-600 dark:text-blue-400' : p.status === 'conserto' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                                {STATUS_LABEL[p.status]}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`text-xs font-semibold ${vida === 0 ? 'text-green-600 dark:text-green-400' : vida === 1 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                {VIDA_LABELS[vida]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.kmTotal.toLocaleString('pt-BR')}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-xs">{sulcoAtual(p)}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.vehiclePlate ?? '—'}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">{p.posicao ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Dashboard ── */}
          {selectedPneu ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">
                  Dashboard — Pneu {selectedPneu.numeroFogo}
                </h3>
                {loadingAnalytics && <Loader2 size={14} className="text-primary animate-spin" />}
              </div>

              {/* KM stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2].map(vida => {
                  const entry = analytics?.vidaKms.find(v => v.vida === vida);
                  return (
                    <div key={vida} className="card p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">KM {VIDA_LABELS[vida]}</p>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmtKm(entry?.km ?? null)}</p>
                    </div>
                  );
                })}
                <div className="card p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">KM Total</p>
                  <p className="text-lg font-bold text-primary">{fmtKm(selectedPneu.kmTotal)}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* KM por veículo */}
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck size={14} className="text-slate-400" />
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">KM por Veículo</h4>
                  </div>
                  {analytics && analytics.vehicleKms.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.vehicleKms.map(v => (
                        <div key={v.plate}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{v.plate}</span>
                            <span className="text-slate-500 dark:text-slate-400">{v.km.toLocaleString('pt-BR')} km</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round((v.km / maxVehicleKm) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Sem dados de veículo</p>
                  )}
                </div>

                {/* KM por posição */}
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CircleDot size={14} className="text-slate-400" />
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">KM por Posição</h4>
                  </div>
                  {analytics && analytics.posKms.length > 0 ? (
                    <div className="space-y-2">
                      {analytics.posKms.map(v => (
                        <div key={v.pos}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{v.pos}</span>
                            <span className="text-slate-500 dark:text-slate-400">{v.km.toLocaleString('pt-BR')} km</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.round((v.km / maxPosKm) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Sem dados de posição</p>
                  )}
                </div>
              </div>

              {/* Sulco table */}
              {analytics && analytics.sulcoRows.length > 0 && (
                <div className="card p-4">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Desgaste do Sulco</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800">
                          {['Vida', 'Sulco Inicial', 'Sulco Final', 'KM Rodados'].map(h => (
                            <th key={h} className="text-left pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider pr-6">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                        {analytics.sulcoRows.map(row => (
                          <tr key={row.vida}>
                            <td className="py-2 pr-6 font-semibold text-slate-700 dark:text-slate-200 text-xs">{VIDA_LABELS[row.vida]}</td>
                            <td className="py-2 pr-6 text-slate-500 dark:text-slate-400 font-mono text-xs">{row.sulcoInicial != null ? `${row.sulcoInicial.toFixed(1)} mm` : '—'}</td>
                            <td className="py-2 pr-6 text-slate-500 dark:text-slate-400 font-mono text-xs">{row.sulcoFinal != null ? `${row.sulcoFinal.toFixed(1)} mm` : '—'}</td>
                            <td className="py-2 font-semibold text-slate-700 dark:text-slate-200">{fmtKm(row.km)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 flex flex-col items-center justify-center text-slate-400 gap-3">
              <BarChart3 size={36} className="opacity-30" />
              <p className="text-sm">Selecione um pneu para ver o dashboard</p>
            </div>
          )}

          {/* ── Historico movimentacoes ── */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                <ArrowRightLeft size={15} className="text-slate-400" />
                {selectedPneu ? `Histórico — ${selectedPneu.numeroFogo}` : 'Histórico de Movimentações'}
              </h3>
              <div className="relative ml-auto">
                <select
                  value={filterTipo}
                  onChange={e => { setFilterTipo(e.target.value); setPage(0); }}
                  className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 pr-7 focus:ring-2 focus:ring-primary dark:text-white appearance-none"
                >
                  <option value="">Todos os tipos</option>
                  {Object.entries(TIPO_LABEL).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-xs text-slate-400">{total} registro{total !== 1 ? 's' : ''}</span>
            </div>

            <div className="card overflow-hidden">
              {loadingMovs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                </div>
              ) : movimentacoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <ArrowRightLeft size={32} className="opacity-30" />
                  <p className="text-sm">Nenhuma movimentação encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        {['Data', 'Nº Fogo', 'Tipo', 'Veículo', 'Pos. Ant.', 'Pos. Nova', 'KM Pneu', 'Recape', 'Sulco', 'Motivo Sucata'].map(h => (
                          <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {movimentacoes.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                            {new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{m.numeroFogo}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${TIPO_COLORS[m.tipo] ?? ''}`}>
                              {TIPO_LABEL[m.tipo] ?? m.tipo}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">{m.vehiclePlate ?? '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{m.posicaoAnterior ?? '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{m.posicaoNova ?? '—'}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {m.kmTotalPneu != null ? `${m.kmTotalPneu.toLocaleString('pt-BR')} km` : '—'}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {m.houveRecape === true ? (
                              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">Sim</span>
                            ) : m.houveRecape === false ? (
                              <span className="text-xs text-slate-400">Não</span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {m.profundidadeSulco != null ? `${m.profundidadeSulco.toFixed(1)} mm` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {m.motivoSucateamento ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white transition-colors"
                >
                  Anterior
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400">{page + 1} / {totalPages}</span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white transition-colors"
                >
                  Próximo
                </button>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
