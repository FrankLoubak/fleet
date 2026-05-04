import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Search, 
  Filter, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Zap, 
  Truck, 
  User as UserIcon,
  CheckCircle2,
  ArrowRight,
  Droplets,
  Wrench as WrenchIcon,
  ClipboardList,
  Info,
  Download,
  Loader2,
  Menu,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Autocomplete from '../components/Autocomplete';
import { cn } from '../utils';
import { User as UserType, Journey, Vehicle, RefuelingRecord, MaintenanceRecord } from '../types';
import { supabase } from '../lib/supabase';

// Extensão de RefuelingRecord com consumo médio calculado por período
interface FuelingWithConsumption extends RefuelingRecord {
  averageConsumption: number;
}

export default function Journeys() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  
  // CRUD States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFuelingModalOpen, setIsFuelingModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [editingJourney, setEditingJourney] = useState<Journey | null>(null);
  const [journeyToDelete, setJourneyToDelete] = useState<Journey | null>(null);
  const [associatedRecords, setAssociatedRecords] = useState<{
    refuelings: number;
    maintenances: number;
    maintenanceRequests: number;
  }>({ refuelings: 0, maintenances: 0, maintenanceRequests: 0 });
  const [isCheckingAssociated, setIsCheckingAssociated] = useState(false);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState<Vehicle | null>(null);
  const [vehicleFuelings, setVehicleFuelings] = useState<FuelingWithConsumption[]>([]);
  const [vehicleMaintenances, setVehicleMaintenances] = useState<MaintenanceRecord[]>([]);
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOdometerErrorModalOpen, setIsOdometerErrorModalOpen] = useState(false);
  const [lastOdometerValue, setLastOdometerValue] = useState(0);
  const [journeyToValidate, setJourneyToValidate] = useState<Journey | null>(null);
  const [isValidationConfirmModalOpen, setIsValidationConfirmModalOpen] = useState(false);

  const handleExportJourneysCSV = async () => {
    setLoading(true);
    try {
      const { data: refuelingsData } = await supabase.from('refuelings').select('*');
      const { data: maintenancesData } = await supabase.from('maintenances').select('*');
      const { data: bancoHorasData } = await supabase.from('banco_de_horas').select('*');

      const headers = [
        'Motorista', 
        'Veículo (Placa)', 
        'Modelo',
        'Tipo de Transporte',
        'Data Início', 
        'Hora Início',
        'Data Fim',
        'Hora Fim',
        'KM Inicial', 
        'KM Final', 
        'Distância', 
        'Status', 
        'Horas Jornada (Líquida)',
        'Intervalo',
        'Qtd Combustível (L)',
        'Custo Combustível (R$)',
        'Manutenções Realizadas',
        'Horas Banco de Horas'
      ];

      const rows = filteredJourneys.map(j => {
        const user = users.find(u => u.id === j.userId);
        const vehicle = vehicles.find(v => v.id === j.vehicleId);
        
        const start = new Date(j.startTime);
        const end = j.endTime ? new Date(j.endTime) : null;
        
        let durationStr = '-';
        let intervalStr = '-';

        if (start && end) {
          let diffMs = end.getTime() - start.getTime();
          
          if (j.interval_ini && j.interval_fim) {
            const dateStr = j.startTime.split('T')[0];
            const iStart = new Date(`${dateStr}T${j.interval_ini}`);
            const iEnd = new Date(`${dateStr}T${j.interval_fim}`);
            if (iEnd < iStart) iEnd.setDate(iEnd.getDate() + 1);
            const intervalMs = iEnd.getTime() - iStart.getTime();
            
            if (intervalMs > 0) {
              diffMs -= intervalMs;
              const iHours = Math.floor(intervalMs / (1000 * 60 * 60));
              const iMinutes = Math.floor((intervalMs % (1000 * 60 * 60)) / (1000 * 60));
              intervalStr = `${iHours.toString().padStart(2, '0')}:${iMinutes.toString().padStart(2, '0')}`;
            }
          }
          
          if (diffMs > 0) {
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          }
        }

        const journeyDateStr = j.startTime.split('T')[0];
        const jRefuelings = (refuelingsData || []).filter(r => 
          r.vehicle_id === j.vehicleId && r.date === journeyDateStr
        );
        const totalQty = jRefuelings.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
        const totalVal = jRefuelings.reduce((sum, r) => sum + (Number(r.total_value) || 0), 0);

        const jMaintenances = (maintenancesData || []).filter(m => 
          m.vehicle_id === j.vehicleId && m.date === journeyDateStr
        );
        const maintenancesList = jMaintenances.map(m => `${m.type}: ${m.description.replace(/;/g, ',')}`).join(' | ');

        const bHoras = (bancoHorasData || []).find(b => b.journey_id === j.id);
        const poolHours = bHoras ? bHoras.horas_adquiridas : '00:00';

        return [
          user ? user.name : '-',
          vehicle ? vehicle.plate : '-',
          vehicle ? vehicle.model : '-',
          j.tipo_transp || '-',
          start.toLocaleDateString('pt-BR'),
          start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          end ? end.toLocaleDateString('pt-BR') : '-',
          end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
          j.startOdometer,
          j.endOdometer || '-',
          j.distanceTraveled || '-',
          j.status === 'aberta' ? 'Aberta' : 'Encerrada',
          durationStr,
          intervalStr,
          totalQty.toString().replace('.', ','),
          totalVal.toString().replace('.', ','),
          maintenancesList || '-',
          poolHours
        ];
      });

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio_jornadas_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportFuelingsToCSV = () => {
    if (!selectedVehicleForDetails || vehicleFuelings.length === 0) return;
    
    const headers = ['Data', 'Tipo', 'KM', 'Quantidade (L)', 'Local', 'Consumo (km/L)'];
    const rows = vehicleFuelings.map(r => [
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
    link.setAttribute('download', `abastecimentos_${selectedVehicleForDetails.plate}_${modalStartDate}_${modalEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMaintenancesToCSV = () => {
    if (!selectedVehicleForDetails || vehicleMaintenances.length === 0) return;
    
    const headers = ['Data', 'Tipo', 'Prestador', 'KM', 'Descrição'];
    const rows = vehicleMaintenances.map(m => [
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
    link.setAttribute('download', `manutencoes_${selectedVehicleForDetails.plate}_${modalStartDate}_${modalEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const [formData, setFormData] = useState<{
    userId: string;
    vehicleId: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    startOdometer: number;
    endOdometer: number;
    status: 'aberta' | 'encerrada';
    observations: string;
  }>({
    userId: '',
    vehicleId: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    startOdometer: 0,
    endOdometer: 0,
    status: 'encerrada',
    observations: ''
  });

  useEffect(() => {
    const initPage = async () => {
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
      setCurrentUser(user);
      await loadData();
    };
    initPage();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: journeysData, error: jError } = await supabase
        .from('journeys')
        .select('*');
      
      const { data: vehiclesData, error: vError } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate');

      const { data: profilesData, error: pError } = await supabase
        .from('profiles')
        .select('*');

      if (jError) throw jError;
      if (vError) throw vError;
      if (pError) throw pError;

      // Normalize journeys (snake_case to camelCase)
      const normalizedJourneys = (journeysData || []).map(j => ({
        id: j.id,
        userId: j.user_id,
        vehicleId: j.vehicle_id,
        startTime: j.start_time,
        endTime: j.end_time,
        endDate: j.end_date,
        endTimeManual: j.end_time_manual,
        startOdometer: j.start_odometer,
        endOdometer: j.end_odometer,
        distanceTraveled: j.distance_traveled,
        status: j.status,
        observations: j.observations,
        start_location: j.start_location,
        destination: j.destination,
        end_location: j.end_location,
        tipo_transp: j.tipo_transp,
        validation_status: j.validation_status,
        validated_by: j.validated_by,
        horasExcedentes: j.horas_excedentes || 0,
        intervalIni: j.interval_ini || '',
        intervalFim: j.interval_fim || ''
      }));

      setJourneys(normalizedJourneys);
      
      const normalizedVehicles = (vehiclesData || []).map(v => ({
        ...v,
        lastOdometer: v.last_odometer
      }));
      setVehicles(normalizedVehicles);
      
      // Normalize profiles to UserType
      const normalizedUsers = (profilesData || []).map(p => ({
        id: p.id,
        name: p.name,
        email: '', // Not available in profiles table usually
        role: p.role,
        avatar: p.avatar_url
      }));
      setUsers(normalizedUsers);
    } catch (_err) {
      // Falha ao carregar dados de jornadas — mantém estado anterior
    } finally {
      setLoading(false);
    }
  };

  const handleValidateJourney = async (journey: Journey) => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { error: jError } = await supabase
        .from('journeys')
        .update({ validation_status: 'validada', validated_by: currentUser.id })
        .eq('id', journey.id);

      if (jError) throw jError;

      // Insere no banco_de_horas apenas se há excedente registrado na jornada
      const excedente = journey.horasExcedentes || 0;
      if (excedente > 0) {
        const { error: bError } = await supabase
          .from('banco_de_horas')
          .insert([{
            user_id: journey.userId,
            journey_id: journey.id,
            horas_adquiridas: excedente
          }]);
        if (bError) throw bError;
      }

      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao validar jornada: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (journey: Journey | null = null) => {
    if (journey) {
      setEditingJourney(journey);
      setFormData({
        userId: journey.userId,
        vehicleId: journey.vehicleId,
        startDate: journey.startTime.split('T')[0],
        startTime: journey.startTime.split('T')[1].substring(0, 5),
        endDate: journey.endDate || (journey.endTime ? journey.endTime.split('T')[0] : ''),
        endTime: journey.endTimeManual || (journey.endTime ? (journey.endTime.includes('T') ? journey.endTime.split('T')[1].substring(0, 5) : '') : ''),
        startOdometer: journey.startOdometer,
        endOdometer: journey.endOdometer || 0,
        status: journey.status,
        observations: journey.observations || '',
        startLocation: journey.start_location || '',
        destination: journey.destination || '',
        endLocation: journey.end_location || '',
        tipoTransp: journey.tipo_transp || '',
        intervalIni: journey.interval_ini || '',
        intervalFim: journey.interval_fim || ''
      });
    } else {
      setEditingJourney(null);
      setFormData({
        userId: '',
        vehicleId: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endDate: '',
        endTime: '',
        startOdometer: 0,
        endOdometer: 0,
        status: 'aberta',
        observations: '',
        startLocation: '',
        destination: '',
        endLocation: '',
        tipoTransp: '',
        intervalIni: '',
        intervalFim: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de odômetro/horímetro inicial para novas jornadas
    if (!editingJourney) {
      const vehicle = vehicles.find(v => v.id === formData.vehicleId);
      if (vehicle) {
        const isMaquina = vehicle.vehicle_type === 'maquina';
        const minValue = isMaquina
          ? (vehicle.current_hourmeter || vehicle.lastOdometer || 0)
          : (vehicle.current_odometer || vehicle.lastOdometer || 0);
        if (Number(formData.startOdometer) < minValue) {
          setLastOdometerValue(minValue);
          setIsOdometerErrorModalOpen(true);
          return;
        }
      }
    }

    setLoading(true);
    
    try {
      const startTimeStr = `${formData.startDate}T${formData.startTime}`;
      const endTimeStr = formData.endDate && formData.endTime ? `${formData.endDate}T${formData.endTime}` : null;

      // Regra 2: encerramento não pode ser no futuro
      if (formData.status === 'encerrada' && endTimeStr && new Date(endTimeStr) > new Date()) {
        alert('O horário de encerramento não pode ser no futuro.');
        setLoading(false);
        return;
      }

      // Regra 1: sobreposição de jornadas para o mesmo motorista
      if (formData.userId && endTimeStr) {
        let overlapQuery = supabase
          .from('journeys')
          .select('id, start_time, end_time, status')
          .eq('user_id', formData.userId)
          .lt('start_time', endTimeStr)
          .not('end_time', 'is', null)
          .gt('end_time', startTimeStr);

        if (editingJourney) {
          overlapQuery = overlapQuery.neq('id', editingJourney.id);
        }

        const { data: overlapData, error: overlapErr } = await overlapQuery.limit(1);
        if (overlapErr) throw overlapErr;

        if (overlapData && overlapData.length > 0) {
          const oj = overlapData[0];
          const fmtS = new Date(oj.start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          const fmtE = new Date(oj.end_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          alert(`Sobreposição de jornada: este motorista já possui jornada entre ${fmtS} e ${fmtE}.`);
          setLoading(false);
          return;
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const isRetroactive = formData.startDate < today;

      let horasExcedentes = 0;
      if (formData.status === 'encerrada' && endTimeStr) {
        const startD = new Date(startTimeStr);
        const endD = new Date(endTimeStr);
        let durationMs = endD.getTime() - startD.getTime();
        const iniInterval = editingJourney?.intervalIni || '';
        const fimInterval = editingJourney?.intervalFim || '';
        if (iniInterval && fimInterval) {
          const [iniH, iniM] = iniInterval.split(':').map(Number);
          const [fimH, fimM] = fimInterval.split(':').map(Number);
          const intervaloMs = ((fimH * 60 + fimM) - (iniH * 60 + iniM)) * 60 * 1000;
          if (intervaloMs > 0) durationMs -= intervaloMs;
        }
        const eightHoursMs = 8 * 60 * 60 * 1000;
        horasExcedentes = durationMs > eightHoursMs
          ? Math.round(((durationMs - eightHoursMs) / 3600000) * 100) / 100
          : 0;
      }

      const journeyPayload = {
        user_id: formData.userId,
        vehicle_id: formData.vehicleId,
        start_time: startTimeStr,
        end_time: endTimeStr,
        end_date: formData.endDate,
        end_time_manual: formData.endTime,
        start_odometer: Number(formData.startOdometer),
        end_odometer: formData.status === 'encerrada' ? Number(formData.endOdometer) : null,
        distance_traveled: formData.status === 'encerrada' ? Number(formData.endOdometer) - Number(formData.startOdometer) : null,
        status: formData.status,
        observations: formData.observations,
        horas_excedentes: formData.status === 'encerrada' ? horasExcedentes : null,
        validation_status: formData.status === 'encerrada'
          ? ((horasExcedentes > 0 || isRetroactive) ? 'pendente' : 'validada')
          : (isRetroactive ? 'pendente' : null)
      };

      if (editingJourney) {
        const { error } = await supabase
          .from('journeys')
          .update(journeyPayload)
          .eq('id', editingJourney.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('journeys')
          .insert([journeyPayload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      
      // Update vehicle last_odometer if any KM is higher than current
      const vehicle = vehicles.find(v => v.id === formData.vehicleId);
      if (vehicle) {
        const maxKm = Math.max(
          Number(formData.startOdometer) || 0,
          formData.status === 'encerrada' ? (Number(formData.endOdometer) || 0) : 0
        );
        
        if (maxKm > vehicle.lastOdometer) {
          await supabase
            .from('vehicles')
            .update({ last_odometer: maxKm })
            .eq('id', formData.vehicleId);
        }
      }

      await loadData();
    } catch (_err) {
      alert('Erro ao salvar jornada. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewFuelings = (vehicle: Vehicle) => {
    setSelectedVehicleForDetails(vehicle);
    setModalStartDate(filterStartDate);
    setModalEndDate(filterEndDate);
    setIsFuelingModalOpen(true);
  };

  const handleViewMaintenances = (vehicle: Vehicle) => {
    setSelectedVehicleForDetails(vehicle);
    setModalStartDate(filterStartDate);
    setModalEndDate(filterEndDate);
    setIsMaintenanceModalOpen(true);
  };

  useEffect(() => {
    const fetchFuelings = async () => {
      if (isFuelingModalOpen && selectedVehicleForDetails) {
        const { data: allRefuelings, error } = await supabase
          .from('refuelings')
          .select('*')
          .eq('vehicle_id', selectedVehicleForDetails.id)
          .order('date', { ascending: true });

        if (error) {
          // Falha ao buscar abastecimentos — exibe lista vazia
          return;
        }

        const normalized = (allRefuelings || []).map(r => ({
          ...r,
          vehicleId: r.vehicle_id,
          fuelType: r.fuel_type
        }));

        const filtered: FuelingWithConsumption[] = normalized.filter(r => {
          const matchesDate = (!modalStartDate || r.date >= modalStartDate) &&
                             (!modalEndDate || r.date <= modalEndDate);
          return matchesDate;
        }).map((r, index, array) => {
          const prevRef = index > 0 ? array[index - 1] : null;

          let averageConsumption = 0;
          if (prevRef && r.quantity > 0) {
            averageConsumption = (r.odometer - prevRef.odometer) / r.quantity;
          }

          return { ...r, averageConsumption };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setVehicleFuelings(filtered);
      }
    };
    fetchFuelings();
  }, [isFuelingModalOpen, selectedVehicleForDetails, modalStartDate, modalEndDate]);

  useEffect(() => {
    const fetchMaintenances = async () => {
      if (isMaintenanceModalOpen && selectedVehicleForDetails) {
        const { data: allMaintenances, error } = await supabase
          .from('maintenances')
          .select('*')
          .eq('vehicle_id', selectedVehicleForDetails.id)
          .order('date', { ascending: false });

        if (error) {
          // Falha ao buscar manutenções — exibe lista vazia
          return;
        }

        const filtered = (allMaintenances || []).filter(m => {
          const matchesDate = (!modalStartDate || m.date >= modalStartDate) && 
                             (!modalEndDate || m.date <= modalEndDate);
          return matchesDate;
        });
        
        setVehicleMaintenances(filtered);
      }
    };
    fetchMaintenances();
  }, [isMaintenanceModalOpen, selectedVehicleForDetails, modalStartDate, modalEndDate]);

  useEffect(() => {
    const fetchAssociatedRecords = async () => {
      if (!journeyToDelete || !isDeleteModalOpen) return;
      
      setIsCheckingAssociated(true);
      try {
        const startTime = journeyToDelete.startTime;
        const endTime = journeyToDelete.endTime || new Date().toISOString();
        const vehicleId = journeyToDelete.vehicleId;

        // Fetch refuelings
        const { count: refCount, error: refError } = await supabase
          .from('refuelings')
          .select('*', { count: 'exact', head: true })
          .eq('vehicle_id', vehicleId)
          .gte('created_at', startTime)
          .lte('created_at', endTime);

        // Fetch maintenances
        const { count: maintCount, error: maintError } = await supabase
          .from('maintenances')
          .select('*', { count: 'exact', head: true })
          .eq('vehicle_id', vehicleId)
          .gte('created_at', startTime)
          .lte('created_at', endTime);

        // Fetch maintenance requests
        const { count: reqCount, error: reqError } = await supabase
          .from('maintenance_requests')
          .select('*', { count: 'exact', head: true })
          .eq('vehicle_id', vehicleId)
          .gte('created_at', startTime)
          .lte('created_at', endTime);

        if (refError) throw refError;
        if (maintError) throw maintError;
        if (reqError) throw reqError;

        setAssociatedRecords({
          refuelings: refCount || 0,
          maintenances: maintCount || 0,
          maintenanceRequests: reqCount || 0
        });
      } catch (_err) {
        // Falha ao buscar registros vinculados — exibe sem contagem
      } finally {
        setIsCheckingAssociated(false);
      }
    };

    fetchAssociatedRecords();
  }, [journeyToDelete, isDeleteModalOpen]);

  const handleDeleteJourney = async () => {
    if (!journeyToDelete) return;
    setLoading(true);
    try {
      const startTime = journeyToDelete.startTime;
      const endTime = journeyToDelete.endTime || new Date().toISOString();
      const vehicleId = journeyToDelete.vehicleId;

      // Delete refuelings
      const { error: refError } = await supabase
        .from('refuelings')
        .delete()
        .eq('vehicle_id', vehicleId)
        .gte('created_at', startTime)
        .lte('created_at', endTime);
      
      if (refError) throw refError;

      // Delete maintenances
      const { error: maintError } = await supabase
        .from('maintenances')
        .delete()
        .eq('vehicle_id', vehicleId)
        .gte('created_at', startTime)
        .lte('created_at', endTime);
      
      if (maintError) throw maintError;

      // Delete maintenance requests
      const { error: reqError } = await supabase
        .from('maintenance_requests')
        .delete()
        .eq('vehicle_id', vehicleId)
        .gte('created_at', startTime)
        .lte('created_at', endTime);
      
      if (reqError) throw reqError;

      // Delete the journey itself
      const { error } = await supabase
        .from('journeys')
        .delete()
        .eq('id', journeyToDelete.id);
      
      if (error) throw error;

      setIsDeleteModalOpen(false);
      setJourneyToDelete(null);
      setAssociatedRecords({ refuelings: 0, maintenances: 0, maintenanceRequests: 0 });
      await loadData();
    } catch (_err) {
      alert('Erro ao excluir jornada. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const filteredJourneys = journeys.filter(j => {
    const vehicle = vehicles.find(v => v.id === j.vehicleId);
    const user = users.find(u => u.id === j.userId);
    const searchStr = searchQuery.toLowerCase();
    
    // Date filtering
    const journeyDate = j.startTime.split('T')[0];
    const matchesDate = (!filterStartDate || journeyDate >= filterStartDate) && 
                       (!filterEndDate || journeyDate <= filterEndDate);

    if (!matchesDate) return false;
    
    return (
      j.id.toLowerCase().includes(searchStr) ||
      (vehicle?.plate.toLowerCase().includes(searchStr)) ||
      (vehicle?.model.toLowerCase().includes(searchStr)) ||
      (user?.name.toLowerCase().includes(searchStr))
    );
  }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  if (!currentUser) return null;

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
            <h2 className="text-base md:text-lg font-bold dark:text-white">Gestão de Jornadas</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportJourneysCSV}
              disabled={loading || filteredJourneys.length === 0}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
              title="Exportar jornadas filtradas para CSV"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              <span className="hidden md:inline">Exportar CSV</span>
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Nova Jornada</span>
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          {/* Validation Notification Box */}
          {filteredJourneys.some(j => j.status === 'encerrada' && j.validation_status === 'pendente') && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900 dark:text-amber-400">Jornadas Pendentes de Validação</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-500/80">Existem jornadas com mais de 08 horas que precisam ser validadas para o banco de horas.</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-700 dark:text-amber-400 font-bold text-sm">
                {filteredJourneys.filter(j => j.status === 'encerrada' && j.validation_status === 'pendente').length} Pendentes
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto flex-1">
              <div className="flex flex-col gap-1.5 flex-1 md:max-w-xs">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Pesquisa Geral</label>
                <Autocomplete
                  table="vehicles"
                  column="plate"
                  placeholder="Placa, motorista ou ID..."
                  defaultValue={searchQuery}
                  onSelect={(val) => setSearchQuery(val)}
                />
              </div>
              
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Período</label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="date"
                      className="pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                  </div>
                  <span className="text-slate-400 text-sm">até</span>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                      type="date"
                      className="pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                  </div>
                  {(filterStartDate || filterEndDate) && (
                    <button 
                      onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Limpar filtros"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setFilterStartDate(today);
                    setFilterEndDate(today);
                  }}
                  className="px-3 py-1 text-[10px] font-bold uppercase border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 transition-all"
                >
                  Hoje
                </button>
                <button 
                  onClick={() => {
                    const date = new Date();
                    date.setDate(date.getDate() - 7);
                    setFilterStartDate(date.toISOString().split('T')[0]);
                    setFilterEndDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1 text-[10px] font-bold uppercase border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 transition-all"
                >
                  7 Dias
                </button>
                <button 
                  onClick={() => {
                    const date = new Date();
                    date.setDate(1);
                    setFilterStartDate(date.toISOString().split('T')[0]);
                    setFilterEndDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="px-3 py-1 text-[10px] font-bold uppercase border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 transition-all"
                >
                  Mês
                </button>
              </div>
              <div className="text-sm text-slate-500 font-medium pb-2">
                {filteredJourneys.length} jornadas encontradas
              </div>
            </div>
          </div>

          <div className="card relative">
            {loading && (
              <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Veículo</th>
                  <th className="px-6 py-4">Motorista</th>
                  <th className="px-6 py-4">KM (Início/Fim)</th>
                  <th className="px-6 py-4">Deslocamento</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Duração / Excedente</th>
                  <th className="px-6 py-4">Validação</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredJourneys.map((journey) => {
                  const vehicle = vehicles.find(v => v.id === journey.vehicleId);
                  const user = users.find(u => u.id === journey.userId);
                  
                  return (
                    <tr key={journey.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold dark:text-white">
                            {new Date(journey.startTime).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(journey.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {journey.endTime && ` - ${new Date(journey.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Truck size={16} className="text-slate-400" />
                          <div>
                            <p className="text-sm font-bold dark:text-white">{vehicle?.plate || '---'}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{vehicle?.model || '---'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <UserIcon size={16} className="text-slate-400" />
                          <span className="text-sm dark:text-slate-300">{user?.name || '---'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium dark:text-slate-300">
                          <span>{journey.startOdometer.toLocaleString()}</span>
                          <ArrowRight size={14} className="text-slate-300" />
                          <span>{journey.endOdometer ? journey.endOdometer.toLocaleString() : '---'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col max-w-[200px]">
                          <p className="text-[10px] text-slate-500 truncate" title={journey.start_location}>
                            <span className="font-bold">Início:</span> {journey.start_location || '---'}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate" title={journey.destination}>
                            <span className="font-bold">Destino:</span> {journey.destination || '---'}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate" title={journey.end_location}>
                            <span className="font-bold">Fim:</span> {journey.end_location || '---'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                          journey.status === 'aberta' 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          {journey.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {journey.endTime ? (() => {
                              const start = new Date(journey.startTime);
                              const end = new Date(journey.endTime);
                              let diff = end.getTime() - start.getTime();

                              // Subtract interval
                              if (journey.interval_ini && journey.interval_fim) {
                                const [h1, m1] = journey.interval_ini.split(':').map(Number);
                                const [h2, m2] = journey.interval_fim.split(':').map(Number);
                                const dateStr = journey.startTime.split('T')[0];
                                
                                const iStart = new Date(`${dateStr}T${journey.interval_ini}`);
                                const iEnd = new Date(`${dateStr}T${journey.interval_fim}`);
                                
                                if (iEnd < iStart) {
                                  iEnd.setDate(iEnd.getDate() + 1);
                                }
                                
                                const intervalMs = iEnd.getTime() - iStart.getTime();
                                if (intervalMs > 0) {
                                  diff -= intervalMs;
                                }
                              }

                              const h = Math.floor(diff / (1000 * 60 * 60));
                              const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                              return `${h}h ${m}m`;
                            })() : '---'}
                          </span>
                          {journey.endTime && (() => {
                            const start = new Date(journey.startTime);
                            const end = new Date(journey.endTime);
                            let diff = end.getTime() - start.getTime();

                            // Subtract interval for excess check too
                            if (journey.interval_ini && journey.interval_fim) {
                              const [h1, m1] = journey.interval_ini.split(':').map(Number);
                              const [h2, m2] = journey.interval_fim.split(':').map(Number);
                              const dateStr = journey.startTime.split('T')[0];
                              
                              const iStart = new Date(`${dateStr}T${journey.interval_ini}`);
                              const iEnd = new Date(`${dateStr}T${journey.interval_fim}`);
                              
                              if (iEnd < iStart) {
                                iEnd.setDate(iEnd.getDate() + 1);
                              }
                              
                              const intervalMs = iEnd.getTime() - iStart.getTime();
                              if (intervalMs > 0) {
                                diff -= intervalMs;
                              }
                            }

                            const eightHoursMs = 8 * 60 * 60 * 1000;
                            if (diff > eightHoursMs) {
                              const excess = diff - eightHoursMs;
                              const eh = Math.floor(excess / (1000 * 60 * 60));
                              const em = Math.floor((excess % (1000 * 60 * 60)) / (1000 * 60));
                              return <span className="text-[10px] text-amber-600 font-bold">+{eh}h {em}m excedente</span>;
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {journey.status === 'encerrada' && (
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                              journey.validation_status === 'validada' 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            )}>
                              {journey.validation_status || 'validada'}
                            </span>
                            {journey.validated_by && (
                              <span className="text-[10px] text-slate-400 italic">
                                por {users.find(u => u.id === journey.validated_by)?.name || 'Admin'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {journey.status === 'encerrada' && journey.validation_status === 'pendente' && (
                            <button
                              onClick={() => { setJourneyToValidate(journey); setIsValidationConfirmModalOpen(true); }}
                              className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors text-green-600 dark:text-green-400"
                              title="Validar Jornada"
                            >
                              <ShieldCheck size={18} />
                            </button>
                          )}
                          {vehicle && (
                            <>
                              <button 
                                onClick={() => handleViewFuelings(vehicle)}
                                className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors text-amber-600 dark:text-amber-400"
                                title="Ver Abastecimentos"
                              >
                                <Droplets size={18} />
                              </button>
                              <button 
                                onClick={() => handleViewMaintenances(vehicle)}
                                className="p-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors text-purple-600 dark:text-purple-400"
                                title="Ver Manutenções"
                              >
                                <WrenchIcon size={18} />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => handleOpenModal(journey)}
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setJourneyToDelete(journey);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600 dark:text-red-400"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal CRUD */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingJourney ? 'Editar Jornada' : 'Nova Jornada'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSaveJourney} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Motorista</label>
                    <select 
                      required
                      className="input-field"
                      value={formData.userId}
                      onChange={(e) => setFormData({...formData, userId: e.target.value})}
                    >
                      <option value="">Selecione</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Veículo</label>
                    <select 
                      required
                      className="input-field"
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                    >
                      <option value="">Selecione</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Data Início</label>
                    <input type="date" required className="input-field" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Hora Início</label>
                    <input type="time" required className="input-field" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} step="60" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">KM Inicial</label>
                    <input type="number" required className="input-field" value={formData.startOdometer} onChange={(e) => setFormData({...formData, startOdometer: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Status</label>
                    <select className="input-field" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as 'aberta' | 'encerrada'})}>
                      <option value="aberta">Aberta</option>
                      <option value="encerrada">Encerrada</option>
                    </select>
                  </div>
                </div>

                {formData.status === 'encerrada' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Data Fim</label>
                        <input type="date" required className="input-field" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Hora Fim</label>
                        <input type="time" required className="input-field" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} step="60" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">KM Final</label>
                      <input type="number" required className="input-field" value={formData.endOdometer} onChange={(e) => setFormData({...formData, endOdometer: Number(e.target.value)})} />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Observações</label>
                  <textarea className="input-field min-h-[80px] py-2" value={formData.observations} onChange={(e) => setFormData({...formData, observations: e.target.value})} />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Intervalo</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Início</label>
                      <input type="time" className="input-field h-10 text-sm" value={formData.intervalIni} onChange={(e) => setFormData({...formData, intervalIni: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fim</label>
                      <input type="time" className="input-field h-10 text-sm" value={formData.intervalFim} onChange={(e) => setFormData({...formData, intervalFim: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deslocamento</h4>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Local de Início</label>
                      <input type="text" className="input-field h-10 text-sm" value={formData.startLocation} onChange={(e) => setFormData({...formData, startLocation: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Destino</label>
                      <input type="text" className="input-field h-10 text-sm" value={formData.destination} onChange={(e) => setFormData({...formData, destination: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tipo de Transporte</label>
                      <select
                        className="input-field h-10 text-sm"
                        value={formData.tipoTransp}
                        onChange={(e) => setFormData({...formData, tipoTransp: e.target.value})}
                      >
                        <option value="">Selecione o tipo</option>
                        <option value="01-colaboradores">01-colaboradores</option>
                        <option value="02-CBUQ">02-CBUQ</option>
                        <option value="03-Agregados">03-Agregados</option>
                        <option value="04-Solo">04-Solo</option>
                        <option value="05-Outros">05-Outros</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Local Encerramento</label>
                      <input type="text" className="input-field h-10 text-sm" value={formData.endLocation} onChange={(e) => setFormData({...formData, endLocation: e.target.value})} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Validation Confirm Modal */}
        {isValidationConfirmModalOpen && journeyToValidate && (() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const jDate = journeyToValidate.startTime.split('T')[0];
          const isRetro = jDate < todayStr;
          const excedente = journeyToValidate.horasExcedentes || 0;
          const exH = Math.floor(excedente);
          const exM = Math.round((excedente - exH) * 60);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirmar Validação</h3>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {users.find(u => u.id === journeyToValidate.userId)?.name || 'Motorista'} — {new Date(journeyToValidate.startTime).toLocaleDateString('pt-BR')}
                  </p>
                  <div className="space-y-2">
                    {excedente > 0 && (
                      <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                        <Clock size={16} className="text-amber-600 shrink-0" />
                        <span className="text-sm font-bold text-amber-800 dark:text-amber-400">
                          Validar {exH}h {exM.toString().padStart(2, '0')}min de horas excedentes?
                        </span>
                      </div>
                    )}
                    {isRetro && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl">
                        <Calendar size={16} className="text-blue-600 shrink-0" />
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-400">
                          Validar data retroativa ({new Date(journeyToValidate.startTime).toLocaleDateString('pt-BR')})?
                        </span>
                      </div>
                    )}
                    {excedente === 0 && !isRetro && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <CheckCircle2 size={16} className="text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">Confirmar validação desta jornada</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { setIsValidationConfirmModalOpen(false); setJourneyToValidate(null); }}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        const j = journeyToValidate;
                        setIsValidationConfirmModalOpen(false);
                        setJourneyToValidate(null);
                        handleValidateJourney(j);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Delete Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Excluir Jornada?</h3>
                {journeyToDelete && (
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
                    {vehicles.find(v => v.id === journeyToDelete.vehicleId)?.plate} • {new Date(journeyToDelete.startTime).toLocaleDateString('pt-BR')}
                  </p>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Esta ação não pode ser desfeita.</p>
                
                {(associatedRecords.refuelings > 0 || associatedRecords.maintenances > 0 || associatedRecords.maintenanceRequests > 0) && (
                  <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl text-left">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase mb-2 flex items-center gap-2">
                      <Info size={14} />
                      Registros Vinculados
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-500 leading-relaxed">
                      Ao excluir esta jornada, os seguintes registros realizados durante o período também serão excluídos:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {associatedRecords.refuelings > 0 && (
                        <li className="text-sm text-amber-700 dark:text-amber-500 flex items-center gap-2">
                          <Droplets size={14} className="text-blue-500" />
                          {associatedRecords.refuelings} {associatedRecords.refuelings === 1 ? 'Abastecimento' : 'Abastecimentos'}
                        </li>
                      )}
                      {associatedRecords.maintenances > 0 && (
                        <li className="text-sm text-amber-700 dark:text-amber-500 flex items-center gap-2">
                          <WrenchIcon size={14} className="text-amber-600" />
                          {associatedRecords.maintenances} {associatedRecords.maintenances === 1 ? 'Manutenção Executada' : 'Manutenções Executadas'}
                        </li>
                      )}
                      {associatedRecords.maintenanceRequests > 0 && (
                        <li className="text-sm text-amber-700 dark:text-amber-500 flex items-center gap-2">
                          <ClipboardList size={14} className="text-purple-500" />
                          {associatedRecords.maintenanceRequests} {associatedRecords.maintenanceRequests === 1 ? 'Pedido de Manutenção' : 'Pedidos de Manutenção'}
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setAssociatedRecords({ refuelings: 0, maintenances: 0, maintenanceRequests: 0 });
                    }} 
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDeleteJourney} 
                    disabled={loading || isCheckingAssociated}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Excluir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Erro de Odômetro/Horímetro (Admin) */}
        {isOdometerErrorModalOpen && (() => {
          const modalVehicle = vehicles.find(v => v.id === formData.vehicleId);
          const isMaquinaModal = modalVehicle?.vehicle_type === 'maquina';
          const medidorNomeModal = isMaquinaModal ? 'Horímetro' : 'Quilometragem';
          const unidadeModal = isMaquinaModal ? 'h' : 'KM';
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full">
                    <Zap className="text-amber-600 w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Erro de {medidorNomeModal}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      O {medidorNomeModal.toLowerCase()} inicial ({formData.startOdometer} {unidadeModal}) deve ser maior ou igual ao {medidorNomeModal.toLowerCase()} atual do veículo ({lastOdometerValue} {unidadeModal}).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Último {medidorNomeModal}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{lastOdometerValue} {unidadeModal}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 border border-red-100 dark:border-red-900/20 text-center">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Valor Digitado</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{formData.startOdometer} {unidadeModal}</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs text-amber-800 dark:text-amber-400 text-center font-medium">
                    Por favor, verifique o painel do {isMaquinaModal ? 'equipamento' : 'veículo'} e corrija o {medidorNomeModal.toLowerCase()} para prosseguir.
                  </p>
                </div>

                <button
                  onClick={() => setIsOdometerErrorModalOpen(false)}
                  className="w-full h-14 bg-primary text-white rounded-2xl font-bold uppercase tracking-wider shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all"
                >
                  Corrigir {medidorNomeModal}
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Fueling Details Modal */}
        {isFuelingModalOpen && selectedVehicleForDetails && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-50 dark:bg-amber-900/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                      <Droplets size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Abastecimentos</h3>
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                        {selectedVehicleForDetails.plate} - {selectedVehicleForDetails.model}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIsFuelingModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-4 bg-amber-50/50 dark:bg-amber-900/5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Início</label>
                      <input 
                        type="date" 
                        className="input-field h-10 text-sm" 
                        value={modalStartDate}
                        onChange={(e) => setModalStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fim</label>
                      <input 
                        type="date" 
                        className="input-field h-10 text-sm" 
                        value={modalEndDate}
                        onChange={(e) => setModalEndDate(e.target.value)}
                      />
                    </div>
                    <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
                      {vehicleFuelings.length} Registros
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {vehicleFuelings.length > 0 ? (
                    <div className="space-y-3">
                      {vehicleFuelings.map((r) => (
                        <div key={r.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <p className="text-xs font-bold text-slate-400 uppercase">{new Date(r.date).toLocaleDateString('pt-BR', { month: 'short' })}</p>
                              <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{new Date(r.date).getDate()}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                            <div>
                              <p className="text-sm font-bold dark:text-white">{r.fuelType}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-slate-500">{r.odometer.toLocaleString()} KM</p>
                                {r.location && (
                                  <>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <p className="text-[10px] font-bold text-amber-600 uppercase">{r.location}</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-primary leading-none">{r.quantity}L</p>
                            {r.averageConsumption > 0 && (
                              <p className="text-[10px] font-bold text-green-600 uppercase mt-1">
                                {r.averageConsumption.toFixed(1).replace('.', ',')} km/L
                              </p>
                            )}
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Quantidade</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Droplets size={24} />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum abastecimento encontrado no período.</p>
                    </div>
                  )}
                </div>
                
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-start gap-3">
                  <button 
                    onClick={() => setIsFuelingModalOpen(false)} 
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
          </div>
        )}

        {/* Maintenance Details Modal */}
        {isMaintenanceModalOpen && selectedVehicleForDetails && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-purple-50 dark:bg-purple-900/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                      <WrenchIcon size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Manutenções</h3>
                      <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                        {selectedVehicleForDetails.plate} - {selectedVehicleForDetails.model}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIsMaintenanceModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-4 bg-purple-50/50 dark:bg-purple-900/5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Início</label>
                      <input 
                        type="date" 
                        className="input-field h-10 text-sm" 
                        value={modalStartDate}
                        onChange={(e) => setModalStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fim</label>
                      <input 
                        type="date" 
                        className="input-field h-10 text-sm" 
                        value={modalEndDate}
                        onChange={(e) => setModalEndDate(e.target.value)}
                      />
                    </div>
                    <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
                      {vehicleMaintenances.length} Registros
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {vehicleMaintenances.length > 0 ? (
                    <div className="space-y-4">
                      {vehicleMaintenances.map((m) => (
                        <div key={m.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                          <div className="flex items-center justify-between mb-3">
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
                          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 flex gap-2">
                            <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed">
                              {m.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                        <WrenchIcon size={24} />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma manutenção encontrada no período.</p>
                    </div>
                  )}
                </div>
                
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-start gap-3">
                  <button 
                    onClick={() => setIsMaintenanceModalOpen(false)} 
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
          </div>
        )}
      </main>
    </div>
  );
}
