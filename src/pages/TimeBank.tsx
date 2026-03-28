import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Calendar, 
  User as UserIcon, 
  History, 
  TrendingUp, 
  Search, 
  Filter, 
  Download, 
  Loader2, 
  Menu,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { cn } from '../utils';
import { User as UserType, BancoDeHoras, Journey } from '../types';
import { supabase } from '../lib/supabase';

export default function TimeBank() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<(BancoDeHoras & { journey?: Journey, user?: UserType })[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalHours, setTotalHours] = useState('00:00');

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let query = supabase
        .from('banco_de_horas')
        .select(`
          *,
          journey:journeys(*),
          user:profiles(*)
        `)
        .order('created_at', { ascending: false });

      if (currentUser.role !== 'Admin') {
        query = query.eq('user_id', currentUser.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const normalizedRecords = (data || []).map(r => ({
        ...r,
        journey: r.journey ? {
          id: r.journey.id,
          userId: r.journey.user_id,
          vehicleId: r.journey.vehicle_id,
          startTime: r.journey.start_time,
          endTime: r.journey.end_time,
          startOdometer: r.journey.start_odometer,
          endOdometer: r.journey.end_odometer,
          distanceTraveled: r.journey.distance_traveled,
          status: r.journey.status,
          observations: r.journey.observations,
          validation_status: r.journey.validation_status,
          validated_by: r.journey.validated_by
        } : undefined,
        user: r.user ? {
          id: r.user.id,
          name: r.user.name,
          email: r.user.email,
          role: r.user.role,
          avatar: r.user.avatar_url,
          phone: r.user.phone
        } : undefined
      }));

      setRecords(normalizedRecords);

      // Calculate total hours
      let totalMins = 0;
      normalizedRecords.forEach(r => {
        const [h, m] = r.horas_adquiridas.split(':').map(Number);
        totalMins += (h * 60) + m;
      });

      const totalH = Math.floor(totalMins / 60);
      const totalM = totalMins % 60;
      setTotalHours(`${totalH.toString().padStart(2, '0')}:${totalM.toString().padStart(2, '0')}`);

    } catch (err) {
      console.error('Error loading time bank:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (!userJson) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userJson);
    setCurrentUser(user);
  }, [navigate]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const filteredRecords = records.filter(r => 
    r.user?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.journey?.observations?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <h2 className="text-lg font-bold dark:text-white">Banco de Horas</h2>
          </div>
        </header>

        <div className="p-4 md:p-8 space-y-6">
          {/* Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 bg-primary text-white border-none shadow-xl shadow-primary/20 overflow-hidden relative">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock size={20} />
                  </div>
                  <span className="text-sm font-medium text-white/80">Saldo Total de Horas</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-4xl font-bold">{totalHours}</h3>
                  <span className="text-sm font-medium text-white/60">HH:MM</span>
                </div>
                <p className="mt-4 text-xs text-white/60 flex items-center gap-1">
                  <TrendingUp size={12} />
                  <span>Acumulado de jornadas validadas</span>
                </p>
              </div>
            </div>

            <div className="card p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-500">Registros Totais</span>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <History size={20} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold dark:text-white">{records.length}</h3>
                <p className="text-xs text-slate-400 mt-1">Lançamentos no banco</p>
              </div>
            </div>

            <div className="card p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-500">Último Lançamento</span>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                  <Calendar size={20} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold dark:text-white">
                  {records.length > 0 
                    ? new Date(records[0].created_at).toLocaleDateString('pt-BR') 
                    : '---'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">Data do registro mais recente</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-primary w-full dark:text-white shadow-sm"
                placeholder="Buscar por motorista ou observação..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors dark:text-slate-300">
                <Filter size={18} />
                <span>Filtrar</span>
              </button>
              <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20">
                <Download size={18} />
                <span>Exportar</span>
              </button>
            </div>
          </div>

          <div className="card overflow-hidden border-none shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Motorista</th>
                    <th className="px-6 py-4">Jornada</th>
                    <th className="px-6 py-4">Horas Adquiridas</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <p className="text-sm text-slate-500">Carregando registros...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                            <Clock size={32} />
                          </div>
                          <p className="text-slate-500 font-medium">Nenhum registro encontrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {new Date(record.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold">
                              {new Date(record.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              alt={record.user?.name}
                              className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                              src={record.user?.avatar}
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{record.user?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {record.journey ? `Jornada #${record.journey.id.slice(0, 8)}` : '---'}
                            </span>
                            <span className="text-xs text-slate-400 truncate max-w-[200px]">
                              {record.journey?.observations || 'Sem observações'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-bold flex items-center gap-1.5">
                              <ArrowUpRight size={14} />
                              <span>{record.horas_adquiridas}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => navigate('/journeys')}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-primary"
                            title="Ver Jornada"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
