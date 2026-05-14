import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Plus,
  Loader2,
  Truck,
  Package,
  Wrench,
  Trash2,
  X,
  AlertTriangle,
  FileUp,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  Modifier,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS, getEventCoordinates } from '@dnd-kit/utilities';
import Sidebar from '../components/Sidebar';
import { User as UserType, VehicleConfig, Pneu, MovimentacaoPneu } from '../types';
import { supabase } from '../lib/supabase';
import {
  getPositionsForAxle,
  buildPosition,
  buildReservaPosition,
  derivarVida,
  VIDA_CLASSES,
  VIDA_LABEL,
} from '../utils/tirePositions';
import { parseNFeXML, parseNFePDF, NFeItem } from '../utils/parseNFe';

// ---------------------------------------------------------------------------
// DragOverlay modifier — centraliza o card compacto (64×48 px) no cursor
// ---------------------------------------------------------------------------
// w-16 = 64px, h-12 = 48px
const COMPACT_W = 64;
const COMPACT_H = 48;

// IMPORTANTE: usa activeNodeRect (rect do elemento original, medido sem transform,
// estável durante todo o drag) em vez de draggingNodeRect (que é o rect do próprio
// overlay medido COM transform — muda a cada frame e cria feedback loop).
const snapCompactToCursor: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  if (activeNodeRect && activatorEvent) {
    const coords = getEventCoordinates(activatorEvent);
    if (!coords) return transform;
    return {
      ...transform,
      x: transform.x + (coords.x - activeNodeRect.left) - COMPACT_W / 2,
      y: transform.y + (coords.y - activeNodeRect.top) - COMPACT_H / 2,
    };
  }
  return transform;
};

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function normalizePneu(r: Record<string, unknown>): Pneu {
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
  };
}

function normalizeConfig(r: Record<string, unknown>): VehicleConfig {
  return {
    id: r.id as string,
    nome: r.nome as string,
    eixo1: r.eixo_1 as number,
    eixo2: r.eixo_2 as number | null,
    eixo3: r.eixo_3 as number | null,
    eixo4: r.eixo_4 as number | null,
    pneusReserva: r.pneus_reserva as number,
    createdAt: r.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// TireCardCompact — pure visual, used inside DragOverlay (no drag hooks)
// ---------------------------------------------------------------------------

const TireCardCompact: React.FC<{ pneu: Pneu }> = ({ pneu }) => {
  const vida = derivarVida(pneu);
  return (
    <div
      className={`w-16 h-12 rounded-lg text-xs font-bold select-none flex flex-col items-center justify-center ${VIDA_CLASSES[vida]}`}
    >
      <div className="font-bold leading-tight">{pneu.numeroFogo}</div>
      <div className="text-[9px] opacity-80 mt-0.5">{pneu.kmTotal.toLocaleString('pt-BR')} km</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// DraggableTire — standalone component
// ---------------------------------------------------------------------------

const DraggableTire: React.FC<{
  pneu: Pneu
  disabled?: boolean
  compact?: boolean
  isLongPressed?: boolean
  onLongPressStart?: () => void
  onLongPressEnd?: () => void
}> = ({
  pneu,
  disabled,
  compact = false,
  isLongPressed = false,
  onLongPressStart,
  onLongPressEnd,
}) => {
  const vida = derivarVida(pneu);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: pneu.id,
    disabled: disabled || pneu.status === 'sucata',
    data: { pneu },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    longPressTimerRef.current = setTimeout(() => {
      onLongPressStart?.();
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    onLongPressEnd?.();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDown={(e) => {
        handlePointerDown(e);
        listeners?.onPointerDown?.(e as any);
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`rounded-lg text-xs font-bold cursor-grab select-none transition-all ${
        isLongPressed ? 'ring-2 ring-offset-2 ring-primary scale-105 shadow-lg' : ''
      } ${VIDA_CLASSES[vida]} ${
        disabled ? 'cursor-default opacity-60' : ''
      } ${compact ? 'w-full h-full flex flex-col items-center justify-center px-1 py-1' : 'px-3 py-2 w-full'}`}
      title={`${isLongPressed ? '🎯 ' : ''}Nº Fogo: ${pneu.numeroFogo} | ${pneu.marca} | ${pneu.medida} | ${VIDA_LABEL[vida]} | ${pneu.kmTotal.toLocaleString('pt-BR')} km`}
    >
      {compact ? (
        <>
          <div className="font-bold leading-tight text-center">{pneu.numeroFogo}</div>
          <div className="text-[9px] opacity-80 mt-0.5 text-center">{pneu.kmTotal.toLocaleString('pt-BR')} km</div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold leading-tight">Nº {pneu.numeroFogo}</div>
            <div className="text-[10px] opacity-80 mt-0.5">{pneu.medida}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] opacity-70">{pneu.kmTotal.toLocaleString('pt-BR')} km</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// DroppableZone — standalone component
// ---------------------------------------------------------------------------

const DroppableZone: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
}> = ({ id, children, className }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ''} transition-colors ${
        isOver ? 'ring-2 ring-primary ring-offset-1' : ''
      }`}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Axle schema renderer — React component
// ---------------------------------------------------------------------------

function renderAxleSchema(
  config: VehicleConfig,
  tiresByPosition: Map<string, Pneu>,
  longPressId: string | null,
  setLongPressId: (id: string | null) => void
) {
  const eixos = [
    { n: 1, count: config.eixo1 },
    { n: 2, count: config.eixo2 },
    { n: 3, count: config.eixo3 },
    { n: 4, count: config.eixo4 },
  ].filter((e): e is { n: number; count: number } => e.count != null && e.count > 0);

  return (
    <div className="space-y-3">
      {eixos.map(({ n, count }) => {
        const slots = getPositionsForAxle(count);
        const half = Math.ceil(count / 2);
        const leftSlots = slots.slice(0, half);
        const rightSlots = slots.slice(half);

        return (
          <div key={n} className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-500 w-12 shrink-0">Eixo {n}</span>

            {/* Grupos de pneus centralizados com divisória pequena entre lados */}
            <div className="flex flex-1 items-center justify-center md:justify-center min-w-0">
              <div className="flex items-center gap-1">
                {leftSlots.map((slot) => {
                  const posKey = buildPosition(n, slot);
                  const tire = tiresByPosition.get(posKey);
                  return (
                    <DroppableZone
                      key={posKey}
                      id={`pos:${posKey}`}
                      className="w-12 h-10 sm:w-14 md:w-16 md:h-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center shrink-0"
                    >
                      {tire ? (
                        <DraggableTire
                          pneu={tire}
                          compact
                          isLongPressed={longPressId === tire.id}
                          onLongPressStart={() => setLongPressId(tire.id)}
                          onLongPressEnd={() => setLongPressId(null)}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">{slot}</span>
                      )}
                    </DroppableZone>
                  );
                })}

                {/* Divisória central representando o eixo do veículo */}
                <div className="w-4 h-1 sm:w-5 sm:h-1.5 md:w-6 md:h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-1 sm:mx-1.5 md:mx-2 shrink-0" />

                {rightSlots.map((slot) => {
                  const posKey = buildPosition(n, slot);
                  const tire = tiresByPosition.get(posKey);
                  return (
                    <DroppableZone
                      key={posKey}
                      id={`pos:${posKey}`}
                      className="w-12 h-10 sm:w-14 md:w-16 md:h-12 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center shrink-0"
                    >
                      {tire ? (
                        <DraggableTire
                          pneu={tire}
                          compact
                          isLongPressed={longPressId === tire.id}
                          onLongPressStart={() => setLongPressId(tire.id)}
                          onLongPressEnd={() => setLongPressId(null)}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">{slot}</span>
                      )}
                    </DroppableZone>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Spare tires row */}
      {config.pneusReserva > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 w-16 shrink-0">Reserva</span>
          <div className="flex gap-1">
            {Array.from({ length: config.pneusReserva }, (_, i) => {
              const posKey = buildReservaPosition(i + 1);
              const tire = tiresByPosition.get(posKey);
              return (
                <DroppableZone
                  key={posKey}
                  id={`pos:${posKey}`}
                  className="w-12 h-10 sm:w-14 md:w-16 md:h-12 border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-lg flex items-center justify-center shrink-0"
                >
                  {tire ? (
                    <DraggableTire
                      pneu={tire}
                      isLongPressed={longPressId === tire.id}
                      onLongPressStart={() => setLongPressId(tire.id)}
                      onLongPressEnd={() => setLongPressId(null)}
                    />
                  ) : (
                    <span className="text-xs text-amber-400">R{i + 1}</span>
                  )}
                </DroppableZone>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function Pneus() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Vehicles
  const [vehicles, setVehicles] = useState<
    { id: string; plate: string; model: string; config_id: string | null }[]
  >([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedConfig, setSelectedConfig] = useState<VehicleConfig | null>(null);

  // Tires
  const [pneus, setPneus] = useState<Pneu[]>([]);

  // Modals
  const [isNovoPneuOpen, setIsNovoPneuOpen] = useState(false);
  const [isImportNFOpen, setIsImportNFOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importItems, setImportItems] = useState<NFeItem[]>([]);
  const [importSelected, setImportSelected] = useState<boolean[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importInserting, setImportInserting] = useState(false);
  const [importStartFogo, setImportStartFogo] = useState(1);
  const [sucataTarget, setSucataTarget] = useState<Pneu | null>(null);
  const [retornoTarget, setRetornoTarget] = useState<{
    pneu: Pneu;
    destino: string | null;
  } | null>(null);
  const [movimentandoId, setMovimentandoId] = useState<string | null>(null);
  const [activePneu, setActivePneu] = useState<Pneu | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New tire form
  const [novoPneuForm, setNovoPneuForm] = useState({
    numeroFogo: '',
    marca: '',
    medida: '',
    dataCompra: '',
    profundidadeSulco: '',
  });
  const [savingNovoPneu, setSavingNovoPneu] = useState(false);

  // Sulco / sucata modal states
  const [retornoSulco, setRetornoSulco] = useState('');
  const [sucataMotivo, setSucataMotivo] = useState('');
  const [sucataSulco, setSucataSulco] = useState('');

  // DnD sensors — PointerSensor para desktop, TouchSensor para mobile
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const tiresByPosition = useMemo(() => {
    const map = new Map<string, Pneu>();
    pneus
      .filter((p) => p.vehicleId === selectedVehicleId && p.posicao)
      .forEach((p) => {
        map.set(p.posicao!, p);
      });
    return map;
  }, [pneus, selectedVehicleId]);

  const stockTires = useMemo(() => pneus.filter((p) => p.status === 'estoque'), [pneus]);
  const repairTires = useMemo(() => pneus.filter((p) => p.status === 'conserto'), [pneus]);
  const scrapTires = useMemo(() => pneus.filter((p) => p.status === 'sucata'), [pneus]);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadPneus = async () => {
    try {
      const { data, error } = await supabase
        .from('pneus')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPneus((data ?? []).map((r) => normalizePneu(r as Record<string, unknown>)));
    } catch {
      toast.error('Erro ao carregar pneus');
    }
  };

  const handleImportFile = async (file: File) => {
    setImportLoading(true);
    setImportItems([]);
    setImportFileName(file.name);
    try {
      let items: NFeItem[] = [];
      if (file.name.toLowerCase().endsWith('.xml') || file.name.toLowerCase().endsWith('.nfe')) {
        const text = await file.text();
        items = parseNFeXML(text);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        items = await parseNFePDF(file);
      } else {
        toast.error('Formato não suportado. Use PDF ou XML.');
        return;
      }
      if (items.length === 0) {
        toast.error('Nenhum produto encontrado no arquivo.');
        return;
      }
      setImportItems(items);
      setImportSelected(items.map(() => true));
      // Calcula próximo número de fogo disponível
      const { data: fogos } = await supabase.from('pneus').select('numero_fogo');
      let maxFogo = 0;
      (fogos || []).forEach((r: { numero_fogo: string }) => {
        const n = parseInt(r.numero_fogo, 10);
        if (!isNaN(n) && n > maxFogo) maxFogo = n;
      });
      setImportStartFogo(maxFogo + 1);
    } catch {
      toast.error('Erro ao processar arquivo.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportConfirm = async () => {
    const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
    const selected = importItems.filter((_, i) => importSelected[i]);
    if (selected.length === 0) return;

    setImportInserting(true);
    try {
      // Busca maior numero_fogo numérico existente
      const { data: existingFogos } = await supabase
        .from('pneus')
        .select('numero_fogo');

      let maxFogo = 0;
      (existingFogos || []).forEach(r => {
        const n = parseInt(r.numero_fogo, 10);
        if (!isNaN(n) && n > maxFogo) maxFogo = n;
      });

      let nextFogo = maxFogo + 1;
      const toInsert: Record<string, unknown>[] = [];
      const today = new Date().toISOString().split('T')[0];

      for (const item of selected) {
        for (let i = 0; i < item.quantidade; i++) {
          toInsert.push({
            numero_fogo: String(nextFogo++),
            marca: item.descricao,
            medida: item.medida,
            data_compra: item.dataCompra || today,
            status: 'estoque',
            km_total: 0,
            profundidade_sulco_1vida: null,
            km_no_ultimo_sulco: 0,
          });
        }
      }

      const { data: insertedPneus, error } = await supabase
        .from('pneus')
        .insert(toInsert)
        .select('id');

      if (error) throw error;

      // Registra movimentação entrada_estoque para cada pneu inserido
      if (insertedPneus) {
        const movs = insertedPneus.map((p: { id: string }) => ({
          pneu_id: p.id,
          tipo: 'entrada_estoque',
          data: today,
          km_total_pneu: 0,
          houve_recape: false,
          user_id: user.id,
          profundidade_sulco: null,
        }));
        await supabase.from('movimentacoes_pneus').insert(movs);
      }

      toast.success(`${toInsert.length} pneu(s) adicionado(s) ao estoque`);
      setIsImportNFOpen(false);
      setImportItems([]);
      setImportSelected([]);
      setImportFileName('');
      await loadPneus();
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : String(error);
      setErrorMessage(errorMsg);
      toast.error('Erro ao importar pneus.');
    } finally {
      setImportInserting(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate, model, config_id')
        .eq('vehicle_type', 'veiculo')
        .order('plate');
      if (error) throw error;
      setVehicles(
        (data ?? []).map((v) => ({
          id: v.id as string,
          plate: v.plate as string,
          model: v.model as string,
          config_id: v.config_id as string | null,
        }))
      );
    } catch {
      toast.error('Erro ao carregar veículos');
    }
  };

  const loadConfig = async (configId: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_configs')
        .select('*')
        .eq('id', configId)
        .single();
      if (error) throw error;
      setSelectedConfig(normalizeConfig(data as Record<string, unknown>));
    } catch {
      setSelectedConfig(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (!userJson) {
      navigate('/login');
      return;
    }
    const user: UserType = JSON.parse(userJson);
    if (user.role !== 'Admin' && user.role !== 'Root') {
      navigate('/daily-report');
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadVehicles(), loadPneus()]);
      setLoading(false);
    })();
  }, [currentUser]);

  useEffect(() => {
    if (!selectedVehicleId) {
      setSelectedConfig(null);
      return;
    }
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (vehicle?.config_id) {
      loadConfig(vehicle.config_id);
    } else {
      setSelectedConfig(null);
    }
  }, [selectedVehicleId, vehicles]);

  // ---------------------------------------------------------------------------
  // Core movement handler
  // ---------------------------------------------------------------------------

  async function executarMovimentacao(
    pneu: Pneu,
    tipo: MovimentacaoPneu['tipo'],
    novaPosicao: string | null,
    houveRecape = false,
    profundidadeSulco?: number | null,
    motivoSucateamento?: string | null
  ) {
    setMovimentandoId(pneu.id);
    try {
      const user: UserType = JSON.parse(localStorage.getItem('fleet_user')!);

      // Determine new status
      let novoStatus: Pneu['status'] = pneu.status;
      if (tipo === 'montagem') novoStatus = 'montado';
      if (tipo === 'desmontagem') novoStatus = 'estoque';
      if (tipo === 'saida_conserto') novoStatus = 'conserto';
      if (tipo === 'sucata') novoStatus = 'sucata';
      if (tipo === 'retorno_conserto') {
        novoStatus = novaPosicao !== null ? 'montado' : 'estoque';
      }

      const novoVehicleId = novoStatus === 'montado' ? selectedVehicleId : null;

      // Reform date update
      let data1Reforma = pneu.data1Reforma ?? null;
      let data2Reforma = pneu.data2Reforma ?? null;
      if (houveRecape) {
        const today = new Date().toISOString().split('T')[0];
        if (!data1Reforma) data1Reforma = today;
        else if (!data2Reforma) data2Reforma = today;
      }

      const pneuUpdate: Record<string, unknown> = {
        status: novoStatus,
        vehicle_id: novoVehicleId,
        posicao: novoStatus === 'montado' ? novaPosicao : null,
      };
      if (houveRecape) {
        pneuUpdate.data_1_reforma = data1Reforma;
        pneuUpdate.data_2_reforma = data2Reforma;
        if (profundidadeSulco != null) {
          if (!pneu.data1Reforma) {
            // 1st recap → 2nd life sulco
            pneuUpdate.profundidade_sulco_2vida = profundidadeSulco;
          } else {
            // 2nd recap → 3rd life sulco
            pneuUpdate.profundidade_sulco_3vida = profundidadeSulco;
          }
        }
        pneuUpdate.km_no_ultimo_sulco = 0;
      }

      const { error: pneuError } = await supabase
        .from('pneus')
        .update(pneuUpdate)
        .eq('id', pneu.id);
      if (pneuError) throw pneuError;

      const movPayload = {
        pneu_id: pneu.id,
        tipo,
        vehicle_id: novoVehicleId ?? pneu.vehicleId ?? null,
        posicao_anterior: pneu.posicao ?? null,
        posicao_nova: novaPosicao,
        data: new Date().toISOString().split('T')[0],
        km_total_pneu: pneu.kmTotal,
        houve_recape: houveRecape,
        user_id: user.id,
        profundidade_sulco: profundidadeSulco ?? null,
        motivo_sucateamento: motivoSucateamento ?? null,
      };
      const { error: movError } = await supabase
        .from('movimentacoes_pneus')
        .insert([movPayload]);
      if (movError) throw movError;

      await loadPneus();
      toast.success('Movimentação registrada');
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as any).message)
        : String(error);
      setErrorMessage(errorMsg);
      toast.error('Erro ao registrar movimentação');
    } finally {
      setMovimentandoId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // DnD handler
  // ---------------------------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    const pneu = pneus.find((p) => p.id === event.active.id);
    setActivePneu(pneu ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActivePneu(null);
    const { active, over } = event;
    if (!over) return;

    const pneu = pneus.find((p) => p.id === active.id);
    if (!pneu) return;

    if (movimentandoId) return; // prevent concurrent ops

    const destId = over.id as string;
    const isPosition = destId.startsWith('pos:');
    const isZone = destId.startsWith('zone:');

    if (!isPosition && !isZone) return;

    // No-op guards
    if (isPosition && pneu.posicao === destId.replace('pos:', '')) return;
    if (destId === 'zone:estoque' && pneu.status === 'estoque' && !pneu.vehicleId) return;
    if (destId === 'zone:conserto' && pneu.status === 'conserto') return;

    if (isPosition) {
      const targetPos = destId.replace('pos:', '');

      // Check if position is already occupied
      const occupied = pneus.find(
        (p) =>
          p.vehicleId === selectedVehicleId &&
          p.posicao === targetPos &&
          p.id !== pneu.id
      );
      if (occupied) {
        toast.error(`Posição ${targetPos} já está ocupada por ${occupied.numeroFogo}`);
        return;
      }

      // Returning from repair → open retorno modal
      if (pneu.status === 'conserto') {
        setRetornoTarget({ pneu, destino: targetPos });
        return;
      }

      await executarMovimentacao(pneu, 'montagem', targetPos);
      return;
    }

    // Zone drops
    if (destId === 'zone:sucata') {
      setSucataTarget(pneu);
      return;
    }

    if (destId === 'zone:conserto') {
      const vida = derivarVida(pneu);
      if (vida === 2) {
        const ok = window.confirm(
          `Pneu ${pneu.numeroFogo} está na 3ª vida. Confirma envio a conserto?`
        );
        if (!ok) return;
      }
      await executarMovimentacao(pneu, 'saida_conserto', null);
      return;
    }

    if (destId === 'zone:estoque') {
      if (pneu.status === 'conserto') {
        setRetornoTarget({ pneu, destino: null });
        return;
      }
      await executarMovimentacao(pneu, 'desmontagem', null);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Novo pneu handler
  // ---------------------------------------------------------------------------

  async function handleSalvarNovoPneu() {
    const { numeroFogo, marca, medida, dataCompra, profundidadeSulco } = novoPneuForm;
    if (!numeroFogo.trim() || !marca.trim() || !medida.trim() || !dataCompra) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (!profundidadeSulco || Number(profundidadeSulco) <= 0) {
      toast.error('Informe a profundidade do sulco (maior que 0)');
      return;
    }
    setSavingNovoPneu(true);
    try {
      const user: UserType = JSON.parse(localStorage.getItem('fleet_user')!);

      const { data: inserted, error: insertError } = await supabase
        .from('pneus')
        .insert([
          {
            numero_fogo: numeroFogo.trim(),
            marca: marca.trim(),
            medida: medida.trim(),
            data_compra: dataCompra,
            status: 'estoque',
            km_total: 0,
            profundidade_sulco_1vida: Number(profundidadeSulco),
            km_no_ultimo_sulco: 0,
          },
        ])
        .select()
        .single();
      if (insertError) throw insertError;

      const movPayload = {
        pneu_id: (inserted as Record<string, unknown>).id,
        tipo: 'entrada_estoque' as const,
        data: new Date().toISOString().split('T')[0],
        user_id: user.id,
        houve_recape: false,
        vehicle_id: null,
        posicao_anterior: null,
        posicao_nova: null,
        km_total_pneu: 0,
        profundidade_sulco: Number(profundidadeSulco),
      };
      const { error: movError } = await supabase
        .from('movimentacoes_pneus')
        .insert([movPayload]);
      if (movError) throw movError;

      await loadPneus();
      setNovoPneuForm({ numeroFogo: '', marca: '', medida: '', dataCompra: '', profundidadeSulco: '' });
      setIsNovoPneuOpen(false);
      toast.success('Pneu cadastrado com sucesso');
    } catch {
      toast.error('Erro ao cadastrar pneu');
    } finally {
      setSavingNovoPneu(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Guard
  // ---------------------------------------------------------------------------

  if (!currentUser) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col overflow-auto">
        {/* Sticky header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold dark:text-white">Pneus</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Vehicle selector */}
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary dark:text-white"
            >
              <option value="">Selecione um veículo...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.model}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsNovoPneuOpen(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Novo Pneu</span>
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {/* Axle schema card */}
              {selectedVehicleId && selectedConfig && (
                <div className="card p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                      <Truck size={20} />
                    </div>
                    <h3 className="font-bold dark:text-white">
                      Posição dos Pneus —{' '}
                      {vehicles.find((v) => v.id === selectedVehicleId)?.plate}
                    </h3>
                    {movimentandoId && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin ml-auto" />
                    )}
                  </div>
                  {renderAxleSchema(selectedConfig, tiresByPosition, longPressId, setLongPressId)}
                </div>
              )}

              {selectedVehicleId && !selectedConfig && (
                <div className="card p-6 text-center text-slate-500 dark:text-slate-400">
                  Veículo sem configuração de eixos. Configure em{' '}
                  <a
                    href="/vehicle-configs"
                    className="text-primary underline hover:text-blue-700"
                  >
                    Configurações de Veículos
                  </a>
                  .
                </div>
              )}

              {/* Legenda de vidas — box independente, sempre visível */}
              <div className="card px-5 py-3 flex items-center gap-6">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Legenda:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-green-600 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300">1ª Vida</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300">2ª Vida</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-600 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-300">3ª Vida</span>
                </div>
              </div>

              {/* Three zones */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Estoque */}
                <DroppableZone id="zone:estoque" className="card p-4">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-md">
                        <Package size={14} />
                      </div>
                      <h4 className="font-bold text-slate-700 dark:text-slate-300">Estoque</h4>
                      <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-0.5 rounded-full font-bold">
                        {stockTires.length}
                      </span>
                    </div>
                    <button
                      onClick={() => setIsImportNFOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <FileUp size={13} />
                      Importar NF
                    </button>
                  </div>
                  <div className="space-y-2 min-h-[120px]">
                    {stockTires.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center pt-6">
                        Nenhum pneu em estoque
                      </p>
                    ) : (
                      stockTires.map((p) => (
                        <DraggableTire
                          key={p.id}
                          pneu={p}
                          isLongPressed={longPressId === p.id}
                          onLongPressStart={() => setLongPressId(p.id)}
                          onLongPressEnd={() => setLongPressId(null)}
                        />
                      ))
                    )}
                  </div>
                </DroppableZone>

                {/* Conserto */}
                <DroppableZone id="zone:conserto" className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md">
                        <Wrench size={14} />
                      </div>
                      <h4 className="font-bold text-slate-700 dark:text-slate-300">Conserto</h4>
                    </div>
                    <span className="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full font-bold">
                      {repairTires.length}
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[120px]">
                    {repairTires.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center pt-6">
                        Nenhum pneu em conserto
                      </p>
                    ) : (
                      repairTires.map((p) => (
                        <DraggableTire
                          key={p.id}
                          pneu={p}
                          isLongPressed={longPressId === p.id}
                          onLongPressStart={() => setLongPressId(p.id)}
                          onLongPressEnd={() => setLongPressId(null)}
                        />
                      ))
                    )}
                  </div>
                </DroppableZone>

                {/* Sucata */}
                <DroppableZone id="zone:sucata" className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-md">
                        <Trash2 size={14} />
                      </div>
                      <h4 className="font-bold text-slate-700 dark:text-slate-300">Sucata</h4>
                    </div>
                    <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">
                      {scrapTires.length}
                    </span>
                  </div>
                  <div className="space-y-2 min-h-[120px]">
                    {scrapTires.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center pt-6">
                        Nenhum pneu sucateado
                      </p>
                    ) : (
                      scrapTires.map((p) => (
                        <DraggableTire
                          key={p.id}
                          pneu={p}
                          disabled
                          isLongPressed={longPressId === p.id}
                          onLongPressStart={() => setLongPressId(p.id)}
                          onLongPressEnd={() => setLongPressId(null)}
                        />
                      ))
                    )}
                  </div>
                </DroppableZone>
              </div>

              {/* DragOverlay: card compacto centralizado no cursor */}
              <DragOverlay dropAnimation={null} modifiers={[snapCompactToCursor]}>
                {activePneu ? <TireCardCompact pneu={activePneu} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Novo Pneu                                                    */}
      {/* ------------------------------------------------------------------ */}
      {isNovoPneuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold dark:text-white">Cadastrar Novo Pneu</h3>
              <button
                onClick={() => setIsNovoPneuOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Número do Fogo *
                </label>
                <input
                  type="text"
                  value={novoPneuForm.numeroFogo}
                  onChange={(e) =>
                    setNovoPneuForm((f) => ({ ...f, numeroFogo: e.target.value }))
                  }
                  placeholder="Ex: 12345"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Marca *
                </label>
                <input
                  type="text"
                  value={novoPneuForm.marca}
                  onChange={(e) =>
                    setNovoPneuForm((f) => ({ ...f, marca: e.target.value }))
                  }
                  placeholder="Ex: Bridgestone"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Medida *
                </label>
                <input
                  type="text"
                  value={novoPneuForm.medida}
                  onChange={(e) =>
                    setNovoPneuForm((f) => ({ ...f, medida: e.target.value }))
                  }
                  placeholder="Ex: 295/80 R22.5"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Data de Compra *
                </label>
                <input
                  type="date"
                  value={novoPneuForm.dataCompra}
                  onChange={(e) =>
                    setNovoPneuForm((f) => ({ ...f, dataCompra: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Profundidade do Sulco (mm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="ex: 16.0"
                  value={novoPneuForm.profundidadeSulco}
                  onChange={(e) => setNovoPneuForm((f) => ({ ...f, profundidadeSulco: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setIsNovoPneuOpen(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarNovoPneu}
                disabled={savingNovoPneu}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
              >
                {savingNovoPneu ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Retorno de Conserto                                          */}
      {/* ------------------------------------------------------------------ */}
      {retornoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold dark:text-white">Retorno de Conserto</h3>
              <button
                onClick={() => { setRetornoTarget(null); setRetornoSulco(''); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1">
                <p className="text-sm font-bold dark:text-white">
                  {retornoTarget.pneu.numeroFogo}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {retornoTarget.pneu.marca} · {retornoTarget.pneu.medida}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {VIDA_LABEL[derivarVida(retornoTarget.pneu)]}
                </p>
                {retornoTarget.destino && (
                  <p className="text-xs text-primary font-medium">
                    Destino: {retornoTarget.destino}
                  </p>
                )}
                {!retornoTarget.destino && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Destino: Estoque
                  </p>
                )}
              </div>

              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Houve recauchutagem (reforma)?
              </p>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Profundidade do Sulco após retorno (mm)
                  <span className="text-xs text-slate-400 ml-1">(obrigatório se houve recape)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="ex: 14.0"
                  value={retornoSulco}
                  onChange={e => setRetornoSulco(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const { pneu, destino } = retornoTarget;
                    setRetornoTarget(null);
                    setRetornoSulco('');
                    await executarMovimentacao(pneu, 'retorno_conserto', destino, false, null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Não (apenas reparo)
                </button>
                <button
                  onClick={async () => {
                    if (!retornoSulco || Number(retornoSulco) <= 0) {
                      toast.error('Informe a profundidade do sulco para recape');
                      return;
                    }
                    const { pneu, destino } = retornoTarget;
                    setRetornoTarget(null);
                    setRetornoSulco('');
                    await executarMovimentacao(pneu, 'retorno_conserto', destino, true, Number(retornoSulco));
                  }}
                  className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors"
                >
                  Sim (houve recape)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Importar Nota Fiscal                                         */}
      {/* ------------------------------------------------------------------ */}
      {isImportNFOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-bold dark:text-white">Importar Nota Fiscal</h3>
                <p className="text-xs text-slate-500 mt-0.5">Aceita NF-e em formato XML ou PDF (DANFE)</p>
              </div>
              <button
                onClick={() => { setIsImportNFOpen(false); setImportItems([]); setImportSelected([]); setImportFileName(''); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {/* File drop zone */}
              <label className="block border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors">
                <Upload size={28} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {importFileName || 'Clique para selecionar PDF ou XML'}
                </p>
                <p className="text-xs text-slate-400 mt-1">.pdf · .xml · .nfe</p>
                <input
                  type="file"
                  accept=".pdf,.xml,.nfe"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleImportFile(e.target.files[0])}
                />
              </label>

              {importLoading && (
                <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
                  <Loader2 size={18} className="animate-spin text-primary" />
                  <span className="text-sm">Analisando arquivo...</span>
                </div>
              )}

              {importItems.length > 0 && (() => {
                // Calcula range de número de fogo por produto considerando seleção atual
                let fogoCursor = importStartFogo;
                const fogoRanges = importItems.map((item, idx) => {
                  if (!importSelected[idx]) return null;
                  const start = fogoCursor;
                  fogoCursor += item.quantidade;
                  return { start, end: fogoCursor - 1 };
                });
                return (
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Produtos encontrados ({importItems.reduce((s, i) => s + i.quantidade, 0)} pneus no total):
                    </p>
                    <div className="space-y-2">
                      {importItems.map((item, idx) => {
                        const range = fogoRanges[idx];
                        return (
                          <label
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              importSelected[idx]
                                ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                                : 'border-slate-200 dark:border-slate-700 opacity-60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={importSelected[idx]}
                              onChange={e => {
                                const next = [...importSelected];
                                next[idx] = e.target.checked;
                                setImportSelected(next);
                              }}
                              className="mt-0.5 accent-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{item.descricao}</p>
                              <div className="flex gap-3 mt-1 flex-wrap">
                                <span className="text-xs text-slate-500">Medida: <strong>{item.medida}</strong></span>
                                <span className="text-xs text-slate-500">Qtd: <strong className="text-primary">{item.quantidade} un.</strong></span>
                                <span className="text-xs text-slate-500">Compra: <strong>{item.dataCompra ? new Date(item.dataCompra + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</strong></span>
                              </div>
                              {range && (
                                <div className="mt-1.5 inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                  <span>🔥</span>
                                  <span>
                                    {range.start === range.end
                                      ? `Nº fogo: ${range.start}`
                                      : `Nº fogo: ${range.start} → ${range.end}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {importItems.length > 0 && (
              <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => { setIsImportNFOpen(false); setImportItems([]); setImportSelected([]); setImportFileName(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportConfirm}
                  disabled={importInserting || importSelected.every(s => !s)}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-60"
                >
                  {importInserting ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                  {importInserting
                    ? 'Importando...'
                    : `Adicionar ${importSelected.reduce((s, v, i) => v ? s + importItems[i].quantidade : s, 0)} pneu(s)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Confirmar Sucata                                             */}
      {/* ------------------------------------------------------------------ */}
      {sucataTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-lg">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="text-lg font-bold dark:text-white">Confirmar Sucata</h3>
              </div>
              <button
                onClick={() => { setSucataTarget(null); setSucataMotivo(''); setSucataSulco(''); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Esta ação é irreversível. O pneu será marcado como sucata e não poderá
                ser movimentado novamente.
              </p>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-1">
                <p className="text-sm font-bold text-red-800 dark:text-red-300">
                  {sucataTarget.numeroFogo}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  {sucataTarget.marca} · {sucataTarget.medida}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  {VIDA_LABEL[derivarVida(sucataTarget)]} ·{' '}
                  {sucataTarget.kmTotal.toLocaleString('pt-BR')} km
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Motivo do Sucateamento <span className="text-red-500">*</span>
                </label>
                <select
                  value={sucataMotivo}
                  onChange={e => setSucataMotivo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  <option value="desgaste_normal">Desgaste Normal</option>
                  <option value="dano_irreparavel">Dano Irreparável</option>
                  <option value="corte_lateral">Corte Lateral</option>
                  <option value="estouro">Estouro / Bolha</option>
                  <option value="separacao_carcaca">Separação de Carcaça</option>
                  <option value="fim_de_vida">Fim de Vida (3ª vida esgotada)</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Profundidade do Sulco (mm) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="ex: 2.0"
                  value={sucataSulco}
                  onChange={e => setSucataSulco(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setSucataTarget(null); setSucataMotivo(''); setSucataSulco(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!sucataMotivo) {
                      toast.error('Selecione o motivo do sucateamento');
                      return;
                    }
                    if (!sucataSulco || Number(sucataSulco) <= 0) {
                      toast.error('Informe a profundidade do sulco');
                      return;
                    }
                    const pneu = sucataTarget!;
                    const motivo = sucataMotivo;
                    const sulco = Number(sucataSulco);
                    setSucataTarget(null);
                    setSucataMotivo('');
                    setSucataSulco('');
                    await executarMovimentacao(pneu, 'sucata', null, false, sulco, motivo);
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  Confirmar Sucata
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                Erro ao Gravar Movimentação
              </h3>
            </div>
            <div className="p-6 max-h-64 overflow-y-auto">
              <p className="text-sm text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-800 p-4 rounded-lg break-words whitespace-pre-wrap">
                {errorMessage}
              </p>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
