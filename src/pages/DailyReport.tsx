import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Zap, Fuel, Wrench, Play, ClipboardList, Truck, Power, User, LogOut, CheckCircle2, X, BarChart3, History, Loader2 } from 'lucide-react';
import { cn } from '../utils';
import { User as UserType, Journey, Vehicle } from '../types';
import { supabase } from '../lib/supabase';

export default function DailyReport() {
  const navigate = useNavigate();
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);
  const [previousJourney, setPreviousJourney] = useState<Journey | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  
  // Form states
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [startOdometer, setStartOdometer] = useState('');
  
  // Modal states
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isPreviousJourneyModalOpen, setIsPreviousJourneyModalOpen] = useState(false);
  const [isVehicleOccupiedModalOpen, setIsVehicleOccupiedModalOpen] = useState(false);
  const [isOdometerErrorModalOpen, setIsOdometerErrorModalOpen] = useState(false);
  const [lastOdometerValue, setLastOdometerValue] = useState(0);
  const [occupyingUser, setOccupyingUser] = useState<UserType | null>(null);
  const [endOdometer, setEndOdometer] = useState('');
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

      // Load vehicles
      const { data: vehiclesData, error: vError } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate');
      
      if (vError) {
        console.error('Error fetching vehicles:', vError);
      } else {
        setVehicles(vehiclesData || []);
      }

      // Load users/profiles
      const { data: profilesData, error: pError } = await supabase
        .from('profiles')
        .select('*');
      
      if (pError) {
        console.error('Error fetching profiles:', pError);
      } else {
        const normalizedUsers = (profilesData || []).map(p => ({
          id: p.id,
          name: p.name,
          email: '',
          role: p.role,
          avatar: p.avatar_url
        }));
        setUsers(normalizedUsers);
      }

      // Check for existing open journey in Supabase
      const { data: openJourneys, error: jError } = await supabase
        .from('journeys')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'aberta')
        .limit(1);

      if (jError) {
        console.error('Error fetching open journey:', jError);
      } else if (openJourneys && openJourneys.length > 0) {
        const j = openJourneys[0];
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
        setCurrentJourney(journey);
        setSelectedVehicle(journey.vehicleId);
        setStartOdometer(journey.startOdometer.toString());
        setStartTime(journey.startTime.split('T')[1].substring(0, 5));
        setStartDate(journey.startTime.split('T')[0]);
      }
    };
    initPage();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('fleet_user');
    navigate('/login');
  };

  const handleStartJourney = async () => {
    if (!selectedVehicle || !startOdometer || !startTime || !startDate) {
      alert('Por favor, preencha todos os campos para iniciar a jornada.');
      return;
    }

    if (!currentUser?.id) {
      alert('Erro de sessão. Por favor, faça login novamente.');
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      // 01 - Check if the current user already has an open journey (any vehicle)
      const { data: userJourneys, error: ujError } = await supabase
        .from('journeys')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('status', 'aberta')
        .limit(1);

      if (ujError) throw ujError;

      if (userJourneys && userJourneys.length > 0) {
        const j = userJourneys[0];
        setPreviousJourney({
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
        });
        setIsPreviousJourneyModalOpen(true);
        return;
      }
      
      // 01.2 - Check if the vehicle is occupied by another user
      const { data: vehicleJourneys, error: vjError } = await supabase
        .from('journeys')
        .select('*')
        .eq('vehicle_id', selectedVehicle)
        .eq('status', 'aberta')
        .limit(1);

      if (vjError) throw vjError;

      if (vehicleJourneys && vehicleJourneys.length > 0) {
        const j = vehicleJourneys[0];
        const userWhoOpened = users.find((u: UserType) => u.id === j.user_id);
        setOccupyingUser(userWhoOpened || { id: j.user_id, name: 'Outro Motorista', email: '', role: 'Motorista', avatar: '' });
        setIsVehicleOccupiedModalOpen(true);
        return;
      }

      // 02 - Check if start KM is greater than last closing KM
      const vehicle = vehicles.find(v => v.id === selectedVehicle);
      if (vehicle && Number(startOdometer) < vehicle.lastOdometer) {
        setLastOdometerValue(vehicle.lastOdometer);
        setIsOdometerErrorModalOpen(true);
        return;
      }

      const journeyPayload = {
        user_id: currentUser.id,
        vehicle_id: selectedVehicle,
        start_time: `${startDate}T${startTime}`,
        start_odometer: Number(startOdometer),
        status: 'aberta'
      };

      const { data: newJData, error: insertError } = await supabase
        .from('journeys')
        .insert([journeyPayload])
        .select();

      if (insertError) throw insertError;

      if (newJData && newJData.length > 0) {
        const j = newJData[0];
        const newJourney: Journey = {
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
        setCurrentJourney(newJourney);
      }
    } catch (err) {
      console.error('Error starting journey:', err);
      alert('Erro ao iniciar jornada.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndJourney = async () => {
    if (!endOdometer || Number(endOdometer) <= (currentJourney?.startOdometer || 0)) {
      alert('O KM final deve ser maior que o KM inicial.');
      return;
    }

    setLoading(true);
    try {
      const endTime = new Date().toISOString();
      const endOdom = Number(endOdometer);
      const dist = endOdom - currentJourney!.startOdometer;

      const { error } = await supabase
        .from('journeys')
        .update({
          end_time: endTime,
          end_odometer: endOdom,
          distance_traveled: dist,
          status: 'encerrada'
        })
        .eq('id', currentJourney!.id);

      if (error) throw error;

      // Clear local state
      setCurrentJourney(null);
      setIsEndModalOpen(false);
      setEndOdometer('');
      setSelectedVehicle('');
      setStartOdometer('');
      
      alert('Jornada encerrada com sucesso!');
    } catch (err) {
      console.error('Error ending journey:', err);
      alert('Erro ao encerrar jornada.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndPreviousJourney = async () => {
    if (!endOdometer || Number(endOdometer) <= (previousJourney?.startOdometer || 0)) {
      alert('O KM final deve ser maior que o KM inicial.');
      return;
    }

    setLoading(true);
    try {
      const endTime = new Date().toISOString();
      const endOdom = Number(endOdometer);
      const dist = endOdom - previousJourney!.startOdometer;

      const { error } = await supabase
        .from('journeys')
        .update({
          end_time: endTime,
          end_odometer: endOdom,
          distance_traveled: dist,
          status: 'encerrada'
        })
        .eq('id', previousJourney!.id);

      if (error) throw error;

      setPreviousJourney(null);
      setIsPreviousJourneyModalOpen(false);
      setEndOdometer('');
      
      alert('Jornada anterior encerrada com sucesso! Agora você pode iniciar uma nova.');
    } catch (err) {
      console.error('Error ending previous journey:', err);
      alert('Erro ao encerrar jornada anterior.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  const vehicle = vehicles.find(v => v.id === selectedVehicle);
  const isJourneyOpen = currentJourney?.status === 'aberta';

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased min-h-screen flex flex-col items-center">
      <div className="relative flex min-h-screen w-full max-w-md flex-col overflow-x-hidden shadow-2xl bg-background-light dark:bg-background-dark">
        <header className="sticky top-0 z-10 flex items-center bg-background-light dark:bg-background-dark border-b border-slate-200 dark:border-slate-800 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-tight pr-10">Parte Diária</h1>
        </header>

        <main className="flex-1 px-4 py-6 space-y-6 pb-24">
          <div className="mb-6 space-y-1">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Olá, {currentUser?.name}</h2>
              <span className="text-[10px] text-blue-500 font-mono select-all cursor-help" title="Seu ID de Usuário para o script SQL">
                ID: {currentUser?.id}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {isJourneyOpen ? 'Sua jornada está em andamento' : 'Bem-vindo à sua jornada de hoje'}
            </p>
          </div>

          {isJourneyOpen && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="text-green-500" size={20} />
              <div>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">Jornada Aberta</p>
                <p className="text-xs text-green-600/80 dark:text-green-400/80">ID: {currentJourney.id}</p>
              </div>
            </div>
          )}

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="text-primary" size={20} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Identificação do Veículo</h2>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Veículo</label>
              <select 
                className={cn(
                  "input-field appearance-none",
                  isJourneyOpen && "bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                )}
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                disabled={isJourneyOpen}
              >
                <option value="">Selecione um veículo da frota</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.model} - [{v.plate}]</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Placa</label>
                <input
                  className="h-12 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-4 text-slate-500 cursor-not-allowed"
                  readOnly
                  type="text"
                  value={vehicle?.plate || '---'}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Prefixo / Frota</label>
                <input
                  className="h-12 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-4 text-slate-500 cursor-not-allowed"
                  readOnly
                  type="text"
                  value={vehicle?.prefix || '---'}
                />
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-200 dark:bg-slate-800 w-full"></div>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="text-primary" size={20} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Dados da Jornada</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Data do Registro</label>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-4 text-slate-400 w-5 h-5" />
                  <input
                    className={cn(
                      "input-field pl-12",
                      isJourneyOpen && "bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                    )}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isJourneyOpen}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Horário de Início</label>
                <div className="relative flex items-center">
                  <Clock className="absolute left-4 text-slate-400 w-5 h-5" />
                  <input
                    className={cn(
                      "input-field pl-12",
                      isJourneyOpen && "bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                    )}
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isJourneyOpen}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Quilometragem Inicial (KM)</label>
              <div className="relative flex items-center">
                <Zap className="absolute left-4 text-slate-400 w-5 h-5" />
                <input
                  className={cn(
                    "input-field pl-12",
                    isJourneyOpen && "bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                  )}
                  placeholder="Ex: 125430"
                  type="number"
                  value={startOdometer}
                  onChange={(e) => setStartOdometer(e.target.value)}
                  disabled={isJourneyOpen}
                />
              </div>
            </div>
          </section>

          <div className="pt-4 flex flex-col gap-4">
            <button 
              onClick={() => navigate('/refueling')}
              disabled={!isJourneyOpen}
              className={cn(
                "w-full h-14 border-2 border-slate-200 dark:border-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                isJourneyOpen 
                  ? "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200" 
                  : "opacity-50 cursor-not-allowed text-slate-400"
              )}
            >
              <Fuel className={isJourneyOpen ? "text-primary" : "text-slate-400"} size={20} />
              <span>Incluir Abastecimento</span>
            </button>
            <button 
              onClick={() => navigate('/maintenance')}
              disabled={!isJourneyOpen}
              className={cn(
                "w-full h-14 border-2 border-slate-200 dark:border-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                isJourneyOpen 
                  ? "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200" 
                  : "opacity-50 cursor-not-allowed text-slate-400"
              )}
            >
              <Wrench className={isJourneyOpen ? "text-primary" : "text-slate-400"} size={20} />
              <span>Incluir Manutenção</span>
            </button>
            <button 
              onClick={() => navigate('/request-maintenance')}
              disabled={!isJourneyOpen}
              className={cn(
                "w-full h-14 border-2 border-slate-200 dark:border-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                isJourneyOpen 
                  ? "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200" 
                  : "opacity-50 cursor-not-allowed text-slate-400"
              )}
            >
              <Wrench className={isJourneyOpen ? "text-primary" : "text-slate-400"} size={20} />
              <span>Solicitar Manutenção</span>
            </button>
            
            {!isJourneyOpen && (
              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 text-center font-medium">Preencha os dados acima para iniciar sua jornada</p>
              </div>
            )}
          </div>
        </main>

        <footer className="sticky bottom-20 z-10 bg-background-light dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 p-4">
          <button 
            disabled={loading || (!isJourneyOpen && (!startOdometer || !selectedVehicle))}
            onClick={isJourneyOpen ? () => setIsEndModalOpen(true) : handleStartJourney}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50",
              isJourneyOpen 
                ? "bg-red-500 shadow-red-500/20" 
                : "bg-primary shadow-primary/20"
            )}
          >
            {loading ? <Loader2 className="animate-spin" /> : (isJourneyOpen ? <Power size={20} /> : <Play size={20} />)}
            <span className="font-bold uppercase tracking-wider">
              {loading ? 'Processando...' : (isJourneyOpen ? 'Encerrar Jornada' : 'Iniciar Jornada')}
            </span>
          </button>
        </footer>

        <nav className="sticky bottom-0 z-10 flex border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md px-2 pb-6 pt-2">
          {currentUser.role === 'Admin' && (
            <>
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors"
              >
                <BarChart3 size={24} />
                <p className="text-[9px] font-bold uppercase tracking-tight text-center">Painel</p>
              </button>
              <button 
                onClick={() => navigate('/journeys')}
                className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors"
              >
                <History size={24} />
                <p className="text-[9px] font-bold uppercase tracking-tight text-center">Jornadas</p>
              </button>
            </>
          )}
          <button 
            onClick={() => navigate('/vehicles')}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors"
          >
            <Truck size={24} />
            <p className="text-[9px] font-bold uppercase tracking-tight text-center">Frota</p>
          </button>
          <button 
            onClick={() => isJourneyOpen && setIsEndModalOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1",
              isJourneyOpen ? "text-red-500" : "text-slate-300 cursor-not-allowed"
            )}
          >
            <Power size={24} />
            <p className="text-[9px] font-bold uppercase tracking-tight text-center">Finalizar</p>
          </button>
          <button 
            onClick={handleLogout}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400"
          >
            <LogOut size={24} />
            <p className="text-[9px] font-bold uppercase tracking-tight text-center">Sair</p>
          </button>
        </nav>

        {/* End Journey Modal */}
        {isEndModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Encerrar Jornada</h3>
                  <button 
                    onClick={() => setIsEndModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Para finalizar sua jornada com o veículo <span className="font-bold text-slate-700 dark:text-slate-200">{vehicle?.model}</span>, informe a quilometragem final.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">KM Final</label>
                  <div className="relative flex items-center">
                    <Zap className="absolute left-4 text-slate-400 w-5 h-5" />
                    <input
                      className="input-field pl-12"
                      placeholder="Ex: 125580"
                      type="number"
                      value={endOdometer}
                      onChange={(e) => setEndOdometer(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] text-slate-400">KM Inicial: {currentJourney?.startOdometer} KM</p>
                    {endOdometer && Number(endOdometer) > (currentJourney?.startOdometer || 0) && (
                      <p className="text-[10px] font-bold text-primary">KM Rodados: {Number(endOdometer) - (currentJourney?.startOdometer || 0)} KM</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={handleEndJourney}
                    className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 shadow-red-600/20"
                  >
                    Encerrar Jornada
                  </button>
                  <button 
                    onClick={() => setIsEndModalOpen(false)}
                    className="w-full h-12 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Previous Journey Found Modal */}
        {isPreviousJourneyModalOpen && previousJourney && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-sm:max-w-xs max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-red-600">Jornada em Aberto</h3>
                  <button 
                    onClick={() => setIsPreviousJourneyModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                    Você possui uma jornada que ainda não foi encerrada:
                  </p>
                  <div className="text-xs space-y-1 text-amber-700 dark:text-amber-500">
                    <p><span className="font-bold">Veículo:</span> {vehicles.find(v => v.id === previousJourney.vehicleId)?.model}</p>
                    <p><span className="font-bold">Início:</span> {new Date(previousJourney.startTime).toLocaleString('pt-BR')}</p>
                    <p><span className="font-bold">KM Inicial:</span> {previousJourney.startOdometer} KM</p>
                    {endOdometer && Number(endOdometer) > previousJourney.startOdometer && (
                      <p className="text-primary font-bold"><span className="font-bold">KM Rodados:</span> {Number(endOdometer) - previousJourney.startOdometer} KM</p>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Por favor, informe o KM final para encerrar a jornada anterior antes de iniciar uma nova.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">KM Final</label>
                  <div className="relative flex items-center">
                    <Zap className="absolute left-4 text-slate-400 w-5 h-5" />
                    <input
                      className="input-field pl-12"
                      placeholder="KM de encerramento"
                      type="number"
                      value={endOdometer}
                      onChange={(e) => setEndOdometer(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={handleEndPreviousJourney}
                    className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 shadow-red-600/20"
                  >
                    Encerrar Jornada Anterior
                  </button>
                  <button 
                    onClick={() => setIsPreviousJourneyModalOpen(false)}
                    className="w-full h-12 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vehicle Occupied Modal */}
        {isVehicleOccupiedModalOpen && occupyingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                    <Truck className="text-red-600 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Veículo Ocupado</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Este veículo já possui uma jornada em andamento aberta por outro motorista.
                    </p>
                  </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100 dark:border-slate-800">
                  <div 
                    className="size-14 rounded-full bg-cover bg-center border-2 border-white dark:border-slate-700 shadow-sm"
                    style={{ backgroundImage: `url(${occupyingUser.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'})` }}
                  ></div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Motorista Atual</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{occupyingUser.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{occupyingUser.role}</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs text-amber-800 dark:text-amber-400 text-center font-medium">
                    Aguarde o encerramento da jornada atual ou entre em contato com o motorista responsável.
                  </p>
                </div>

                <button 
                  onClick={() => setIsVehicleOccupiedModalOpen(false)}
                  className="btn-primary w-full h-14"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Odometer Error Modal */}
        {isOdometerErrorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full">
                    <Zap className="text-amber-600 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Erro de Quilometragem</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      O KM inicial informado é inferior ao último registro de encerramento deste veículo.
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Último KM Final</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{lastOdometerValue} KM</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/20 text-center">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">KM Digitado</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{startOdometer} KM</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs text-amber-800 dark:text-amber-400 text-center font-medium">
                    Por favor, verifique o painel do veículo e corrija a quilometragem para prosseguir.
                  </p>
                </div>

                <button 
                  onClick={() => setIsOdometerErrorModalOpen(false)}
                  className="btn-primary w-full h-14"
                >
                  Corrigir Quilometragem
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
