import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, Truck, Calendar, Zap, ClipboardList, Power, Wrench, BarChart3, History, LogOut, Loader2 } from 'lucide-react';
import { cn } from '../utils';
import { MaintenanceType, User as UserType, Vehicle } from '../types';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function RequestMaintenance() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedType, setSelectedType] = useState<MaintenanceType | ''>('');
  const [odometer, setOdometer] = useState('');
  const [description, setDescription] = useState('');
  const [budgetValue, setBudgetValue] = useState('');
  const [serviceRequestNumber, setServiceRequestNumber] = useState('');
  const [materialRequestNumber, setMaterialRequestNumber] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Por favor, selecione apenas arquivos PDF.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('O arquivo deve ter no máximo 5MB.');
        return;
      }
      setDocumentFile(file);
    }
  };

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
        setSelectedVehicle(j.vehicle_id);
        setOdometer(j.start_odometer.toString());
      }
    };
    initPage();
  }, [navigate]);

  const handleSendRequest = async () => {
    if (!selectedVehicle || !selectedType || !odometer || !description) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      let documentUrl = '';
      if (documentFile) {
        const fileExt = documentFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `requests/${currentUser?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('maintenance_documents')
          .upload(filePath, documentFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          // If bucket doesn't exist, try 'documents' as fallback or just warn
          if (uploadError.message.includes('bucket not found')) {
            toast.error('Erro: Bucket de armazenamento não configurado. Contate o administrador.');
            throw new Error('Storage bucket not found');
          }
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('maintenance_documents')
          .getPublicUrl(filePath);
        
        documentUrl = publicUrl;
      }

      const requestPayload = {
        user_id: currentUser?.id || '',
        vehicle_id: selectedVehicle,
        date,
        odometer: Number(odometer),
        type: selectedType,
        description,
        budget_value: budgetValue ? Number(budgetValue) : null,
        service_request_number: serviceRequestNumber,
        material_request_number: materialRequestNumber,
        document_url: documentUrl,
        status: 'pendente'
      };

      const { error } = await supabase
        .from('maintenance_requests')
        .insert([requestPayload]);

      if (error) throw error;

      toast.success('Solicitação enviada com sucesso!');
      navigate(-1);
    } catch (err: any) {
      console.error('Error sending request:', err);
      toast.error(`Erro ao enviar solicitação: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const vehicle = vehicles.find(v => v.id === selectedVehicle);

  if (!currentUser) return null;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col items-center">
      <div className="relative flex h-auto min-h-screen w-full max-w-md mx-auto flex-col bg-background-light dark:bg-background-dark overflow-x-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background-light dark:bg-background-dark z-10 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => navigate(-1)}
            className="text-slate-900 dark:text-slate-100 flex size-10 shrink-0 items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Solicitar Manutenção</h2>
        </div>

        {/* User Profile Section */}
        <div className="flex p-4">
          <div className="flex w-full flex-col gap-4">
            <div className="flex items-center gap-4">
              <div 
                className="bg-primary/20 bg-center bg-no-repeat aspect-square bg-cover rounded-full h-16 w-16 border-2 border-primary/30" 
                style={{ backgroundImage: `url(${currentUser.avatar})` }}
              ></div>
              <div className="flex flex-col justify-center">
                <p className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-tight">Olá, {currentUser.name}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">Bem-vindo ao portal de manutenção</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex flex-col gap-6 p-4">
          {/* Vehicle Identification */}
          <section className="flex flex-col gap-4">
            <h3 className="text-primary text-sm font-bold uppercase tracking-wider">Identificação do Veículo</h3>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col w-full">
                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Veículo</p>
                <select 
                  className="input-field appearance-none"
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                >
                  <option value="">Selecione o veículo</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.model} - {v.plate}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Placa</p>
                  <input 
                    className="input-field bg-slate-100 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed" 
                    readOnly 
                    value={vehicle?.plate || ''}
                    placeholder="ABC-1234" 
                    type="text" 
                  />
                </label>
                <label className="flex flex-col">
                  <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Prefixo / Frota</p>
                  <input 
                    className="input-field bg-slate-100 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed" 
                    readOnly 
                    value={vehicle?.prefix || ''}
                    placeholder="0000" 
                    type="text" 
                  />
                </label>
              </div>
            </div>
          </section>

          {/* Journey Data */}
          <section className="flex flex-col gap-4">
            <h3 className="text-primary text-sm font-bold uppercase tracking-wider">Dados da Solicitação</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col">
                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Data do Registro</p>
                <div className="relative">
                  <input 
                    className="input-field" 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </label>
              <label className="flex flex-col">
                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Quilometragem (KM)</p>
                <input 
                  className="input-field" 
                  placeholder="Ex: 125400" 
                  type="number" 
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                />
              </label>
            </div>

            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Tipo de Manutenção</p>
              <div className="relative">
                <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <select 
                  className="input-field pl-12 appearance-none"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as MaintenanceType)}
                >
                  <option value="">Selecione o tipo</option>
                  <option value="Mecanica">1-Mecanica</option>
                  <option value="Eletrica">2-Eletrica</option>
                  <option value="Acessórios">3-Acessórios</option>
                  <option value="Borracharia">4-Borracharia</option>
                  <option value="Ar de serviço">5-Ar de serviço</option>
                </select>
              </div>
            </label>
          </section>

          {/* Maintenance Description */}
          <section className="flex flex-col gap-4">
            <h3 className="text-primary text-sm font-bold uppercase tracking-wider">Detalhes da Manutenção</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col">
                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Valor do Orçamento (R$)</p>
                <input 
                  className="input-field" 
                  placeholder="0,00" 
                  type="number" 
                  step="0.01"
                  value={budgetValue}
                  onChange={(e) => setBudgetValue(e.target.value)}
                />
              </label>
              <label className="flex flex-col">
                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Documento (PDF)</p>
                <input 
                  className="input-field text-xs pt-3" 
                  type="file" 
                  accept="application/pdf"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col">
                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Nº Req. Serviços</p>
                <input 
                  className="input-field" 
                  placeholder="Ex: RS-123" 
                  type="text" 
                  value={serviceRequestNumber}
                  onChange={(e) => setServiceRequestNumber(e.target.value)}
                />
              </label>
              <label className="flex flex-col">
                <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Nº Req. Materiais</p>
                <input 
                  className="input-field" 
                  placeholder="Ex: RM-456" 
                  type="text" 
                  value={materialRequestNumber}
                  onChange={(e) => setMaterialRequestNumber(e.target.value)}
                />
              </label>
            </div>

            <label className="flex flex-col w-full">
              <p className="text-slate-700 dark:text-slate-300 text-sm font-medium pb-1.5">Descrição da Manutenção Solicitada</p>
              <textarea 
                className="input-field min-h-[120px] p-4 resize-none" 
                placeholder="Descreva aqui anomalias ou necessidades de serviço..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </label>
          </section>
        </div>

        {/* Submit Button Footer */}
        <div className="mt-auto p-4 pb-8">
          <button 
            disabled={loading}
            onClick={handleSendRequest}
            className="btn-primary py-4 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
            <span className="font-bold uppercase tracking-wider">{loading ? 'Enviando...' : 'Enviar Solicitação'}</span>
          </button>
        </div>

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
            onClick={() => navigate('/daily-report')}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400 hover:text-primary transition-colors"
          >
            <Power size={24} />
            <p className="text-[9px] font-bold uppercase tracking-tight text-center">Início</p>
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('fleet_user');
              navigate('/login');
            }}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400"
          >
            <LogOut size={24} />
            <p className="text-[9px] font-bold uppercase tracking-tight text-center">Sair</p>
          </button>
        </nav>
      </div>
    </div>
  );
}
