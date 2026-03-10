import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Wrench, Store, Zap, Save, ClipboardList, Truck, Power, User, History, X, Download, Loader2 } from 'lucide-react';
import { cn, MOCK_PROVIDERS } from '../utils';
import { MaintenanceType, User as UserType, MaintenanceRecord, Vehicle } from '../types';
import { supabase } from '../lib/supabase';

export default function Maintenance() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [selectedType, setSelectedType] = useState<MaintenanceType | ''>('');
  const [selectedProvider, setSelectedProvider] = useState('');

  const [mileage, setMileage] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [description, setDescription] = useState('');
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [vehicleHistory, setVehicleHistory] = useState<MaintenanceRecord[]>([]);
  const [modalStartDate, setModalStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [modalEndDate, setModalEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initPage = async () => {
      const userJson = localStorage.getItem('fleet_user');
      if (!userJson) {
        navigate('/login');
        return;
      }
      const user = JSON.parse(userJson);
      setCurrentUser(user);

      // Get active journey from Supabase
      const { data: activeJourneys, error: jError } = await supabase
        .from('journeys')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'aberta')
        .limit(1);

      if (jError) {
        console.error('Error fetching active journey:', jError);
        return;
      }

      if (activeJourneys && activeJourneys.length > 0) {
        const j = activeJourneys[0];
        const journey = {
          id: j.id,
          userId: j.user_id,
          vehicleId: j.vehicle_id,
          startTime: j.start_time,
          endTime: j.end_time,
          startOdometer: j.start_odometer,
          endOdometer: j.end_odometer,
          distanceTraveled: j.distance_traveled,
          status: j.status,
          observations: j.observations
        };
        setActiveJourney(journey);

        // Load vehicles
        const { data: vehiclesData, error: vError } = await supabase
          .from('vehicles')
          .select('*');
        
        if (vError) {
          console.error('Error fetching vehicles:', vError);
        } else {
          setVehicles(vehiclesData || []);
        }
      }
    };
    initPage();
  }, [navigate]);

  const vehicle = vehicles.find(v => v.id === activeJourney?.vehicleId);

  const handleOpenHistory = () => {
    if (!activeJourney?.vehicleId) return;
    setIsHistoryModalOpen(true);
  };

  const exportMaintenancesToCSV = () => {
    if (!vehicle || vehicleHistory.length === 0) return;
    
    const headers = ['Data', 'Tipo', 'Prestador', 'KM', 'Descrição'];
    const rows = vehicleHistory.map(m => [
      new Date(m.date).toLocaleDateString('pt-BR'),
      m.type,
      m.provider,
      m.mileage,
      m.description.replace(/\n/g, ' ')
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `manutencoes_${vehicle.plate}_${modalStartDate}_${modalEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (isHistoryModalOpen && activeJourney?.vehicleId) {
        setLoading(true);
        try {
          const { data: allMaintenances, error } = await supabase
            .from('maintenances')
            .select('*')
            .eq('vehicle_id', activeJourney.vehicleId)
            .order('date', { ascending: false });

          if (error) throw error;

          const filtered = (allMaintenances || []).filter(m => {
            const matchesDate = (!modalStartDate || m.date >= modalStartDate) && 
                               (!modalEndDate || m.date <= modalEndDate);
            return matchesDate;
          });
          
          setVehicleHistory(filtered);
        } catch (err) {
          console.error('Error fetching history:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchHistory();
  }, [isHistoryModalOpen, activeJourney?.vehicleId, modalStartDate, modalEndDate]);

  const handleSave = async () => {
    if (!selectedType || !selectedProvider || !mileage || !description || !totalValue) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    const odoNum = Number(mileage);
    if (odoNum <= (vehicle?.lastOdometer || 0)) {
      alert(`O KM da manutenção (${odoNum}) deve ser maior que o último KM registrado (${vehicle?.lastOdometer || 0}).`);
      return;
    }

    setLoading(true);
    try {
      const maintenancePayload = {
        date: new Date().toISOString().split('T')[0],
        type: selectedType,
        provider: MOCK_PROVIDERS.find(p => p.id === selectedProvider)?.name || 'Desconhecido',
        mileage: Number(mileage),
        total_value: Number(totalValue),
        description,
        vehicle_id: activeJourney?.vehicleId || ''
      };

      const { error } = await supabase
        .from('maintenances')
        .insert([maintenancePayload]);

      if (error) throw error;

      // Update vehicle last_odometer if this is the newest
      const odoNum = Number(mileage);
      if (odoNum > (vehicle?.lastOdometer || 0)) {
        const { error: vError } = await supabase
          .from('vehicles')
          .update({ last_odometer: odoNum })
          .eq('id', activeJourney?.vehicleId);
        if (vError) console.error('Error updating vehicle odometer:', vError);
      }

      alert('Manutenção salva com sucesso!');
      navigate(-1);
    } catch (err) {
      console.error('Error saving maintenance:', err);
      alert('Erro ao salvar manutenção.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = MOCK_PROVIDERS.filter(p => p.type === selectedType);

  if (!currentUser) return null;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased min-h-screen flex flex-col items-center">
      <div className="relative flex min-h-screen w-full max-w-md flex-col overflow-x-auto shadow-2xl bg-background-light dark:bg-background-dark">
        <header className="sticky top-0 z-10 flex items-center bg-background-light dark:bg-background-dark border-b border-slate-200 dark:border-slate-800 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-tight">Incluir Manutenção</h1>
          <button 
            onClick={handleOpenHistory}
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <History size={24} />
          </button>
        </header>

        <main className="flex-1 px-4 py-6 space-y-6">
          <div className="mb-2 space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nova Manutenção</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Preencha os dados do serviço realizado</p>
          </div>

          <section className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Data do Registro</label>
              <div className="relative flex items-center">
                <Calendar className="absolute left-4 text-slate-400 w-5 h-5" />
                <input
                  className="input-field pl-12 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  readOnly
                  type="text"
                  value={new Date().toLocaleDateString('pt-BR')}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Tipo de Manutenção</label>
              <div className="relative">
                <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <select 
                  className="input-field pl-12 appearance-none"
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value as MaintenanceType);
                    setSelectedProvider('');
                  }}
                >
                  <option value="">Selecione o tipo</option>
                  <option value="Mecanica">1-Mecanica</option>
                  <option value="Eletrica">2-Eletrica</option>
                  <option value="Acessórios">3-Acessórios</option>
                  <option value="Borracharia">4-Borracharia</option>
                  <option value="Ar de serviço">5-Ar de serviço</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Prestador de Serviço</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <select 
                  className="input-field pl-12 appearance-none"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  disabled={!selectedType}
                >
                  <option value="">
                    {!selectedType ? 'Selecione o tipo primeiro' : 'Selecione o prestador'}
                  </option>
                  {filteredProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Quilometragem (KM)</label>
              <div className="relative flex items-center">
                <Zap className="absolute left-4 text-slate-400 w-5 h-5" />
                <input
                  className="input-field pl-12"
                  placeholder="Ex: 125430"
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Valor Total (R$)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                <input
                  className="input-field pl-12"
                  placeholder="0,00"
                  step="0.01"
                  type="number"
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Descrição do Serviço</label>
              <textarea
                className="input-field min-h-[120px] p-4 resize-none"
                placeholder="Descreva os serviços realizados no veículo..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>
          </section>

          <div className="pt-4">
            <button 
              disabled={loading}
              onClick={handleSave}
              className="btn-primary h-14 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              <span>{loading ? 'Salvando...' : 'Salvar Manutenção'}</span>
            </button>
          </div>
        </main>

        <nav className="sticky bottom-0 z-10 flex border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-2 pb-6 pt-2">
          {[
            { icon: ClipboardList, label: 'Relatórios' },
            { icon: Truck, label: 'Frota', active: true },
            { icon: Power, label: 'Finalizar' },
            { icon: User, label: 'Perfil' },
          ].map((item, i) => (
            <button key={i} className={cn("flex flex-1 flex-col items-center justify-center gap-1", item.active ? "text-primary" : "text-slate-400")}>
              <item.icon size={24} />
              <p className="text-[9px] font-bold uppercase tracking-tight text-center">{item.label}</p>
            </button>
          ))}
        </nav>

        {/* History Modal */}
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-purple-50 dark:bg-purple-900/10">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Histórico</h3>
                  <p className="text-xs text-purple-600 font-bold uppercase tracking-wider">{vehicle?.plate} • {vehicle?.model}</p>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 bg-purple-50/50 dark:bg-purple-900/5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-1.5 w-full">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Início</label>
                    <input 
                      type="date" 
                      className="input-field h-10 text-sm" 
                      value={modalStartDate}
                      onChange={(e) => setModalStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5 w-full">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fim</label>
                    <input 
                      type="date" 
                      className="input-field h-10 text-sm" 
                      value={modalEndDate}
                      onChange={(e) => setModalEndDate(e.target.value)}
                    />
                  </div>
                  <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
                    {vehicleHistory.length} Registros
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
                {loading && (
                  <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}
                {vehicleHistory.length > 0 ? (
                  vehicleHistory.map((m) => (
                    <div key={m.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[50px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">{new Date(m.date).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">{new Date(m.date).getDate()}</p>
                          </div>
                          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                          <div>
                            <p className="text-sm font-bold dark:text-white">{m.type}</p>
                            <p className="text-[10px] font-bold text-purple-600 uppercase">{m.provider}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{m.mileage.toLocaleString()} KM</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{m.description}"</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <History size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">Nenhum registro encontrado</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-start gap-3">
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Fechar
                </button>
                <button 
                  onClick={exportMaintenancesToCSV}
                  className="px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20"
                >
                  <Download size={18} />
                  Exportar CSV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
