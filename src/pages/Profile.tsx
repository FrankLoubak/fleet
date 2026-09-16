/**
 * ARQUIVO: src/pages/Profile.tsx
 * O QUE FAZ: tela de perfil do usuário logado (dados pessoais, segurança).
 * PARA QUE SERVE: autosserviço do usuário sobre os próprios dados.
 * MÓDULOS RELACIONADOS:
 *   - src/lib/drivers/index.ts (driverAuthProvider) — Rodada C / C1: cadastro/troca do
 *     PIN de identificação usado ao abrir jornadas (ver handleSavePin)
 * ÚLTIMA ATUALIZAÇÃO: 2026-09-16 — Rodada C / C1: adicionado card de cadastro de PIN
 */
import React, { useEffect, useState } from 'react';
import { User as UserIcon, Mail, Phone, Shield, Camera, Save, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User } from '../types';
import { driverAuthProvider } from '../lib/drivers';

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess(false);

    if (!/^[0-9]{4,6}$/.test(pin)) {
      setPinError('O PIN deve ter entre 4 e 6 dígitos numéricos.');
      return;
    }
    if (pin !== pinConfirm) {
      setPinError('Os PINs digitados não coincidem.');
      return;
    }

    setPinLoading(true);
    try {
      const result = await driverAuthProvider.setPin(pin);
      if (!result.success) {
        setPinError(result.error || 'Não foi possível salvar o PIN.');
        return;
      }
      setPinSuccess(true);
      setPin('');
      setPinConfirm('');
    } finally {
      setPinLoading(false);
    }
  };

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
  }, []);

  if (!currentUser) return null;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Voltar</span>
          </button>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Profile Card */}
            <div className="w-full md:w-80 shrink-0">
              <div className="card p-6 text-center">
                <div className="relative inline-block mb-4">
                  <img
                    src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`}
                    alt={currentUser.name}
                    className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-xl object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors border-2 border-white dark:border-slate-900">
                    <Camera size={18} />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{currentUser.name}</h2>
                <p className="text-blue-600 font-bold uppercase tracking-widest text-[10px] mt-1">{currentUser.role}</p>
                
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <Shield size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">CPF</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {currentUser.cpf ? currentUser.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : 'Não informado'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Card */}
            <div className="flex-1 space-y-6">
              <div className="card p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Informações Pessoais</h3>
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Nome Completo</label>
                      <input type="text" className="input-field" defaultValue={currentUser.name} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">E-mail</label>
                      <input type="email" className="input-field" defaultValue={currentUser.email} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Telefone</label>
                      <input type="tel" className="input-field" defaultValue={currentUser.phone || ''} placeholder="(00) 00000-0000" />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button type="button" className="btn-primary flex items-center justify-center gap-2 px-8" disabled={loading}>
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      <span>Salvar Alterações</span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="card p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <KeyRound size={20} className="text-blue-600" />
                  PIN de Identificação
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Usado para se identificar antes de abrir uma jornada. Só você conhece este PIN.
                </p>
                <form onSubmit={handleSavePin} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Novo PIN (4-6 dígitos)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        className="input-field"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Confirmar PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        className="input-field"
                        value={pinConfirm}
                        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                  {pinError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{pinError}</p>
                  )}
                  {pinSuccess && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">PIN salvo com sucesso.</p>
                  )}
                  <div className="pt-2">
                    <button type="submit" className="btn-primary flex items-center justify-center gap-2 px-8" disabled={pinLoading}>
                      {pinLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      <span>Salvar PIN</span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="card p-8">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Segurança</h3>
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Altere sua senha para manter sua conta segura.</p>
                  <button className="px-6 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all">
                    Alterar Senha
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
