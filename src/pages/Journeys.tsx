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
  Menu
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { cn } from '../utils';
import { User as UserType, Journey, Vehicle, RefuelingRecord, MaintenanceRecord } from '../types';
import { supabase } from '../lib/supabase';

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
  const [vehicleFuelings, setVehicleFuelings] = useState<RefuelingRecord[]>([]);
  const [vehicleMaintenances, setVehicleMaintenances] = useState<MaintenanceRecord[]>([]);
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOdometerErrorModalOpen, setIsOdometerErrorModalOpen] = useState(false);
  const [lastOdometerValue, setLastOdometerValue] = useState(0);

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
  
  const [formData, setFormData] = useState({
    userId: '',
    vehicleId: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    startOdometer: 0,
    endOdometer: 0,
    status: 'encerrada' as 'aberta' | 'encerrada',
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
      if (user.role !== 'Admin') {
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
        observations: j.observations
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
    } catch (err) {
      console.error('Error loading journeys data:', err);
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
        observations: journey.observations || ''
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
        observations: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Odometer validation for new journeys
    if (!editingJourney) {
      const vehicle = vehicles.find(v => v.id === formData.vehicleId);
      if (vehicle && Number(formData.startOdometer) < vehicle.lastOdometer) {
        setLastOdometerValue(vehicle.lastOdometer);
        setIsOdometerErrorModalOpen(true);
        return;
      }
    }

    setLoading(true);
    
    try {
      const startTimeStr = `${formData.startDate}T${formData.startTime}`;
      const endTimeStr = formData.endDate && formData.endTime ? `${formData.endDate}T${formData.endTime}` : null;
      
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
        observations: formData.observations
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
    } catch (err) {
      console.error('Error saving journey:', err);
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
          console.error('Error fetching fuelings:', error);
          return;
        }

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
          
          let averageConsumption = 0;
          if (prevRef && r.quantity > 0) {
            averageConsumption = (r.odometer - prevRef.odometer) / r.quantity;
          }
          
          return { ...r, averageConsumption };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setVehicleFuelings(filtered as any);
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
          console.error('Error fetching maintenances:', error);
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
      } catch (err) {
        console.error('Error fetching associated records:', err);
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
    } catch (err) {
      console.error('Error deleting journey:', err);
      alert('Erro ao excluir jornada.');
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
          <button 
            onClick={() => handleOpenModal()}
            className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Nova Jornada</span>
          </button>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
            <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto flex-1">
              <div className="flex flex-col gap-1.5 flex-1 md:max-w-xs">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Pesquisa Geral</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
                    placeholder="Placa, motorista ou ID..."
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
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
                  <th className="px-6 py-4">Status</th>
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
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                          journey.status === 'aberta' 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          {journey.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {editingJourney ? 'Editar Jornada' : 'Nova Jornada'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSaveJourney} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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
                    <input type="time" required className="input-field" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">KM Inicial</label>
                    <input type="number" required className="input-field" value={formData.startOdometer} onChange={(e) => setFormData({...formData, startOdometer: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Status</label>
                    <select className="input-field" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})}>
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
                        <input type="time" required className="input-field" value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} />
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

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{formData.startOdometer} KM</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <p className="text-xs text-amber-800 dark:text-amber-400 text-center font-medium">
                    Por favor, verifique o painel do veículo e corrija a quilometragem para prosseguir.
                  </p>
                </div>

                <button 
                  onClick={() => setIsOdometerErrorModalOpen(false)}
                  className="w-full h-14 bg-primary text-white rounded-2xl font-bold uppercase tracking-wider shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all"
                >
                  Corrigir Quilometragem
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fueling Details Modal */}
        {isFuelingModalOpen && selectedVehicleForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
              
              <div className="p-6 max-h-[60vh] overflow-y-auto">
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
                          {(r as any).averageConsumption > 0 && (
                            <p className="text-[10px] font-bold text-green-600 uppercase mt-1">
                              {(r as any).averageConsumption.toFixed(1).replace('.', ',')} km/L
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
        )}

        {/* Maintenance Details Modal */}
        {isMaintenanceModalOpen && selectedVehicleForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
              
              <div className="p-6 max-h-[60vh] overflow-y-auto">
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
        )}
      </main>
    </div>
  );
}
