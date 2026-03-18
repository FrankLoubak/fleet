import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Calendar, Filter, Truck, 
  Wrench, ClipboardList, Loader2, Download, 
  ChevronRight, AlertCircle, Clock, CheckCircle2,
  Check, X, Pencil, Save, Upload, FileText, Link,
  Plus, Trash2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { cn } from '../utils';
import { User as UserType, Vehicle, MaintenanceRecord, MaintenanceRequest, MaintenanceType } from '../types';
import { supabase } from '../lib/supabase';

type ViewMode = 'executadas' | 'autorizadas' | 'pendentes' | 'canceladas';

export default function MaintenanceList() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('executadas');
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('all');
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [executedMaintenances, setExecutedMaintenances] = useState<MaintenanceRecord[]>([]);
  const [pendingRequests, setPendingRequests] = useState<MaintenanceRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    vehicleId: '',
    date: '',
    odometer: 0,
    type: 'Preventiva' as any,
    description: '',
    budgetValue: 0,
    serviceRequestNumber: '',
    materialRequestNumber: '',
    documentUrl: '',
    provider: '',
    status: 'pendente' as any
  });

  const [newRequestForm, setNewRequestForm] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    odometer: 0,
    type: 'Mecanica' as MaintenanceType,
    description: '',
    budgetValue: 0,
    serviceRequestNumber: '',
    materialRequestNumber: '',
    documentUrl: ''
  });

  useEffect(() => {
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

    const fetchVehicles = async () => {
      const { data, error } = await supabase.from('vehicles').select('*').order('plate');
      if (!error && data) setVehicles(data);
    };
    fetchVehicles();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (viewMode === 'executadas' || viewMode === 'autorizadas' || viewMode === 'canceladas') {
        let query = supabase
          .from('maintenances')
          .select('*')
          .eq('status', viewMode === 'executadas' ? 'executada' : viewMode === 'autorizadas' ? 'pendente' : 'cancelada')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (selectedVehicleId !== 'all') {
          query = query.eq('vehicle_id', selectedVehicleId);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        // Normalize
        const normalized = (data || []).map(m => ({
          ...m,
          vehicleId: m.vehicle_id,
          totalValue: m.total_value
        }));
        setExecutedMaintenances(normalized);
      } else {
        let query = supabase
          .from('maintenance_requests')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('status', 'pendente')
          .order('date', { ascending: false });

        if (selectedVehicleId !== 'all') {
          query = query.eq('vehicle_id', selectedVehicleId);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Normalize
        const normalized = (data || []).map(r => ({
          ...r,
          vehicleId: r.vehicle_id,
          budgetValue: r.budget_value,
          documentUrl: r.document_url,
          serviceRequestNumber: r.service_request_number,
          materialRequestNumber: r.material_request_number
        }));
        setPendingRequests(normalized);
      }
    } catch (err) {
      console.error('Error fetching maintenance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, viewMode, startDate, endDate, selectedVehicleId]);

  const handleAuthorize = async (request: MaintenanceRequest) => {
    if (!window.confirm('Deseja autorizar esta solicitação de manutenção?')) return;
    
    setActionLoading(request.id);
    try {
      // 1. Update request status
      const { error: updateError } = await supabase
        .from('maintenance_requests')
        .update({ status: 'aprovada' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // 2. Create maintenance record
      const maintenancePayload = {
        request_id: request.id,
        vehicle_id: request.vehicleId,
        user_id: request.userId,
        type: request.type,
        description: request.description,
        total_value: request.budgetValue || 0,
        status: 'pendente',
        provider: 'A definir',
        // User asked to fill columns EXCEPT date and mileage from request_id data.
        // However, these are likely required in DB. Using request values as defaults.
        date: request.date,
        mileage: request.odometer
      };

      const { error: insertError } = await supabase
        .from('maintenances')
        .insert([maintenancePayload]);

      if (insertError) throw insertError;

      alert('Solicitação autorizada com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Error authorizing request:', err);
      alert('Erro ao autorizar solicitação.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('maintenance_requests')
        .insert([{
          vehicle_id: newRequestForm.vehicleId,
          user_id: currentUser?.id,
          date: newRequestForm.date,
          odometer: newRequestForm.odometer,
          type: newRequestForm.type,
          description: newRequestForm.description,
          budget_value: newRequestForm.budgetValue,
          service_request_number: newRequestForm.serviceRequestNumber,
          material_request_number: newRequestForm.material_request_number,
          document_url: newRequestForm.documentUrl,
          status: 'pendente'
        }]);

      if (error) throw error;

      setIsNewRequestModalOpen(false);
      setNewRequestForm({
        vehicleId: '',
        date: new Date().toISOString().split('T')[0],
        odometer: 0,
        type: 'Mecanica' as MaintenanceType,
        description: '',
        budgetValue: 0,
        serviceRequestNumber: '',
        materialRequestNumber: '',
        documentUrl: ''
      });
      fetchData();
    } catch (err) {
      console.error('Error creating request:', err);
      alert('Erro ao criar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item: MaintenanceRequest | MaintenanceRecord) => {
    if ('userId' in item) {
      // It's a Request
      setEditingRequest(item);
      setEditingMaintenance(null);
      setEditForm({
        vehicleId: item.vehicleId,
        date: item.date,
        odometer: item.odometer,
        type: item.type,
        description: item.description,
        budgetValue: item.budgetValue || 0,
        serviceRequestNumber: item.serviceRequestNumber || '',
        materialRequestNumber: item.materialRequestNumber || '',
        documentUrl: item.documentUrl || '',
        provider: '',
        status: item.status
      });
    } else {
      // It's a Maintenance Record
      setEditingMaintenance(item);
      setEditingRequest(null);
      setEditForm({
        vehicleId: item.vehicleId,
        date: item.date,
        odometer: item.mileage,
        type: item.type,
        description: item.description,
        budgetValue: item.totalValue || 0,
        serviceRequestNumber: '',
        materialRequestNumber: '',
        documentUrl: '',
        provider: item.provider,
        status: item.status
      });
    }
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      if (editingRequest) {
        const { error } = await supabase
          .from('maintenance_requests')
          .update({
            vehicle_id: editForm.vehicleId,
            date: editForm.date,
            odometer: editForm.odometer,
            type: editForm.type,
            description: editForm.description,
            budget_value: editForm.budgetValue,
            service_request_number: editForm.serviceRequestNumber,
            material_request_number: editForm.materialRequestNumber,
            document_url: editForm.documentUrl
          })
          .eq('id', editingRequest.id);

        if (error) throw error;
      } else if (editingMaintenance) {
        const { error } = await supabase
          .from('maintenances')
          .update({
            vehicle_id: editForm.vehicleId,
            date: editForm.date,
            mileage: editForm.odometer,
            type: editForm.type,
            description: editForm.description,
            total_value: editForm.budgetValue,
            provider: editForm.provider,
            status: editForm.status
          })
          .eq('id', editingMaintenance.id);

        if (error) throw error;
      }

      alert('Registro atualizado com sucesso!');
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error updating record:', err);
      alert('Erro ao atualizar registro.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMaintenance = async (m: MaintenanceRecord) => {
    if (!window.confirm('Deseja cancelar esta manutenção? Se ela foi gerada por uma solicitação, a solicitação também será cancelada.')) return;
    
    setActionLoading(m.id);
    try {
      // 1. Update maintenance status to 'cancelada'
      const { error: mError } = await supabase
        .from('maintenances')
        .update({ status: 'cancelada' })
        .eq('id', m.id);
      
      if (mError) throw mError;

      // 2. If it has a requestId, cancel the request too
      if (m.requestId) {
        const { error: rError } = await supabase
          .from('maintenance_requests')
          .update({ status: 'cancelada' })
          .eq('id', m.requestId);
        
        if (rError) throw rError;
      }

      alert('Manutenção cancelada com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Error cancelling maintenance:', err);
      alert('Erro ao cancelar manutenção.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMaintenance = async (id: string, table: 'maintenances' | 'maintenance_requests') => {
    if (!window.confirm('Deseja excluir este registro permanentemente?')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      alert('Registro excluído com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Error deleting record:', err);
      alert('Erro ao excluir registro.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishMaintenance = async (m: MaintenanceRecord) => {
    if (!window.confirm('Deseja marcar esta manutenção como executada?')) return;
    
    setActionLoading(m.id);
    try {
      const { error } = await supabase
        .from('maintenances')
        .update({ status: 'executada' })
        .eq('id', m.id);
      
      if (error) throw error;

      // Also mark request as concluida if exists
      if (m.requestId) {
        await supabase
          .from('maintenance_requests')
          .update({ status: 'concluida' })
          .eq('id', m.requestId);
      }

      alert('Manutenção concluída com sucesso!');
      fetchData();
    } catch (err) {
      console.error('Error finishing maintenance:', err);
      alert('Erro ao concluir manutenção.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, selecione apenas arquivos PDF.');
      return;
    }

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `maintenance-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setEditForm({ ...editForm, documentUrl: publicUrl });
      alert('Documento enviado com sucesso!');
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Erro ao enviar documento. Verifique se o bucket "documents" existe.');
    } finally {
      setLoading(false);
    }
  };

  const getVehiclePlate = (id: string) => {
    return vehicles.find(v => v.id === id)?.plate || '---';
  };

  const isRequestComplete = (r: MaintenanceRequest) => {
    return !!(
      r.vehicleId && 
      r.date && 
      r.odometer && 
      r.type && 
      r.description && 
      (r.budgetValue !== undefined && r.budgetValue !== null && r.budgetValue > 0) && 
      r.serviceRequestNumber && 
      r.materialRequestNumber && 
      r.documentUrl
    );
  };

  if (!currentUser) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-auto">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors lg:hidden"
            >
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-lg font-bold dark:text-white">Gestão de Manutenções</h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsNewRequestModalOpen(true)}
              className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <Plus size={18} />
              Nova Solicitação
            </button>
             <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('executadas')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    viewMode === 'executadas' 
                      ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  Visualizar Executadas
                </button>
                <button
                  onClick={() => setViewMode('autorizadas')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    viewMode === 'autorizadas' 
                      ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  Visualizar Autorizadas
                </button>
                <button
                  onClick={() => setViewMode('pendentes')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    viewMode === 'pendentes' 
                      ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  Visualizar Pendentes
                </button>
                <button
                  onClick={() => setViewMode('canceladas')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    viewMode === 'canceladas' 
                      ? "bg-white dark:bg-slate-700 text-primary shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  )}
                >
                  Visualizar Canceladas
                </button>
             </div>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* Filters */}
          <div className="card p-6 flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Veículo</label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select 
                  className="input-field pl-10 h-11 text-sm appearance-none"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                  <option value="all">Todos os Veículos</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 min-w-[150px] space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data Início</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="date" 
                  className="input-field pl-10 h-11 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 min-w-[150px] space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data Fim</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="date" 
                  className="input-field pl-10 h-11 text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={fetchData}
              className="h-11 px-6 bg-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-primary/20"
            >
              <Filter size={18} />
              Filtrar
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden relative min-h-[400px]">
            {loading && (
              <div className="absolute inset-0 z-10 bg-white/50 dark:bg-background-dark/50 backdrop-blur-[1px] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            )}

            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  viewMode === 'executadas' ? "bg-green-100 text-green-600" : 
                  viewMode === 'autorizadas' ? "bg-blue-100 text-blue-600" : 
                  viewMode === 'canceladas' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                )}>
                  {viewMode === 'executadas' ? <CheckCircle2 size={20} /> : 
                   viewMode === 'autorizadas' ? <Wrench size={20} /> : 
                   viewMode === 'canceladas' ? <X size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-lg dark:text-white">
                    {viewMode === 'executadas' ? 'Manutenções Executadas' : 
                     viewMode === 'autorizadas' ? 'Manutenções Autorizadas' : 
                     viewMode === 'canceladas' ? 'Manutenções Canceladas' : 'Solicitações Pendentes'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewMode === 'pendentes' 
                      ? `${pendingRequests.length} solicitações aguardando`
                      : `${executedMaintenances.length} registros encontrados`}
                  </p>
                </div>
              </div>
              <button className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-primary transition-colors">
                <Download size={16} />
                Exportar Lista
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  {viewMode !== 'pendentes' ? (
                    <tr>
                      <th className="px-6 py-4">Veículo</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">KM</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Prestador</th>
                      <th className="px-6 py-4">Descrição</th>
                      <th className="px-6 py-4">Valor Total</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-6 py-4">Veículo</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">KM (Odo)</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">Descrição</th>
                      <th className="px-6 py-4">Orçamento</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {viewMode !== 'pendentes' ? (
                    executedMaintenances.length > 0 ? (
                      executedMaintenances.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold dark:text-white">{getVehiclePlate(m.vehicleId)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm dark:text-slate-300">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm dark:text-slate-300">{m.mileage.toLocaleString()} KM</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px] font-bold rounded-md uppercase">
                              {m.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 text-[10px] font-bold rounded-md uppercase",
                              m.status === 'executada' 
                                ? "bg-green-100 text-green-600" 
                                : m.status === 'cancelada'
                                ? "bg-red-100 text-red-600"
                                : "bg-amber-100 text-amber-600"
                            )}>
                              {m.status === 'executada' ? 'Executada' : m.status === 'cancelada' ? 'Cancelada' : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm dark:text-slate-300">{m.provider}</span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-500 max-w-xs truncate" title={m.description}>{m.description}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {m.status === 'pendente' && (
                                <button
                                  onClick={() => handleFinishMaintenance(m)}
                                  className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                                  title="Concluir Manutenção"
                                >
                                  <Check size={18} />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEdit(m)}
                                className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                onClick={() => handleCancelMaintenance(m)}
                                className="p-2 bg-amber-100 text-amber-600 hover:bg-amber-200 rounded-lg transition-colors"
                                title="Cancelar Manutenção"
                              >
                                <X size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteMaintenance(m.id, 'maintenances')}
                                className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                                title="Excluir Permanentemente"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Nenhum registro encontrado</td>
                      </tr>
                    )
                  ) : (
                    pendingRequests.length > 0 ? (
                      pendingRequests.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold dark:text-white">{getVehiclePlate(r.vehicleId)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm dark:text-slate-300">{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm dark:text-slate-300">{r.odometer.toLocaleString()} KM</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-[10px] font-bold rounded-md uppercase">
                              {r.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-500 max-w-xs truncate" title={r.description}>{r.description}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {r.budgetValue ? `R$ ${r.budgetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '---'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenEdit(r)}
                                className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Editar Solicitação"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                disabled={actionLoading === r.id || !isRequestComplete(r)}
                                onClick={() => handleAuthorize(r)}
                                className={cn(
                                  "p-2 rounded-lg transition-colors disabled:opacity-50",
                                  isRequestComplete(r) 
                                    ? "bg-green-100 text-green-600 hover:bg-green-200" 
                                    : "bg-amber-100 text-amber-600 cursor-not-allowed"
                                )}
                                title={isRequestComplete(r) ? "Autorizar Manutenção" : "Solicitação Incompleta"}
                              >
                                {actionLoading === r.id ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : isRequestComplete(r) ? (
                                  <Check size={18} />
                                ) : (
                                  <AlertCircle size={18} />
                                )}
                              </button>
                              <button
                                onClick={() => handleDeleteMaintenance(r.id, 'maintenance_requests')}
                                className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                                title="Excluir Solicitação"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Nenhuma solicitação pendente</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Request Modal */}
        {/* New Request Modal */}
        {isNewRequestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nova Solicitação de Manutenção</h3>
                <button 
                  onClick={() => setIsNewRequestModalOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateRequest} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Veículo</label>
                    <select 
                      required
                      className="input-field"
                      value={newRequestForm.vehicleId}
                      onChange={(e) => setNewRequestForm({...newRequestForm, vehicleId: e.target.value})}
                    >
                      <option value="">Selecione o veículo</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Data</label>
                    <input 
                      required
                      type="date"
                      className="input-field"
                      value={newRequestForm.date}
                      onChange={(e) => setNewRequestForm({...newRequestForm, date: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Quilometragem (KM)</label>
                    <input 
                      required
                      type="number"
                      className="input-field"
                      value={newRequestForm.odometer}
                      onChange={(e) => setNewRequestForm({...newRequestForm, odometer: parseInt(e.target.value) || 0})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tipo de Manutenção</label>
                    <select 
                      required
                      className="input-field"
                      value={newRequestForm.type}
                      onChange={(e) => setNewRequestForm({...newRequestForm, type: e.target.value as MaintenanceType})}
                    >
                      <option value="Mecanica">Mecanica</option>
                      <option value="Eletrica">Eletrica</option>
                      <option value="Acessórios">Acessórios</option>
                      <option value="Borracharia">Borracharia</option>
                      <option value="Ar de serviço">Ar de serviço</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Valor Orçado (R$)</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      className="input-field"
                      value={newRequestForm.budgetValue}
                      onChange={(e) => setNewRequestForm({...newRequestForm, budgetValue: parseFloat(e.target.value) || 0})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nº Solicitação Serviço</label>
                    <input 
                      required
                      type="text"
                      className="input-field"
                      value={newRequestForm.serviceRequestNumber}
                      onChange={(e) => setNewRequestForm({...newRequestForm, serviceRequestNumber: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nº Solicitação Material</label>
                    <input 
                      required
                      type="text"
                      className="input-field"
                      value={newRequestForm.materialRequestNumber}
                      onChange={(e) => setNewRequestForm({...newRequestForm, materialRequestNumber: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Documento (URL)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        className="input-field flex-1"
                        placeholder="URL do documento..."
                        value={newRequestForm.documentUrl}
                        onChange={(e) => setNewRequestForm({...newRequestForm, documentUrl: e.target.value})}
                      />
                      <label className="cursor-pointer px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center">
                        <Upload size={18} className="text-slate-500" />
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Reusing the same upload logic
                              handleFileUpload(file);
                            }
                          }} 
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Descrição do Serviço</label>
                  <textarea 
                    required
                    className="input-field min-h-[100px] resize-none"
                    value={newRequestForm.description}
                    onChange={(e) => setNewRequestForm({...newRequestForm, description: e.target.value})}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsNewRequestModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Criar Solicitação
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Editar Solicitação</h3>
                  <p className="text-xs text-slate-500">Complete ou corrija os dados da solicitação</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors dark:text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Veículo</label>
                  <select 
                    className="input-field h-11 text-sm"
                    value={editForm.vehicleId}
                    onChange={(e) => setEditForm({...editForm, vehicleId: e.target.value})}
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data</label>
                  <input 
                    type="date" 
                    className="input-field h-11 text-sm"
                    value={editForm.date}
                    onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Odômetro (KM)</label>
                  <input 
                    type="number" 
                    className="input-field h-11 text-sm"
                    value={editForm.odometer}
                    onChange={(e) => setEditForm({...editForm, odometer: Number(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Manutenção</label>
                  <select 
                    className="input-field h-11 text-sm"
                    value={editForm.type}
                    onChange={(e) => setEditForm({...editForm, type: e.target.value as any})}
                  >
                    <option value="Preventiva">Preventiva</option>
                    <option value="Corretiva">Corretiva</option>
                    <option value="Mecanica">Mecânica</option>
                    <option value="Eletrica">Elétrica</option>
                    <option value="Acessórios">Acessórios</option>
                    <option value="Borracharia">Borracharia</option>
                    <option value="Ar de serviço">Ar de serviço</option>
                  </select>
                </div>

                {editingMaintenance && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prestador</label>
                      <input 
                        type="text" 
                        className="input-field h-11 text-sm"
                        value={editForm.provider}
                        onChange={(e) => setEditForm({...editForm, provider: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                      <select 
                        className="input-field h-11 text-sm"
                        value={editForm.status}
                        onChange={(e) => setEditForm({...editForm, status: e.target.value as any})}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="executada">Executada</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descrição do Problema</label>
                  <textarea 
                    className="input-field min-h-[100px] py-3 text-sm resize-none"
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    placeholder="Descreva detalhadamente o que precisa ser feito..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor do Orçamento (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input-field h-11 text-sm"
                    value={editForm.budgetValue}
                    onChange={(e) => setEditForm({...editForm, budgetValue: Number(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nº Requisição de Serviço</label>
                  <input 
                    type="text" 
                    className="input-field h-11 text-sm"
                    value={editForm.serviceRequestNumber}
                    onChange={(e) => setEditForm({...editForm, serviceRequestNumber: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nº Requisição de Materiais</label>
                  <input 
                    type="text" 
                    className="input-field h-11 text-sm"
                    value={editForm.materialRequestNumber}
                    onChange={(e) => setEditForm({...editForm, materialRequestNumber: e.target.value})}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documento PDF (Orçamento/NF)</label>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        className="input-field pl-10 h-11 text-sm"
                        placeholder="URL do documento ou faça upload..."
                        value={editForm.documentUrl}
                        onChange={(e) => setEditForm({...editForm, documentUrl: e.target.value})}
                      />
                    </div>
                    <label className="h-11 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                      <Upload size={18} />
                      <span>Upload</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf"
                        onChange={handleFileUpload}
                      />
                    </label>
                    {editForm.documentUrl && (
                      <a 
                        href={editForm.documentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="h-11 w-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-100 transition-all"
                        title="Visualizar Documento"
                      >
                        <FileText size={18} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={loading}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
