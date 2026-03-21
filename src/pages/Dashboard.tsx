import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area 
} from 'recharts';
import { 
  Fuel, Settings, TrendingUp, TrendingDown, Search, Bell, 
  Download, Filter, ChevronRight, AlertCircle, X, Truck, Check, Loader2, Menu, Clock
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { cn } from '../utils';
import { User as UserType, Journey, RefuelingRecord, MaintenanceRecord, Vehicle } from '../types';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [startDate, setStartDate] = useState(() => {
    // Default to 12 months ago to show all seed data
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('all');
  const [selectedComparisonVehicleId, setSelectedComparisonVehicleId] = useState<string>('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'fuel' | 'maintenance'>('fuel');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    fuelTotal: 0,
    maintenanceTotal: 0,
    fuelPrev: 0,
    maintenancePrev: 0,
    fuelTotalLiters: 0,
    fuelPrevLiters: 0,
    fuelByType: {} as Record<string, number>,
    spendingData: [] as any[],
    participationData: [] as any[],
    comparisonData: [] as any[],
    vehicleSpendingData: [] as any[],
    recentActivities: [] as any[],
    maintenanceAlerts: [] as any[]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch all data from Supabase
      const { data: allRefuelings, error: refError } = await supabase
        .from('refuelings')
        .select('*');
      
      const { data: allMaintenances, error: mainError } = await supabase
        .from('maintenances')
        .select('*');

      const { data: allRequests, error: reqError } = await supabase
        .from('maintenance_requests')
        .select('*');

      if (refError) throw refError;
      if (mainError) throw mainError;
      if (reqError) throw reqError;

      // Normalize data (Supabase uses snake_case, existing code uses camelCase)
      const normalizedRefuelings = (allRefuelings || []).map(r => ({
        ...r,
        vehicleId: r.vehicle_id,
        fuelType: r.fuel_type,
        totalValue: r.total_value
      }));

      const normalizedMaintenances = (allMaintenances || []).map(m => ({
        ...m,
        vehicleId: m.vehicle_id,
        totalValue: m.total_value
      }));

      const normalizedRequests = (allRequests || []).map(r => ({
        ...r,
        vehicleId: r.vehicle_id,
        budgetValue: r.budget_value
      }));

      // Calculate Maintenance Alerts
      const today = new Date().toISOString().split('T')[0];
      const alerts = [];

      // 1. Pending Requests
      const pendingRequests = normalizedRequests.filter(r => r.status === 'pendente');
      pendingRequests.forEach(r => {
        alerts.push({
          id: r.id,
          type: 'request',
          title: 'Solicitação Pendente',
          vehicle: vehicles.find(v => v.id === r.vehicleId)?.plate || '---',
          date: r.date,
          description: r.description,
          severity: 'info'
        });
      });

      // 2. Authorized but not Executed Maintenances
      const authorizedMaintenances = normalizedMaintenances.filter(m => m.status === 'pendente');
      authorizedMaintenances.forEach(m => {
        alerts.push({
          id: m.id,
          type: 'authorized',
          title: 'Manutenção Autorizada',
          vehicle: vehicles.find(v => v.id === m.vehicleId)?.plate || '---',
          date: m.date,
          description: m.description,
          severity: 'warning'
        });
      });

      // Filter data by date and vehicle
      const filteredRefuelings = normalizedRefuelings.filter(r => {
        const rDate = r.date.split('T')[0];
        const dateMatch = rDate >= startDate && rDate <= endDate;
        const vehicleMatch = selectedVehicleId === 'all' || r.vehicleId === selectedVehicleId;
        return dateMatch && vehicleMatch;
      });

      const filteredMaintenances = normalizedMaintenances.filter(m => {
        const mDate = m.date.split('T')[0];
        const dateMatch = mDate >= startDate && mDate <= endDate;
        const vehicleMatch = selectedVehicleId === 'all' || m.vehicleId === selectedVehicleId;
        return dateMatch && vehicleMatch;
      });

      // Previous period for comparison (same duration)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const duration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration - 1);
      const prevEnd = new Date(start.getTime() - 1);
      const prevStartStr = prevStart.toISOString().split('T')[0];
      const prevEndStr = prevEnd.toISOString().split('T')[0];

      const prevRefuelings = normalizedRefuelings.filter(r => {
        const dateMatch = r.date >= prevStartStr && r.date <= prevEndStr;
        const vehicleMatch = selectedVehicleId === 'all' || r.vehicleId === selectedVehicleId;
        return dateMatch && vehicleMatch;
      });

      const prevMaintenances = normalizedMaintenances.filter(m => {
        const dateMatch = m.date >= prevStartStr && m.date <= prevEndStr;
        const vehicleMatch = selectedVehicleId === 'all' || m.vehicleId === selectedVehicleId;
        return dateMatch && vehicleMatch;
      });

      // Process Spending Data (Last 12 months)
      const monthsNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
      const now = new Date();
      const last12Months = [];
      
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        last12Months.push({ 
          name: monthsNames[m], 
          monthIndex: m, 
          year: y,
          fuel: 0, 
          maintenance: 0 
        });
      }

      normalizedRefuelings.forEach(r => {
        if (selectedVehicleId !== 'all' && r.vehicleId !== selectedVehicleId) return;
        const dateParts = r.date.split('-');
        if (dateParts.length < 2) return;
        const y = parseInt(dateParts[0], 10);
        const m = parseInt(dateParts[1], 10) - 1;
        
        const monthData = last12Months.find(lm => lm.monthIndex === m && lm.year === y);
        if (monthData) {
          const value = r.totalValue || (r.quantity * (r.fuelType === 'Diesel' ? 6.20 : 5.80));
          monthData.fuel += value;
        }
      });

      normalizedMaintenances.forEach(m => {
        if (selectedVehicleId !== 'all' && m.vehicleId !== selectedVehicleId) return;
        const dateParts = m.date.split('-');
        if (dateParts.length < 2) return;
        const y = parseInt(dateParts[0], 10);
        const monthIndex = parseInt(dateParts[1], 10) - 1;
        
        const monthData = last12Months.find(lm => lm.monthIndex === monthIndex && lm.year === y);
        if (monthData) {
          monthData.maintenance += m.totalValue || 1200; 
        }
      });

      // Stats for selected period
      const fuelTotal = filteredRefuelings.reduce((acc, r) => acc + (r.totalValue || (r.quantity * (r.fuelType === 'Diesel' ? 6.20 : 5.80))), 0);
      const fuelPrev = prevRefuelings.reduce((acc, r) => acc + (r.totalValue || (r.quantity * (r.fuelType === 'Diesel' ? 6.20 : 5.80))), 0);
      
      const fuelTotalLiters = filteredRefuelings.reduce((acc, r) => acc + (r.quantity || 0), 0);
      const fuelPrevLiters = prevRefuelings.reduce((acc, r) => acc + (r.quantity || 0), 0);

      const fuelByType = filteredRefuelings.reduce((acc, r) => {
        const type = r.fuelType || 'Outro';
        acc[type] = (acc[type] || 0) + (r.quantity || 0);
        return acc;
      }, {} as Record<string, number>);

      const maintenanceTotal = filteredMaintenances.reduce((acc, m) => acc + (m.totalValue || 1200), 0);
      const maintenancePrev = prevMaintenances.reduce((acc, m) => acc + (m.totalValue || 1200), 0);

      // Participation Data
      const vehicleSpending = vehicles.map((v: Vehicle) => {
        let fuel = 0;
        let fuelQuantity = 0;
        let maintenance = 0;
        normalizedRefuelings.filter(r => r.vehicleId === v.id).forEach(r => {
          if (r.date >= startDate && r.date <= endDate) {
            fuel += r.totalValue || (r.quantity * (r.fuelType === 'Diesel' ? 6.20 : 5.80));
            fuelQuantity += r.quantity || 0;
          }
        });
        normalizedMaintenances.filter(m => m.vehicleId === v.id).forEach(m => {
          if (m.date >= startDate && m.date <= endDate) {
            maintenance += m.totalValue || 1200;
          }
        });
        return { 
          id: v.id, 
          name: v.plate, 
          fuel, 
          fuelQuantity,
          maintenance, 
          total: fuel + maintenance 
        };
      }).sort((a, b) => b.total - a.total);

      // Participation Data (Fleet vs Selected)
      const totalFleetSpending = vehicleSpending.reduce((acc, curr) => acc + curr.total, 0);
      const selectedVehicleSpending = vehicleSpending.find(v => v.id === selectedVehicleId)?.total || 0;
      const selectedVehicleName = vehicles.find(v => v.id === selectedVehicleId)?.plate || 'Veículo Selecionado';

      const participationData = [
        { 
          name: selectedVehicleId === 'all' ? 'Frota Total' : selectedVehicleName, 
          value: selectedVehicleId === 'all' ? totalFleetSpending : selectedVehicleSpending, 
          color: '#1152d4' 
        },
        { 
          name: 'Restante da Frota', 
          value: selectedVehicleId === 'all' ? 0 : Math.max(0, totalFleetSpending - selectedVehicleSpending), 
          color: '#334155' 
        },
      ];

      // Comparison Data (Selected vs Comparison)
      const comparisonVehicle = vehicleSpending.find(v => v.id === selectedComparisonVehicleId) || { name: 'Selecione', total: 0 };
      const comparisonData = [
        { 
          name: selectedVehicleId === 'all' ? 'Frota (Média/Total)' : selectedVehicleName, 
          value: selectedVehicleId === 'all' ? totalFleetSpending : selectedVehicleSpending, 
          color: '#1152d4' 
        },
        { 
          name: comparisonVehicle.name === 'Selecione' ? 'Comparação' : comparisonVehicle.name, 
          value: comparisonVehicle.total, 
          color: '#f59e0b' 
        },
      ];

      // Recent Activities (filtered)
      const recentRefuelings = filteredRefuelings.map(r => {
        // Calculate average consumption for this record
        const vehicleRefuelings = normalizedRefuelings
          .filter(ref => ref.vehicleId === r.vehicleId)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const currentIndex = vehicleRefuelings.findIndex(ref => ref.id === r.id);
        const prevRef = currentIndex > 0 ? vehicleRefuelings[currentIndex - 1] : null;
        
        let avgCons = 0;
        if (prevRef && r.quantity > 0) {
          avgCons = (r.odometer - prevRef.odometer) / r.quantity;
        }

        return {
          type: 'fuel',
          label: 'Abastecimento',
          vehicle: vehicles.find(v => v.id === r.vehicleId)?.model || 'Veículo',
          plate: vehicles.find(v => v.id === r.vehicleId)?.plate || '---',
          date: new Date(r.date).toLocaleDateString('pt-BR'),
          time: '---',
          detail: `${r.quantity}L de ${r.fuelType}${r.location ? ` • ${r.location}` : ''}${avgCons > 0 ? ` • ${avgCons.toFixed(1)} km/L` : ''}`,
          value: r.totalValue || (r.quantity * (r.fuelType === 'Diesel' ? 6.20 : 5.80)),
          color: 'text-green-600',
          bg: 'bg-green-100 dark:bg-green-900/30',
          timestamp: new Date(r.date + 'T12:00:00').getTime()
        };
      });

      const recentMaintenances = filteredMaintenances.map(m => ({
        type: 'maintenance',
        label: m.type,
        vehicle: vehicles.find(v => v.id === m.vehicleId)?.model || 'Veículo',
        plate: vehicles.find(v => v.id === m.vehicleId)?.plate || '---',
        date: new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR'),
        time: '---',
        detail: m.provider,
        value: m.totalValue || 1200,
        color: 'text-orange-600',
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        timestamp: new Date(m.date + 'T12:00:00').getTime()
      }));

      const recentActivities = [...recentRefuelings, ...recentMaintenances]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

      setStats({
        fuelTotal,
        maintenanceTotal,
        fuelPrev,
        maintenancePrev,
        fuelTotalLiters,
        fuelPrevLiters,
        fuelByType,
        spendingData: last12Months,
        participationData,
        comparisonData,
        vehicleSpendingData: vehicleSpending.slice(0, 5),
        recentActivities,
        maintenanceAlerts: alerts
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initDashboard = async () => {
      const userJson = localStorage.getItem('fleet_user');
      if (!userJson) {
        navigate('/login');
        return;
      }

      const user = JSON.parse(userJson) as UserType;
      if (user.role === 'Motorista') {
        navigate('/daily-report');
        return;
      }
      
      setCurrentUser(user);

      // Load vehicles from Supabase
      const { data: currentVehicles, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate');

      if (error) {
        console.error('Error loading vehicles:', error);
        return;
      }

      setVehicles(currentVehicles || []);
      if (currentVehicles && currentVehicles.length > 0) {
        if (!selectedComparisonVehicleId) {
          // Set a default comparison vehicle that is different from the first one if possible
          const firstId = currentVehicles[0].id;
          const secondId = currentVehicles.length > 1 ? currentVehicles[1].id : firstId;
          setSelectedComparisonVehicleId(secondId);
        }
      }
    };
    initDashboard();
  }, [navigate]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, startDate, endDate, selectedVehicleId, selectedComparisonVehicleId, vehicles]);

  const handleUpdateDashboard = () => {
    loadData();
  };

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
            <div className="flex flex-col">
              <h2 className="text-base md:text-lg font-bold dark:text-white">Dashboard de Frota</h2>
              <span className="text-[10px] text-blue-500 font-mono select-all cursor-help" title="Seu ID de Usuário para o script SQL">
                ID: {currentUser?.id}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative max-w-xs hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary w-64 dark:text-white"
                placeholder="Buscar veículo ou placa..."
                type="text"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 relative">
                <Bell size={20} />
                {stats.maintenanceAlerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-background-dark">
                    {stats.maintenanceAlerts.length}
                  </span>
                )}
              </button>
              <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Settings size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-8">
          {/* Filters and Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-500">Veículo</label>
                  <button 
                    onClick={() => setIsSearchModalOpen(true)}
                    className="flex items-center justify-between w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 px-4 text-sm dark:text-slate-300 hover:border-primary transition-colors text-left"
                  >
                    <span className="truncate">
                      {selectedVehicleId === 'all' 
                        ? 'Todos os Veículos' 
                        : vehicles.find(v => v.id === selectedVehicleId)?.plate + ' (' + vehicles.find(v => v.id === selectedVehicleId)?.model + ')'}
                    </span>
                    <Search size={16} className="text-slate-400 ml-2 flex-shrink-0" />
                  </button>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-500">Período</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-2 text-xs dark:text-slate-300 outline-none"
                    />
                    <span className="text-slate-400">até</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-2 text-xs dark:text-slate-300 outline-none"
                    />
                  </div>
                </div>
              </div>
              <button 
                onClick={handleUpdateDashboard}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-amber-500/20"
              >
                <TrendingUp size={18} />
                <span>Atualizar Período</span>
              </button>
              <button className="flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-primary/20">
                <Download size={18} />
                <span>Exportar Relatório</span>
              </button>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {loading && (
                <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              )}
              <div className="card p-5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-slate-500">Combustível Total</span>
                  <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
                    <Fuel size={20} />
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Período Selecionado</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold dark:text-white">{stats.fuelTotalLiters.toLocaleString('pt-BR')} L</span>
                        <span className={cn(
                          "text-sm font-bold flex items-center",
                          stats.fuelTotalLiters >= stats.fuelPrevLiters ? "text-red-500" : "text-green-500"
                        )}>
                          {stats.fuelTotalLiters >= stats.fuelPrevLiters ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                          {stats.fuelPrevLiters > 0 ? (((stats.fuelTotalLiters - stats.fuelPrevLiters) / stats.fuelPrevLiters) * 100).toFixed(1) : '0'}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Período Anterior</p>
                      <span className="text-sm font-medium text-slate-500">{stats.fuelPrevLiters.toLocaleString('pt-BR')} L</span>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
                    {Object.entries(stats.fuelByType).map(([type, liters]) => (
                      <div key={type} className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold truncate">{type}</span>
                        <span className="text-xs font-bold dark:text-white">{new Intl.NumberFormat('pt-BR').format(liters as number)} L</span>
                      </div>
                    ))}
                    {Object.keys(stats.fuelByType).length === 0 && (
                      <span className="text-[10px] text-slate-400 italic col-span-3 text-center">Nenhum registro</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="card p-5 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-slate-500">Manutenção Total</span>
                  <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
                    <Settings size={20} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Período Selecionado</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold dark:text-white">R$ {stats.maintenanceTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <span className={cn(
                        "text-sm font-bold flex items-center",
                        stats.maintenanceTotal >= stats.maintenancePrev ? "text-red-500" : "text-green-500"
                      )}>
                        {stats.maintenanceTotal >= stats.maintenancePrev ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                        {stats.maintenancePrev > 0 ? (((stats.maintenanceTotal - stats.maintenancePrev) / stats.maintenancePrev) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-semibold">Período Anterior</p>
                    <span className="text-sm font-medium text-slate-500">R$ {stats.maintenancePrev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 gap-8">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="font-bold text-lg dark:text-white">Evolução de Gastos</h3>
                  <p className="text-sm text-slate-500">Combustível vs Manutenção (últimos 6 meses)</p>
                </div>
                <div className="flex gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-primary"></span>
                    <span className="dark:text-slate-400">Combustível</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                    <span className="dark:text-slate-400">Manutenção</span>
                  </div>
                </div>
              </div>
              <div className="h-64 relative">
                {loading && (
                  <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.spendingData}>
                    <defs>
                      <linearGradient id="colorFuel" x1="0" y1="0" x2="0" y2="100%">
                        <stop offset="5%" stopColor="#1152d4" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#1152d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="fuel" stroke="#1152d4" strokeWidth={3} fillOpacity={1} fill="url(#colorFuel)" />
                    <Area type="monotone" dataKey="maintenance" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pie Chart 1: Fleet vs Selected */}
              <div className="card p-6 flex flex-col">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="font-bold text-lg dark:text-white">Participação no Gasto</h3>
                    <p className="text-sm text-slate-500">Veículo vs Resto da Frota</p>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center relative mt-4">
                  {loading && (
                    <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  )}
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.participationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.participationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold dark:text-white">
                        {stats.participationData[0]?.value > 0 || stats.participationData[1]?.value > 0 
                          ? ((stats.participationData[0].value / (stats.participationData[0].value + stats.participationData[1].value)) * 100).toFixed(0) 
                          : '0'}%
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">da frota</span>
                    </div>
                  </div>
                  <div className="w-full mt-8 space-y-3">
                    {stats.participationData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                          <span className="dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                        </div>
                        <span className="font-bold dark:text-white">R$ {item.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pie Chart 2: Selected vs Comparison */}
              <div className="card p-6 flex flex-col">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="font-bold text-lg dark:text-white">Comparativo de Veículos</h3>
                    <p className="text-sm text-slate-500">Comparação direta entre dois veículos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
                      <Search size={14} />
                    </div>
                    <select 
                      className="bg-transparent border-none text-xs font-bold p-1 focus:ring-0 outline-none dark:text-white cursor-pointer hover:text-primary transition-colors"
                      value={selectedComparisonVehicleId}
                      onChange={(e) => setSelectedComparisonVehicleId(e.target.value)}
                    >
                      <option value="" disabled className="dark:bg-slate-900">Comparar com...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id} className="dark:bg-slate-900">{v.plate} - {v.model}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center relative mt-4">
                  {loading && (
                    <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  )}
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.comparisonData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.comparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold dark:text-white">
                        {stats.comparisonData[0]?.value > 0 || stats.comparisonData[1]?.value > 0 
                          ? ((stats.comparisonData[0].value / (stats.comparisonData[0].value + stats.comparisonData[1].value)) * 100).toFixed(0) 
                          : '0'}%
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">proporção</span>
                    </div>
                  </div>
                  <div className="w-full mt-8 space-y-3">
                    {stats.comparisonData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                          <span className="dark:text-slate-300 truncate max-w-[150px]">{item.name}</span>
                        </div>
                        <span className="font-bold dark:text-white">R$ {item.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-bold text-lg dark:text-white">
                  {chartType === 'fuel' ? 'Consumo de Combustível por Veículo' : 'Gasto com Manutenção por Veículo'}
                </h3>
                <p className="text-sm text-slate-500">
                  {chartType === 'fuel' ? 'Total de litros abastecidos por placa' : 'Soma total de manutenções por placa'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <select 
                  className="bg-slate-100 dark:bg-slate-800 border-none text-xs font-bold py-1.5 px-3 rounded-lg focus:ring-0 outline-none dark:text-white cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as 'fuel' | 'maintenance')}
                >
                  <option value="fuel">Combustível (Litros)</option>
                  <option value="maintenance">Manutenção (Valor)</option>
                </select>
              </div>
            </div>
            <div className="h-72 relative">
              {loading && (
                <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.vehicleSpendingData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#94a3b8'}}
                    tickFormatter={(value) => chartType === 'fuel' ? `${value}L` : `R$ ${value}`}
                  />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => chartType === 'fuel' ? [`${value} L`, 'Quantidade'] : [`R$ ${value.toLocaleString('pt-BR')}`, 'Valor Total']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  {chartType === 'fuel' ? (
                    <Bar dataKey="fuelQuantity" name="Litros" fill="#1152d4" radius={[4, 4, 0, 0]} barSize={40} />
                  ) : (
                    <Bar dataKey="maintenance" name="Manutenção" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Maintenance Alerts */}
          {stats.maintenanceAlerts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                  <AlertCircle className="text-orange-500" size={20} />
                  Alertas de Manutenção
                </h3>
                <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider dark:bg-orange-900/30">
                  {stats.maintenanceAlerts.length} {stats.maintenanceAlerts.length === 1 ? 'Alerta' : 'Alertas'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.maintenanceAlerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={cn(
                      "p-4 rounded-xl border flex gap-4 items-start transition-all hover:shadow-md",
                      alert.severity === 'warning' 
                        ? "bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-900/30" 
                        : "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      alert.severity === 'warning' ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                    )}>
                      {alert.type === 'authorized' ? <Clock size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-sm dark:text-white truncate">{alert.title}</h4>
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider shrink-0 ml-2">
                          {new Date(alert.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
                        Veículo: <span className="text-slate-900 dark:text-slate-200">{alert.vehicle}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2 italic">
                        "{alert.description}"
                      </p>
                      <button 
                        onClick={() => navigate('/maintenance-list')}
                        className="mt-3 text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        Ver detalhes <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-lg dark:text-white">Últimos Lançamentos</h3>
              <button className="text-primary text-sm font-semibold hover:underline">Ver todos</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Atividade</th>
                    <th className="px-6 py-4">Veículo / Placa</th>
                    <th className="px-6 py-4">Data e Hora</th>
                    <th className="px-6 py-4">Local / Detalhe</th>
                    <th className="px-6 py-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {stats.recentActivities.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", row.bg, row.color)}>
                            {row.type === 'fuel' ? <Fuel size={14} /> : <Settings size={14} />}
                          </div>
                          <span className="text-sm font-medium dark:text-slate-200">{row.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-semibold dark:text-slate-200">{row.vehicle}</p>
                          <p className="text-xs text-slate-500 uppercase">{row.plate}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <p className="dark:text-slate-300">{row.date}</p>
                        <p className="text-xs text-slate-500">{row.time}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {row.detail}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-bold dark:text-white">R$ {row.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Vehicle Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Selecionar Veículo</h3>
              <button 
                onClick={() => {
                  setIsSearchModalOpen(false);
                  setSearchQuery('');
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  placeholder="Buscar por placa, modelo ou prefixo..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                onClick={() => {
                  setSelectedVehicleId('all');
                  setIsSearchModalOpen(false);
                  setSearchQuery('');
                }}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl transition-all text-left",
                  selectedVehicleId === 'all'
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    selectedVehicleId === 'all' ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                  )}>
                    <Filter size={20} />
                  </div>
                  <div>
                    <p className="font-bold">Todos os Veículos</p>
                    <p className="text-xs opacity-70">Visão geral da frota</p>
                  </div>
                </div>
                {selectedVehicleId === 'all' && <Check size={20} />}
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-4" />

              {vehicles.filter(v => 
                v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.prefix.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVehicleId(v.id);
                    setIsSearchModalOpen(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl transition-all text-left",
                    selectedVehicleId === v.id
                      ? "bg-primary/10 border border-primary/20 text-primary"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      selectedVehicleId === v.id ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                    )}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <p className="font-bold">{v.plate}</p>
                      <p className="text-xs opacity-70">{v.model} • {v.prefix}</p>
                    </div>
                  </div>
                  {selectedVehicleId === v.id && <Check size={20} />}
                </button>
              ))}
              
              {vehicles.filter(v => 
                v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.prefix.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className="p-8 text-center">
                  <Search size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Nenhum veículo encontrado</p>
                  <p className="text-xs text-slate-400">Tente buscar por outro termo</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <p className="text-[10px] text-center text-slate-400 uppercase font-bold tracking-widest">
                {vehicles.length} veículos cadastrados na frota
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
