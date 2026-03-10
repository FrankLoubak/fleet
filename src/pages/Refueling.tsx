import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Calendar, Zap, Fuel, Save, Info, Droplet, Fuel as FuelIcon, TrendingUp, Truck, X, CheckCircle2, MapPin, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../utils';
import { Journey, RefuelingRecord, User as UserType, Vehicle } from '../types';
import { supabase } from '../lib/supabase';

export default function Refueling() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelType, setFuelType] = useState('Gasolina');
  const [odometer, setOdometer] = useState('');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [lastRefueling, setLastRefueling] = useState<RefuelingRecord | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [vehicleHistory, setVehicleHistory] = useState<any[]>([]);
  const [modalStartDate, setModalStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [modalEndDate, setModalEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const odometerInputRef = useRef<HTMLInputElement>(null);

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
        const journey: Journey = {
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

        // Find last refueling for this vehicle
        const { data: lastRef, error: rError } = await supabase
          .from('refuelings')
          .select('*')
          .eq('vehicle_id', journey.vehicleId)
          .order('date', { ascending: false })
          .limit(1);

        if (rError) {
          console.error('Error fetching last refueling:', rError);
        } else if (lastRef && lastRef.length > 0) {
          const r = lastRef[0];
          setLastRefueling({
            ...r,
            vehicleId: r.vehicle_id,
            fuelType: r.fuel_type
          });
        }
      }
    };
    initPage();
  }, [navigate]);

  const vehicle = vehicles.find(v => v.id === activeJourney?.vehicleId);
  const previousKM = lastRefueling?.odometer || vehicle?.lastOdometer || 0;
  const averageConsumption = odometer && quantity && Number(quantity) > 0 
    ? (Number(odometer) - previousKM) / Number(quantity) 
    : 0;

  const handleSaveClick = () => {
    if (!odometer || !quantity) {
      alert('Por favor, preencha o KM atual e a quantidade de litros.');
      return;
    }

    const kmValue = Number(odometer);
    const qtyValue = Number(quantity);
    const errors: string[] = [];

    // Validation: KM must be greater than start of journey
    if (activeJourney && kmValue <= activeJourney.startOdometer) {
      errors.push(`O KM digitado (${kmValue}) deve ser maior que o KM de início da jornada (${activeJourney.startOdometer}).`);
    }

    // Validation: KM must be greater than last refueling
    if (kmValue <= previousKM) {
      errors.push(`O KM digitado (${kmValue}) deve ser maior que o KM do último abastecimento (${previousKM}).`);
    }

    if (errors.length > 0) {
      setErrorMessages(errors);
      setIsErrorModalOpen(true);
      return;
    }

    // Validation: Quantity must be greater than 1
    if (qtyValue <= 1) {
      alert('A quantidade de litros deve ser maior que 1.');
      return;
    }

    // If valid, show confirmation modal
    setIsConfirmModalOpen(true);
  };

  const handleErrorClose = () => {
    setIsErrorModalOpen(false);
    setTimeout(() => {
      odometerInputRef.current?.focus();
    }, 100);
  };

  const handleOpenHistory = () => {
    if (!activeJourney?.vehicleId) return;
    
    const allRefuelingsJson = localStorage.getItem('all_refuelings') || '[]';
    const allRefuelings: RefuelingRecord[] = JSON.parse(allRefuelingsJson);
    
    const vehicleRefuelings = allRefuelings
      .filter(r => r.vehicleId === activeJourney.vehicleId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const historyWithConsumption = vehicleRefuelings.map((r, index) => {
      const prevRef = index > 0 ? vehicleRefuelings[index - 1] : null;
      let avgCons = 0;
      if (prevRef && r.quantity > 0) {
        avgCons = (r.odometer - prevRef.odometer) / r.quantity;
      }
      return { ...r, averageConsumption: avgCons };
    }).reverse();

    setVehicleHistory(historyWithConsumption);
    setIsHistoryModalOpen(true);
  };

  const exportFuelingsToCSV = () => {
    if (!vehicle || vehicleHistory.length === 0) return;
    
    const headers = ['Data', 'Tipo', 'KM', 'Quantidade (L)', 'Local', 'Consumo (km/L)'];
    const rows = vehicleHistory.map(r => [
      new Date(r.date).toLocaleDateString('pt-BR'),
      r.fuelType,
      r.odometer,
      r.quantity,
      r.location || '',
      r.averageConsumption ? r.averageConsumption.toFixed(2).replace('.', ',') : ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `abastecimentos_${vehicle.plate}_${modalStartDate}_${modalEndDate}.csv`);
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
          const { data: allRefuelings, error } = await supabase
            .from('refuelings')
            .select('*')
            .eq('vehicle_id', activeJourney.vehicleId)
            .order('date', { ascending: true });

          if (error) throw error;

          const normalized = (allRefuelings || []).map(r => ({
            ...r,
            vehicleId: r.vehicle_id,
            fuelType: r.fuel_type
          }));

          const filtered = normalized.filter(r => {
            const matchesDate = (!modalStartDate || r.date >= modalStartDate) && 
                               (!modalEndDate || r.date <= modalEndDate);
            return matchesDate;
          }).map((r, index, array) => {
            const prevRef = index > 0 ? array[index - 1] : null;
            
            let avgCons = 0;
            if (prevRef && r.quantity > 0) {
              avgCons = (r.odometer - prevRef.odometer) / r.quantity;
            }
            return { ...r, averageConsumption: avgCons };
          }).reverse();

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

  const handleConfirmSave = async () => {
    setLoading(true);
    try {
      const refuelingPayload = {
        date: date,
        odometer: Number(odometer),
        quantity: Number(quantity),
        fuel_type: fuelType,
        vehicle_id: activeJourney?.vehicleId || '',
        location: location
      };

      const { error } = await supabase
        .from('refuelings')
        .insert([refuelingPayload]);

      if (error) throw error;

      alert('Abastecimento registrado com sucesso!');
      navigate(-1);
    } catch (err) {
      console.error('Error saving refueling:', err);
      alert('Erro ao registrar abastecimento.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark flex flex-col min-h-screen shadow-2xl overflow-x-auto">
        <header className="flex items-center p-4 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold ml-2 flex-1 dark:text-white">Registrar Abastecimento</h1>
          <button 
            onClick={handleOpenHistory}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-white"
          >
            <History size={24} />
          </button>
        </header>

        <main className="flex-1 p-6 space-y-6">
          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 flex items-center gap-3 border border-slate-200 dark:border-slate-800">
            <Truck className="text-primary" size={20} />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Veículo Atual</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {vehicle ? `${vehicle.model} [${vehicle.plate}]` : 'Nenhum veículo selecionado'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Data</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                className="input-field pl-12"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Local de Abastecimento</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                className="input-field pl-12"
                placeholder="Ex: Posto Central"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Último KM Registrado</label>
            <div className="relative opacity-70">
              <History className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                className="input-field pl-12 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed font-medium"
                readOnly
                type="text"
                value={previousKM.toLocaleString()}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Odômetro Atual (KM)</label>
            <div className="relative">
              <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                ref={odometerInputRef}
                className="input-field pl-12"
                placeholder="Ex: 45280"
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Quantidade (Litros)</label>
            <div className="relative">
              <FuelIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                className="input-field pl-12"
                placeholder="0,00"
                step="0.01"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 p-4 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Consumo Médio</label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="text-primary w-6 h-6" />
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {averageConsumption > 0 ? averageConsumption.toFixed(1).replace('.', ',') : '0,0'}
                </span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">km/L</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Tipo de Combustível</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Gasolina', icon: FuelIcon },
                { id: 'Álcool', icon: Droplet },
                { id: 'Diesel', icon: Truck },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setFuelType(type.id)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 h-20 rounded-xl border transition-all",
                    fuelType === type.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-500"
                  )}
                >
                  <type.icon size={20} className="mb-1" />
                  <span className="text-xs font-bold uppercase">{type.id}</span>
                </button>
              ))}
            </div>
          </div>
        </main>

        <footer className="p-6 pt-0">
          <button 
            disabled={loading}
            onClick={handleSaveClick}
            className="btn-primary w-full h-14 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            {loading ? 'Salvando...' : 'Salvar Registro'}
          </button>
          <p className="text-center text-xs text-slate-500 mt-4">Verifique os dados antes de salvar</p>
        </footer>

        {/* Confirmation Modal */}
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Confirmar Abastecimento</h3>
                  <button 
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="bg-primary/5 rounded-xl p-6 space-y-4 border border-primary/10">
                  <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Odômetro</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{Number(odometer).toLocaleString()} KM</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Quantidade</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{quantity} Litros</span>
                  </div>
                  {location && (
                    <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Local</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{location}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Consumo Médio</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{averageConsumption.toFixed(1).replace('.', ',')} km/L</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Combustível</span>
                    <div className="flex items-center gap-2">
                      <Fuel size={16} className="text-primary" />
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{fuelType}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={handleConfirmSave}
                    className="btn-primary h-14 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    Salvar
                  </button>
                  <button 
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="w-full h-12 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Revisar Dados
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Modal */}
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Histórico</h3>
                  <p className="text-xs text-slate-500 font-medium">{vehicle?.plate} • {vehicle?.model}</p>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 bg-amber-50/50 dark:bg-amber-900/5 border-b border-slate-200 dark:border-slate-800">
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
                  vehicleHistory.map((r) => (
                    <div key={r.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[50px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">{new Date(r.date).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white">{new Date(r.date).getDate()}</p>
                          </div>
                          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                          <div>
                            <p className="text-sm font-bold dark:text-white">{r.fuelType}</p>
                            <p className="text-[10px] font-bold text-primary uppercase">{r.location || 'Local não informado'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{r.odometer.toLocaleString()} KM</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <Fuel size={14} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{r.quantity}L</span>
                        </div>
                        {r.averageConsumption > 0 && (
                          <div className="flex items-center gap-2">
                            <TrendingUp size={14} className="text-green-500" />
                            <span className="text-xs font-bold text-green-600">{r.averageConsumption.toFixed(1).replace('.', ',')} km/L</span>
                          </div>
                        )}
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
                  onClick={exportFuelingsToCSV}
                  className="px-6 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-all flex items-center gap-2 shadow-lg shadow-amber-600/20"
                >
                  <Download size={18} />
                  Exportar CSV
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Error Modal */}
        {isErrorModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 text-red-500">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Erro de Validação</h3>
                </div>
                
                <div className="space-y-3">
                  {errorMessages.map((msg, i) => (
                    <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 leading-relaxed">
                        {msg}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={handleErrorClose}
                    className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    Corrigir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
