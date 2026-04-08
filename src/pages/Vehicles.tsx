import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Search, Filter, ChevronRight, LayoutGrid, List as ListIcon, MoreVertical, Plus, X, Edit2, Trash2, AlertTriangle, History, Calendar, ArrowRight, Clock, MapPin, Droplets, Wrench as WrenchIcon, Info, Download, Loader2, Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { cn } from '../utils';
import { User as UserType, Journey, Vehicle, RefuelingRecord, MaintenanceRecord } from '../types';
import { supabase } from '../lib/supabase';

export default function Vehicles() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [vehicleData, setVehicleData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // CRUD States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteErrorModalOpen, setIsDeleteErrorModalOpen] = useState(false);
  const [deleteErrorReasons, setDeleteErrorReasons] = useState<string[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [selectedVehicleForHistory, setSelectedVehicleForHistory] = useState<any | null>(null);
  const [isFuelingModalOpen, setIsFuelingModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [vehicleFuelings, setVehicleFuelings] = useState<any[]>([]);
  const [vehicleMaintenances, setVehicleMaintenances] = useState<any[]>([]);
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState<Vehicle | null>(null);
  const [modalStartDate, setModalStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [modalEndDate, setModalEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyStartDate, setHistoryStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [historyEndDate, setHistoryEndDate] = useState(new Date().toISOString().split('T')[0]);

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
  
  const [filteredJourneys, setFilteredJourneys] = useState<Journey[]>([]);
  const [formData, setFormData] = useState({
    plate: '',
    model: '',
    prefix: '',
    lastOdometer: 0,
    vehicle_type: 'veiculo' as 'veiculo' | 'maquina',
    initial_odometer: 0,
    initial_hourmeter: 0
  });

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (!userJson) {
      navigate('/login');
      return;
    }
    setCurrentUser(JSON.parse(userJson));
    loadVehicles();
  }, [navigate]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      // Load vehicles from Supabase
      const { data: baseVehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate');

      if (vehicleError) throw vehicleError;

      // Load journeys to find last odometer
      const { data: allJourneys, error: journeyError } = await supabase
        .from('journeys')
        .select('*')
        .eq('status', 'encerrada')
        .order('end_time', { ascending: false });

      if (journeyError) throw journeyError;
      
      const enrichedVehicles = (baseVehicles || []).map(vehicle => {
        // Find the latest closed journey for this vehicle
        const lastJourney = allJourneys?.find(j => j.vehicle_id === vehicle.id);
        
        // Use the latest odometer/hourmeter from journeys if available, otherwise use the one from the vehicle table
        const currentKm = vehicle.vehicle_type === 'maquina' 
          ? (lastJourney?.end_odometer || vehicle.current_hourmeter || vehicle.last_odometer || 0)
          : (lastJourney?.end_odometer || vehicle.current_odometer || vehicle.last_odometer || 0);

        return {
          ...vehicle,
          lastOdometer: vehicle.last_odometer || 0,
          vehicle_type: vehicle.vehicle_type || 'veiculo',
          initial_odometer: vehicle.initial_odometer || 0,
          current_odometer: vehicle.current_odometer || 0,
          initial_hourmeter: vehicle.initial_hourmeter || 0,
          current_hourmeter: vehicle.current_hourmeter || 0,
          currentKm,
          lastUpdate: lastJourney?.end_time ? new Date(lastJourney.end_time).toLocaleDateString('pt-BR') : 'Sem registros'
        };
      });

      setVehicleData(enrichedVehicles);
    } catch (err) {
      console.error('Error loading vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (vehicle: Vehicle | null = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        plate: vehicle.plate,
        model: vehicle.model,
        prefix: vehicle.prefix,
        lastOdometer: vehicle.lastOdometer,
        vehicle_type: vehicle.vehicle_type || 'veiculo',
        initial_odometer: vehicle.initial_odometer || 0,
        initial_hourmeter: vehicle.initial_hourmeter || 0
      });
    } else {
      setEditingVehicle(null);
      setFormData({
        plate: '',
        model: '',
        prefix: '',
        lastOdometer: 0,
        vehicle_type: 'veiculo',
        initial_odometer: 0,
        initial_hourmeter: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const vehiclePayload: any = {
        plate: formData.vehicle_type === 'maquina' ? `MAQ-${formData.prefix}` : formData.plate,
        model: formData.model,
        prefix: formData.prefix,
        vehicle_type: formData.vehicle_type,
        initial_odometer: formData.initial_odometer,
        initial_hourmeter: formData.initial_hourmeter,
      };

      if (!editingVehicle) {
        // On creation, set current values to initial values
        vehiclePayload.current_odometer = formData.initial_odometer;
        vehiclePayload.current_hourmeter = formData.initial_hourmeter;
        vehiclePayload.last_odometer = formData.initial_odometer;
      }

      if (editingVehicle) {
        // Update
        const { error } = await supabase
          .from('vehicles')
          .update(vehiclePayload)
          .eq('id', editingVehicle.id);
        
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('vehicles')
          .insert([vehiclePayload]);
        
        if (error) throw error;
      }

      setIsModalOpen(false);
      loadVehicles();
    } catch (err) {
      console.error('Error saving vehicle:', err);
      alert('Erro ao salvar veículo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    setLoading(true);
    setDeleteErrorReasons([]);

    try {
      const reasons: string[] = [];

      // Check Journeys
      const { count: journeyCount, error: journeyError } = await supabase
        .from('journeys')
        .select('*', { count: 'exact', head: true })
        .eq('vehicle_id', vehicleToDelete.id);
      
      if (journeyError) throw journeyError;
      if (journeyCount && journeyCount > 0) {
        reasons.push('Existem jornadas vinculadas a este veículo.');
      }

      // Check Maintenances (Executada/Pendente)
      const { data: maintenances, error: maintenanceError } = await supabase
        .from('maintenances')
        .select('status')
        .eq('vehicle_id', vehicleToDelete.id);
      
      if (maintenanceError) throw maintenanceError;
      if (maintenances && maintenances.length > 0) {
        const hasExecuted = maintenances.some(m => m.status === 'executada');
        const hasPending = maintenances.some(m => m.status === 'pendente');
        if (hasExecuted) reasons.push('Existem manutenções executadas vinculadas a este veículo.');
        if (hasPending) reasons.push('Existem manutenções pendentes vinculadas a este veículo.');
      }

      // Check Maintenance Requests (Pendente/Aprovada)
      const { data: requests, error: requestError } = await supabase
        .from('maintenance_requests')
        .select('status')
        .eq('vehicle_id', vehicleToDelete.id);
      
      if (requestError) throw requestError;
      if (requests && requests.length > 0) {
        const hasPendingReq = requests.some(r => r.status === 'pendente');
        const hasApprovedReq = requests.some(r => r.status === 'aprovada');
        if (hasPendingReq) reasons.push('Existem solicitações de manutenção pendentes para este veículo.');
        if (hasApprovedReq) reasons.push('Existem solicitações de manutenção autorizadas para este veículo.');
      }

      if (reasons.length > 0) {
        setDeleteErrorReasons(reasons);
        setIsDeleteErrorModalOpen(true);
        setIsDeleteModalOpen(false);
        return;
      }

      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleToDelete.id);

      if (error) throw error;
      
      setIsDeleteModalOpen(false);
      setVehicleToDelete(null);
      loadVehicles();
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      alert('Erro ao excluir veículo.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHistory = (vehicle: any) => {
    setSelectedVehicleForHistory(vehicle);
    setIsHistoryModalOpen(true);
    loadVehicleHistory(vehicle.id, historyStartDate, historyEndDate);
  };

  const handleViewFuelings = (vehicle: Vehicle) => {
    setSelectedVehicleForDetails(vehicle);
    setIsFuelingModalOpen(true);
  };

  const handleViewMaintenances = (vehicle: Vehicle) => {
    setSelectedVehicleForDetails(vehicle);
    setIsMaintenanceModalOpen(true);
  };

  useEffect(() => {
    const fetchFuelings = async () => {
      if (isFuelingModalOpen && selectedVehicleForDetails) {
        const { data: allRefuelings, error } = await supabase
          .from('refuelings')
          .select('*')
          .eq('vehicle_id', selectedVehicleForDetails.id)
          .gte('date', modalStartDate || '1900-01-01')
          .lte('date', modalEndDate || '2100-12-31')
          .order('date', { ascending: true });

        if (error) {
          console.error('Error fetching fuelings:', error);
          return;
        }

        const enrichedFuelings = (allRefuelings || []).map((r, index) => {
          const prevRef = index > 0 ? allRefuelings[index - 1] : null;
          
          let averageConsumption = 0;
          if (prevRef && r.quantity > 0) {
            averageConsumption = (r.odometer - prevRef.odometer) / r.quantity;
          }
          
          return { 
            ...r, 
            fuelType: r.fuel_type, // compatibility
            averageConsumption 
          };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setVehicleFuelings(enrichedFuelings);
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
          .gte('date', modalStartDate || '1900-01-01')
          .lte('date', modalEndDate || '2100-12-31')
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching maintenances:', error);
          return;
        }

        setVehicleMaintenances(allMaintenances || []);
      }
    };
    fetchMaintenances();
  }, [isMaintenanceModalOpen, selectedVehicleForDetails, modalStartDate, modalEndDate]);

  const loadVehicleHistory = async (vehicleId: string, start: string, end: string) => {
    const { data: journeys, error } = await supabase
      .from('journeys')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .gte('start_time', `${start}T00:00:00`)
      .lte('start_time', `${end}T23:59:59`)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error loading history:', error);
      return;
    }

    const enrichedJourneys = (journeys || []).map(j => ({
      ...j,
      userId: j.user_id,
      vehicleId: j.vehicle_id,
      startTime: j.start_time,
      endTime: j.end_time,
      startOdometer: j.start_odometer,
      endOdometer: j.end_odometer,
      distanceTraveled: j.distance_traveled
    }));

    setFilteredJourneys(enrichedJourneys);
  };

  useEffect(() => {
    if (selectedVehicleForHistory && isHistoryModalOpen) {
      loadVehicleHistory(selectedVehicleForHistory.id, historyStartDate, historyEndDate);
    }
  }, [historyStartDate, historyEndDate, selectedVehicleForHistory, isHistoryModalOpen]);

  const filteredVehicles = vehicleData.filter(v => 
    v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.prefix.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <h2 className="text-base md:text-lg font-bold dark:text-white">Frota de Veículos</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'grid' ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewMode === 'list' ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <ListIcon size={18} />
              </button>
            </div>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Novo Veículo</span>
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
                placeholder="Buscar por placa, modelo ou prefixo..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Filter size={18} />
                <span>Filtros</span>
              </button>
              <div className="text-sm text-slate-500 font-medium">
                {filteredVehicles.length} veículos encontrados
              </div>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="card overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Veículo</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Placa</th>
                    <th className="px-6 py-4">Prefixo</th>
                    <th className="px-6 py-4">Status Atual</th>
                    <th className="px-6 py-4">Última Atividade</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            {vehicle.vehicle_type === 'maquina' ? <Clock size={20} /> : <Truck size={20} />}
                          </div>
                          <div>
                            <p className="font-bold dark:text-white">{vehicle.model}</p>
                            <p className="text-xs text-slate-500">ID: {vehicle.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                          vehicle.vehicle_type === 'maquina' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        )}>
                          {vehicle.vehicle_type === 'maquina' ? 'Máquina' : 'Veículo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs font-bold dark:text-slate-300 uppercase tracking-wider">
                          {vehicle.plate}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium dark:text-slate-300">
                        {vehicle.prefix}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold dark:text-white">
                            {vehicle.vehicle_type === 'maquina' 
                              ? `${(vehicle.currentKm || 0).toLocaleString('pt-BR')} h`
                              : `${(vehicle.currentKm || 0).toLocaleString('pt-BR')} km`
                            }
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">
                            {vehicle.vehicle_type === 'maquina' ? 'Horímetro (Última Jornada)' : 'Odômetro (Última Jornada)'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {vehicle.lastUpdate}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenHistory(vehicle)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                            title="Ver Jornadas"
                          >
                            <History size={18} />
                          </button>
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
                          <button 
                            onClick={() => handleOpenModal(vehicle)}
                            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setVehicleToDelete(vehicle);
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredVehicles.map((vehicle) => (
                <div key={vehicle.id} className="card p-6 hover:shadow-xl transition-all group border-t-4 border-t-transparent hover:border-t-primary">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-primary group-hover:text-white transition-all">
                      {vehicle.vehicle_type === 'maquina' ? <Clock size={24} /> : <Truck size={24} />}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold dark:text-slate-300 uppercase tracking-widest">
                        {vehicle.plate}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                        vehicle.vehicle_type === 'maquina' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      )}>
                        {vehicle.vehicle_type === 'maquina' ? 'Máquina' : 'Veículo'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1 mb-6">
                    <h3 className="text-lg font-bold dark:text-white">{vehicle.model}</h3>
                    <p className="text-sm text-slate-500">Frota: <span className="font-bold text-slate-700 dark:text-slate-300">{vehicle.prefix}</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-6">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                        {vehicle.vehicle_type === 'maquina' ? 'Horímetro (Jornada)' : 'Odômetro (Jornada)'}
                      </p>
                      <p className="text-sm font-bold dark:text-white">
                        {vehicle.vehicle_type === 'maquina' 
                          ? `${(vehicle.currentKm || 0).toLocaleString('pt-BR')} h`
                          : `${(vehicle.currentKm || 0).toLocaleString('pt-BR')} km`
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Atualização</p>
                      <p className="text-sm font-bold dark:text-white">{vehicle.lastUpdate}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button 
                      onClick={() => handleOpenHistory(vehicle)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                      title="Jornadas"
                    >
                      <History size={16} />
                    </button>
                    <button 
                      onClick={() => handleViewFuelings(vehicle)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all"
                      title="Abastecimentos"
                    >
                      <Droplets size={16} />
                    </button>
                    <button 
                      onClick={() => handleViewMaintenances(vehicle)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                      title="Manutenções"
                    >
                      <WrenchIcon size={16} />
                    </button>
                    <button 
                      onClick={() => handleOpenModal(vehicle)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                    >
                      <Edit2 size={16} />
                      <span>Editar</span>
                    </button>
                    <button 
                      onClick={() => {
                        setVehicleToDelete(vehicle);
                        setIsDeleteModalOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <Trash2 size={16} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create/Edit Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
                  </h3>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <form onSubmit={handleSaveVehicle} className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tipo de Veículo</label>
                    <select 
                      required
                      className="input-field"
                      value={formData.vehicle_type}
                      onChange={(e) => setFormData({...formData, vehicle_type: e.target.value as 'veiculo' | 'maquina'})}
                    >
                      <option value="veiculo">Veículo (KM)</option>
                      <option value="maquina">Máquina (Horas)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Modelo</label>
                    <input 
                      required
                      className="input-field"
                      placeholder="Ex: Toyota Hilux"
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Placa</label>
                      <input 
                        required={formData.vehicle_type === 'veiculo'}
                        disabled={formData.vehicle_type === 'maquina'}
                        className={cn(
                          "input-field uppercase",
                          formData.vehicle_type === 'maquina' && "bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                        )}
                        placeholder={formData.vehicle_type === 'maquina' ? "N/A" : "ABC-1234"}
                        value={formData.vehicle_type === 'maquina' ? '' : formData.plate}
                        onChange={(e) => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Prefixo</label>
                      <input 
                        required
                        className="input-field uppercase"
                        placeholder="FT-001"
                        value={formData.prefix}
                        onChange={(e) => setFormData({...formData, prefix: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                  
                  {formData.vehicle_type === 'veiculo' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Odômetro Inicial (KM)</label>
                      <input 
                        required
                        type="number"
                        className="input-field"
                        placeholder="0"
                        value={formData.initial_odometer}
                        onChange={(e) => setFormData({...formData, initial_odometer: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Horímetro Inicial (Horas)</label>
                      <input 
                        required
                        type="number"
                        className="input-field"
                        placeholder="0"
                        value={formData.initial_hourmeter}
                        onChange={(e) => setFormData({...formData, initial_hourmeter: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20"
                    >
                      {editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {isDeleteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Excluir Veículo?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Tem certeza que deseja excluir o veículo <span className="font-bold text-slate-700 dark:text-slate-200">{vehicleToDelete?.model} ({vehicleToDelete?.plate})</span>? Esta ação não pode ser desfeita.
                  </p>
                  
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleDeleteVehicle}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Error Modal */}
          {isDeleteErrorModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Não é possível excluir</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    O veículo <span className="font-bold text-slate-700 dark:text-slate-200">{vehicleToDelete?.model} ({vehicleToDelete?.plate})</span> possui registros vinculados e não pode ser removido.
                  </p>
                  
                  <div className="space-y-2 mb-6 text-left">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Motivos:</label>
                    <select className="input-field bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
                      {deleteErrorReasons.map((reason, idx) => (
                        <option key={idx}>{reason}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setIsDeleteErrorModalOpen(false);
                      setVehicleToDelete(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History Modal */}
          {isHistoryModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <History size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">Histórico de Jornadas</h3>
                      <p className="text-xs text-slate-500 font-medium">{selectedVehicleForHistory?.model} • {selectedVehicleForHistory?.plate}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Data Inicial</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                          type="date"
                          className="input-field pl-10 h-10 text-sm"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Data Final</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                          type="date"
                          className="input-field pl-10 h-10 text-sm"
                          value={historyEndDate}
                          onChange={(e) => setHistoryEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500">
                      {filteredJourneys.length} Jornadas
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {filteredJourneys.length > 0 ? (
                    filteredJourneys.map((journey) => (
                      <div key={journey.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-primary/30 transition-all group">
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              <Clock size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-bold dark:text-white">
                                {new Date(journey.startTime).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                {new Date(journey.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} 
                                {journey.endTime && ` • ${new Date(journey.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest",
                            journey.status === 'ativa' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          )}>
                            {journey.status}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">
                              {selectedVehicleForHistory?.vehicle_type === 'maquina' ? 'Horímetro' : 'Quilometragem'}
                            </p>
                            <div className="flex items-center gap-2 text-sm font-bold dark:text-white">
                              <span>{journey.startOdometer.toLocaleString()}</span>
                              <ArrowRight size={14} className="text-slate-300" />
                              <span>{journey.endOdometer ? journey.endOdometer.toLocaleString() : '---'}</span>
                              <span className="text-xs font-medium text-slate-400 ml-1">
                                {journey.endOdometer ? `(${journey.endOdometer - journey.startOdometer} ${selectedVehicleForHistory?.vehicle_type === 'maquina' ? 'h' : 'km'})` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Motorista</p>
                            <p className="text-sm font-bold dark:text-white truncate">
                              {journey.driverName || 'Motorista'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 mb-4">
                        <History size={32} />
                      </div>
                      <h4 className="text-slate-900 dark:text-white font-bold">Nenhuma jornada encontrada</h4>
                      <p className="text-sm text-slate-500 max-w-xs mx-auto">Não há registros de jornadas para este veículo no período selecionado.</p>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                  <button 
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="px-6 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredVehicles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 mb-4">
                <Truck size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum veículo encontrado</h3>
              <p className="text-slate-500 max-w-xs mx-auto">Não encontramos nenhum veículo com os termos pesquisados. Tente novamente.</p>
            </div>
          )}
        </div>

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
                                <p className="text-xs text-slate-500">
                                  {r.odometer.toLocaleString()} {selectedVehicleForDetails.vehicle_type === 'maquina' ? 'h' : 'KM'}
                                </p>
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
                      <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum abastecimento encontrado.</p>
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
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {m.mileage.toLocaleString()} {selectedVehicleForDetails.vehicle_type === 'maquina' ? 'h' : 'KM'}
                              </p>
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
                      <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma manutenção encontrada.</p>
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
