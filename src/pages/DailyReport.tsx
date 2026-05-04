import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Zap, Fuel, Wrench, Play, ClipboardList, Truck, Power, User, LogOut, CheckCircle2, X, BarChart3, History, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
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
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isValidationAlertModalOpen, setIsValidationAlertModalOpen] = useState(false);
  const [isGeneralErrorModalOpen, setIsGeneralErrorModalOpen] = useState(false);
  const [timeBankTotal, setTimeBankTotal] = useState('00:00');
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [lastOdometerValue, setLastOdometerValue] = useState(0);
  const [occupyingUser, setOccupyingUser] = useState<UserType | null>(null);
  const [endOdometer, setEndOdometer] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const [loading, setLoading] = useState(false);

  interface MaintenanceAlert {
    id: string;
    type: 'request' | 'authorized';
    title: string;
    description: string;
    date: string;
    severity: 'info' | 'warning';
  }

  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);

  const isJourneyOpen = currentJourney?.status === 'aberta';

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
        // Falha ao carregar veículos — mantém lista vazia
      } else {
        const normalizedVehicles = (vehiclesData || []).map(v => ({
          ...v,
          lastOdometer: v.last_odometer
        }));
        setVehicles(normalizedVehicles);
      }

      // Load users/profiles
      const { data: profilesData, error: pError } = await supabase
        .from('profiles')
        .select('*');
      
      if (pError) {
        // Falha ao carregar perfis — mantém lista vazia
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
        // Falha ao verificar jornada em aberto — ignora silenciosamente
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

      // Fetch time bank total
      const { data: tbData } = await supabase
        .from('banco_de_horas')
        .select('horas_adquiridas')
        .eq('user_id', user.id);
      
      if (tbData) {
        let totalMins = 0;
        tbData.forEach(r => {
          const [h, m] = r.horas_adquiridas.split(':').map(Number);
          totalMins += (h * 60) + m;
        });
        const totalH = Math.floor(totalMins / 60);
        const totalM = totalMins % 60;
        setTimeBankTotal(`${totalH.toString().padStart(2, '0')}:${totalM.toString().padStart(2, '0')}`);
      }
    };
    initPage();
  }, [navigate]);

  useEffect(() => {
    const fetchLastOdometer = async () => {
      if (!selectedVehicle || isJourneyOpen) return;

      try {
        const { data: lastJ, error: ljErr } = await supabase
          .from('journeys')
          .select('end_odometer')
          .eq('vehicle_id', selectedVehicle)
          .eq('status', 'encerrada')
          .order('end_time', { ascending: false })
          .limit(1);

        const selectedV = vehicles.find(v => v.id === selectedVehicle);
        
        if (ljErr) throw ljErr;

        const lastJourneyOdo = lastJ?.[0]?.end_odometer || 0;
        const vehicleOdo = selectedV?.vehicle_type === 'maquina' 
          ? (selectedV?.current_hourmeter || 0) 
          : (selectedV?.current_odometer || selectedV?.lastOdometer || 0);
        
        const suggestedOdo = Math.max(lastJourneyOdo, vehicleOdo);
        
        if (suggestedOdo > 0) {
          setStartOdometer(suggestedOdo.toString());
        } else {
          setStartOdometer('');
        }
      } catch (_err) {
        // Falha ao buscar último odômetro/horímetro — mantém campo vazio
      }
    };

    fetchLastOdometer();
  }, [selectedVehicle, isJourneyOpen, vehicles]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

    // Validação frontend imediata do odômetro/horímetro inicial
    const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicle);
    if (selectedVehicleObj) {
      const isMaquina = selectedVehicleObj.vehicle_type === 'maquina';
      const currentMedidor = isMaquina
        ? (selectedVehicleObj.current_hourmeter || 0)
        : (selectedVehicleObj.current_odometer || selectedVehicleObj.lastOdometer || 0);

      if (currentMedidor > 0 && Number(startOdometer) < currentMedidor) {
        const medidorNome = isMaquina ? 'horímetro' : 'odômetro';
        const unidade = isMaquina ? 'h' : 'km';
        setLastOdometerValue(currentMedidor);
        setErrorMessages([
          `O ${medidorNome} inicial (${Number(startOdometer)} ${unidade}) deve ser maior ou igual ao ${medidorNome} atual do veículo (${currentMedidor} ${unidade}).`
        ]);
        setIsOdometerErrorModalOpen(true);
        return;
      }
    }

    setLoading(true);
    try {
      // 01 - Verifica se o usuário já possui jornada aberta em outro veículo
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

      // 01.2 - Verifica se o veículo está sendo usado por outro motorista
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
        setOccupyingUser(userWhoOpened || { id: j.user_id, name: 'Outro Motorista', email: '', role: 'Operador', avatar: '' });
        setIsVehicleOccupiedModalOpen(true);
        return;
      }

      // 02 - Validação no banco: odômetro/horímetro inicial >= último registrado
      const { data: lastJ, error: ljErr } = await supabase
        .from('journeys')
        .select('end_odometer')
        .eq('vehicle_id', selectedVehicle)
        .eq('status', 'encerrada')
        .order('end_time', { ascending: false })
        .limit(1);

      const { data: vRecord, error: vrErr } = await supabase
        .from('vehicles')
        .select('last_odometer, current_odometer, current_hourmeter, vehicle_type')
        .eq('id', selectedVehicle)
        .single();

      if (ljErr || vrErr) throw (ljErr || vrErr);

      const lastJourneyOdo = lastJ?.[0]?.end_odometer || 0;
      const vehicleOdo = vRecord?.vehicle_type === 'maquina'
        ? vRecord?.current_hourmeter
        : (vRecord?.current_odometer || vRecord?.last_odometer);
      const minRequiredOdo = Math.max(lastJourneyOdo, vehicleOdo || 0);

      if (Number(startOdometer) < minRequiredOdo) {
        const isMaquina = vRecord?.vehicle_type === 'maquina';
        const medidorNome = isMaquina ? 'horímetro' : 'odômetro';
        const unidade = isMaquina ? 'h' : 'km';
        setLastOdometerValue(minRequiredOdo);
        setErrorMessages([
          `O ${medidorNome} inicial (${Number(startOdometer)} ${unidade}) deve ser maior ou igual ao ${medidorNome} atual do veículo (${minRequiredOdo} ${unidade}).`
        ]);
        setIsOdometerErrorModalOpen(true);
        setLoading(false);
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

      // Atualiza odômetro/horímetro do veículo se o valor inicial for maior que o atual
      const currentVal = vehicle?.vehicle_type === 'maquina'
        ? (vehicle.current_hourmeter || 0)
        : (vehicle?.current_odometer || vehicle?.lastOdometer || 0);
      if (vehicle && Number(startOdometer) > currentVal) {
        const updatePayload: Record<string, number> = { last_odometer: Number(startOdometer) };
        if (vehicle.vehicle_type === 'maquina') {
          updatePayload.current_hourmeter = Number(startOdometer);
        } else {
          updatePayload.current_odometer = Number(startOdometer);
        }
        await supabase
          .from('vehicles')
          .update(updatePayload)
          .eq('id', selectedVehicle);
      }

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setErrorMessages([`Erro ao iniciar jornada: ${message}`]);
      setIsGeneralErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEndJourney = async () => {
    const endOdom = Number(endOdometer);
    const startOdom = currentJourney?.startOdometer || 0;
    const isMaquina = vehicle?.vehicle_type === 'maquina';
    const medidorNome = isMaquina ? 'horímetro' : 'odômetro';
    const unidade = isMaquina ? 'h' : 'km';

    // Validação frontend imediata: valor final deve ser maior que o inicial
    if (!endOdometer || endOdom <= startOdom) {
      setErrorMessages([
        `O ${medidorNome} final deve ser maior que o ${medidorNome} inicial (${startOdom} ${unidade}).`
      ]);
      setIsGeneralErrorModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      // 02 - Verifica abastecimentos realizados durante esta jornada
      const { data: journeyRefuelings, error: refError } = await supabase
        .from('refuelings')
        .select('odometer')
        .eq('vehicle_id', currentJourney?.vehicleId)
        .gte('created_at', currentJourney?.startTime)
        .order('odometer', { ascending: false })
        .limit(1);

      if (refError) throw refError;

      if (journeyRefuelings && journeyRefuelings.length > 0) {
        const maxRefOdo = journeyRefuelings[0].odometer;
        if (endOdom < maxRefOdo) {
          const label = isMaquina ? 'horímetro do último abastecimento' : 'KM do último abastecimento';
          setErrorMessages([
            `O ${medidorNome} final (${endOdom} ${unidade}) não pode ser menor que o ${label} realizado nesta jornada (${maxRefOdo} ${unidade}).`
          ]);
          setIsGeneralErrorModalOpen(true);
          setLoading(false);
          return;
        }
      }

      // 03 - Verifica manutenções realizadas durante esta jornada
      const { data: journeyMaintenances, error: maintError } = await supabase
        .from('maintenances')
        .select('mileage')
        .eq('vehicle_id', currentJourney?.vehicleId)
        .gte('created_at', currentJourney?.startTime)
        .order('mileage', { ascending: false })
        .limit(1);

      if (maintError) throw maintError;

      if (journeyMaintenances && journeyMaintenances.length > 0) {
        const maxMaintOdo = journeyMaintenances[0].mileage;
        if (endOdom < maxMaintOdo) {
          const label = isMaquina ? 'horímetro da última manutenção' : 'KM da última manutenção';
          setErrorMessages([
            `O ${medidorNome} final (${endOdom} ${unidade}) não pode ser menor que o ${label} realizada nesta jornada (${maxMaintOdo} ${unidade}).`
          ]);
          setIsGeneralErrorModalOpen(true);
          setLoading(false);
          return;
        }
      }

      const endTimeStr = `${endDate}T${endTime}`;
      const dist = endOdom - startOdom;

      // Calcula duração para determinar se precisa de validação do gestor
      const startTimeDate = new Date(currentJourney!.startTime);
      const endTimeDate = new Date(endTimeStr);
      const durationMs = endTimeDate.getTime() - startTimeDate.getTime();
      const eightHoursMs = 8 * 60 * 60 * 1000;

      const needsValidation = durationMs > eightHoursMs;
      const validationStatus = needsValidation ? 'pendente' : 'validada';

      const { error } = await supabase
        .from('journeys')
        .update({
          end_time: endTimeStr,
          end_date: endDate,
          end_time_manual: endTime,
          end_odometer: endOdom,
          distance_traveled: dist,
          status: 'encerrada',
          validation_status: validationStatus
        })
        .eq('id', currentJourney!.id);

      if (error) throw error;

      // Atualiza odômetro/horímetro atual do veículo
      const updatePayload: Record<string, number> = { last_odometer: endOdom };
      if (vehicle?.vehicle_type === 'maquina') {
        updatePayload.current_hourmeter = endOdom;
      } else {
        updatePayload.current_odometer = endOdom;
      }

      const { error: vError } = await supabase
        .from('vehicles')
        .update(updatePayload)
        .eq('id', currentJourney!.vehicleId);

      if (vError) throw vError;

      // Limpa estado local
      setCurrentJourney(null);
      setIsEndModalOpen(false);
      setEndOdometer('');
      setSelectedVehicle('');
      setStartOdometer('');

      if (needsValidation) {
        setIsValidationAlertModalOpen(true);
      } else {
        setIsSuccessModalOpen(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao encerrar jornada. Verifique sua conexão.';
      setErrorMessages([message]);
      setIsGeneralErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEndPreviousJourney = async () => {
    const prevStartOdom = previousJourney?.startOdometer || 0;
    const prevVehicle = vehicles.find(v => v.id === previousJourney?.vehicleId);
    const isPrevMaquina = prevVehicle?.vehicle_type === 'maquina';
    const prevMedidorNome = isPrevMaquina ? 'horímetro' : 'odômetro';
    const prevUnidade = isPrevMaquina ? 'h' : 'km';

    if (!endOdometer || Number(endOdometer) <= prevStartOdom) {
      setErrorMessages([
        `O ${prevMedidorNome} final deve ser maior que o ${prevMedidorNome} inicial (${prevStartOdom} ${prevUnidade}).`
      ]);
      setIsGeneralErrorModalOpen(true);
      return;
    }

    setLoading(true);
    try {
      const endTimeStr = `${endDate}T${endTime}`;
      const endOdom = Number(endOdometer);
      const dist = endOdom - previousJourney!.startOdometer;

      const { error } = await supabase
        .from('journeys')
        .update({
          end_time: endTimeStr,
          end_date: endDate,
          end_time_manual: endTime,
          end_odometer: endOdom,
          distance_traveled: dist,
          status: 'encerrada'
        })
        .eq('id', previousJourney!.id);

      if (error) throw error;

      // Atualiza odômetro/horímetro do veículo da jornada anterior
      const updatePayload: Record<string, number> = { last_odometer: endOdom };
      if (prevVehicle?.vehicle_type === 'maquina') {
        updatePayload.current_hourmeter = endOdom;
      } else {
        updatePayload.current_odometer = endOdom;
      }

      await supabase
        .from('vehicles')
        .update(updatePayload)
        .eq('id', previousJourney!.vehicleId);

      setPreviousJourney(null);
      setIsPreviousJourneyModalOpen(false);
      setEndOdometer('');

      setIsSuccessModalOpen(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao encerrar jornada anterior. Verifique sua conexão.';
      setErrorMessages([message]);
      setIsGeneralErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchMaintenanceAlerts = async () => {
      if (!isJourneyOpen || !selectedVehicle) {
        setMaintenanceAlerts([]);
        return;
      }

      try {
        // 1. Fetch Pending Requests
        const { data: requests, error: reqError } = await supabase
          .from('maintenance_requests')
          .select('*')
          .eq('vehicle_id', selectedVehicle)
          .eq('status', 'pendente');

        if (reqError) throw reqError;

        // 2. Busca manutenções autorizadas mas ainda não executadas
        const { data: maintenances, error: mainError } = await supabase
          .from('maintenances')
          .select('*')
          .eq('vehicle_id', selectedVehicle)
          .eq('status', 'pendente');

        if (mainError) throw mainError;

        const alerts: MaintenanceAlert[] = [];

        // Solicitações pendentes -> Informativo (Azul)
        (requests || []).forEach(r => {
          alerts.push({
            id: r.id,
            type: 'request',
            title: 'Solicitação de Manutenção Pendente',
            description: r.description,
            date: r.date,
            severity: 'info'
          });
        });

        // Manutenções autorizadas não executadas -> Alerta (Laranja)
        (maintenances || []).forEach(m => {
          alerts.push({
            id: m.id,
            type: 'authorized',
            title: 'Manutenção Autorizada (Não Executada)',
            description: m.description,
            date: m.date,
            severity: 'warning'
          });
        });

        setMaintenanceAlerts(alerts);
      } catch (_err) {
        // Falha ao buscar alertas de manutenção — exibe sem alertas
      }
    };

    fetchMaintenanceAlerts();
  }, [isJourneyOpen, selectedVehicle]);

  if (!currentUser) return null;

  const vehicle = vehicles.find(v => v.id === selectedVehicle);

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
          <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-tight pr-10">Parte Diária</h1>
        </header>

        <main className="flex-1 px-4 py-6 space-y-6 pb-24">
          <div className="mb-6 space-y-1">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Olá, {currentUser?.name}</h2>
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

          {/* Maintenance Alerts for the Vehicle */}
          {isJourneyOpen && maintenanceAlerts.length > 0 && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 px-1">
                <Wrench size={16} className="text-orange-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Alertas de Manutenção</h3>
              </div>
              {maintenanceAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-xl border flex gap-3 items-start shadow-sm",
                    alert.severity === 'warning' 
                      ? "bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-900/30" 
                      : "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg shrink-0",
                    alert.severity === 'warning' ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                  )}>
                    <AlertCircle size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-bold text-xs dark:text-white truncate">{alert.title}</h4>
                      <span className="text-[9px] font-medium text-slate-500 uppercase shrink-0 ml-2">
                        {new Date(alert.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                      "{alert.description}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Time Bank Summary Card */}
          <div className="card p-6 bg-primary text-white border-none shadow-xl shadow-primary/20 overflow-hidden relative">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Clock size={20} />
                </div>
                <span className="text-sm font-medium text-white/80">Seu Banco de Horas</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-bold">{timeBankTotal}</h3>
                <span className="text-sm font-medium text-white/60">HH:MM</span>
              </div>
              <button 
                onClick={() => navigate('/time-bank')}
                className="mt-4 text-xs text-white/80 flex items-center gap-1 hover:text-white transition-colors"
              >
                <span>Ver histórico detalhado</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

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
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {vehicle?.vehicle_type === 'maquina' ? 'Horímetro Inicial (Horas)' : 'Quilometragem Inicial (KM)'}
              </label>
              <div className="relative flex items-center">
                <Zap className="absolute left-4 text-slate-400 w-5 h-5" />
                <input
                  className={cn(
                    "input-field pl-12",
                    isJourneyOpen && "bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                  )}
                  placeholder={vehicle?.vehicle_type === 'maquina' ? "Ex: 500" : "Ex: 125430"}
                  type="number"
                  value={startOdometer}
                  onChange={(e) => setStartOdometer(e.target.value)}
                  disabled={isJourneyOpen}
                />
              </div>
            </div>
          </section>

          <div className="pt-4 flex flex-col gap-4">
            {!isJourneyOpen && (
              <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 text-center font-medium">Preencha os dados acima para iniciar sua jornada</p>
              </div>
            )}
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
              <button 
                onClick={() => navigate('/maintenance-list')}
                className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors"
              >
                <Wrench size={24} />
                <p className="text-[9px] font-bold uppercase tracking-tight text-center">Manutenções</p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                  Para finalizar sua jornada com o veículo <span className="font-bold text-slate-700 dark:text-slate-200">{vehicle?.model}</span>, informe os dados de encerramento.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Data Fim</label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-4 text-slate-400 w-5 h-5" />
                      <input
                        className="input-field pl-12"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Hora Fim</label>
                    <div className="relative flex items-center">
                      <Clock className="absolute left-4 text-slate-400 w-5 h-5" />
                      <input
                        className="input-field pl-12"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    {vehicle?.vehicle_type === 'maquina' ? 'Horímetro Final (Horas)' : 'KM Final'}
                  </label>
                  <div className="relative flex items-center">
                    <Zap className="absolute left-4 text-slate-400 w-5 h-5" />
                    <input
                      className="input-field pl-12"
                      placeholder={vehicle?.vehicle_type === 'maquina' ? "Ex: 510" : "Ex: 125580"}
                      type="number"
                      value={endOdometer}
                      onChange={(e) => setEndOdometer(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[10px] text-slate-400">
                      {vehicle?.vehicle_type === 'maquina' ? 'Horímetro Inicial' : 'KM Inicial'}: {currentJourney?.startOdometer} {vehicle?.vehicle_type === 'maquina' ? 'h' : 'KM'}
                    </p>
                    {endOdometer && Number(endOdometer) > (currentJourney?.startOdometer || 0) && (
                      <p className="text-[10px] font-bold text-primary">
                        {vehicle?.vehicle_type === 'maquina' ? 'Horas Trabalhadas' : 'KM Rodados'}: {Number(endOdometer) - (currentJourney?.startOdometer || 0)} {vehicle?.vehicle_type === 'maquina' ? 'h' : 'KM'}
                      </p>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-sm:max-w-xs max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                  Por favor, informe os dados de encerramento para finalizar a jornada anterior antes de iniciar uma nova.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Data Fim</label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-4 text-slate-400 w-5 h-5" />
                      <input
                        className="input-field pl-12"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Hora Fim</label>
                    <div className="relative flex items-center">
                      <Clock className="absolute left-4 text-slate-400 w-5 h-5" />
                      <input
                        className="input-field pl-12"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
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

        {/* Modal de Erro de Odômetro/Horímetro */}
        {isOdometerErrorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full">
                    <Zap className="text-amber-600 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {vehicle?.vehicle_type === 'maquina' ? 'Erro de Horímetro' : 'Erro de Quilometragem'}
                    </h3>
                    {errorMessages.length > 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{errorMessages[0]}</p>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {vehicle?.vehicle_type === 'maquina'
                          ? 'O horímetro inicial informado é inferior ao último registro deste equipamento.'
                          : 'O KM inicial informado é inferior ao último registro de encerramento deste veículo.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {vehicle?.vehicle_type === 'maquina' ? 'Último Horímetro' : 'Último KM Final'}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {lastOdometerValue} {vehicle?.vehicle_type === 'maquina' ? 'h' : 'km'}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/20 text-center">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                      {vehicle?.vehicle_type === 'maquina' ? 'Horímetro Digitado' : 'KM Digitado'}
                    </p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {startOdometer} {vehicle?.vehicle_type === 'maquina' ? 'h' : 'km'}
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs text-amber-800 dark:text-amber-400 text-center font-medium">
                    {vehicle?.vehicle_type === 'maquina'
                      ? 'Por favor, verifique o painel do equipamento e corrija o horímetro para prosseguir.'
                      : 'Por favor, verifique o painel do veículo e corrija a quilometragem para prosseguir.'}
                  </p>
                </div>

                <button
                  onClick={() => { setIsOdometerErrorModalOpen(false); setErrorMessages([]); }}
                  className="btn-primary w-full h-14"
                >
                  {vehicle?.vehicle_type === 'maquina' ? 'Corrigir Horímetro' : 'Corrigir Quilometragem'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Alert Modal */}
      {isValidationAlertModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Jornada Encerrada</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Sua jornada foi superior a 08 horas e será submetida à validação do gestor para o registro no banco de horas.
              </p>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setIsValidationAlertModalOpen(false)}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
        {isSuccessModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 space-y-6 flex flex-col items-center text-center max-h-[80vh] overflow-y-auto">
                <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full animate-bounce">
                  <CheckCircle2 className="text-green-600 w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Sucesso!</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    A jornada foi encerrada corretamente no sistema.
                  </p>
                </div>
                
                <button 
                  onClick={() => setIsSuccessModalOpen(false)}
                  className="w-full h-14 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* General Error Modal */}
        {isGeneralErrorModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                    <X className="text-red-600 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Atenção</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Não foi possível processar o encerramento da jornada.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {errorMessages.map((msg, i) => (
                    <div key={i} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 leading-relaxed text-center">
                        {msg}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setIsGeneralErrorModalOpen(false)}
                    className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    Entendido
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
