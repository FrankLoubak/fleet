import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users as UsersIcon, UserPlus, Copy, Check, X, Loader2, AlertCircle, Shield, Link as LinkIcon } from 'lucide-react';
import { cn } from '../utils';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import Sidebar from '../components/Sidebar';

interface Profile {
  id: string;
  name: string;
  cpf: string;
  role: string;
  invited_by?: string;
  inviter_name?: string;
}

interface InviteModalState {
  open: boolean;
  role: 'Admin' | 'Operador';
  loading: boolean;
  generatedLink: string;
  copied: boolean;
  error: string;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [modal, setModal] = useState<InviteModalState>({
    open: false,
    role: 'Operador',
    loading: false,
    generatedLink: '',
    copied: false,
    error: '',
  });

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (!userJson) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(userJson) as User;
    if (user.role !== 'Admin' && user.role !== 'Root') {
      navigate('/daily-report');
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    fetchProfiles();
  }, [currentUser]);

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, cpf, role, invited_by')
        .order('name', { ascending: true });

      if (error) throw error;

      // Buscar nomes dos inviters
      const inviterIds = [...new Set((data || []).map((p: Omit<Profile, 'inviter_name'>) => p.invited_by).filter(Boolean))];
      let inviterMap: Record<string, string> = {};

      if (inviterIds.length > 0) {
        const { data: inviters } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', inviterIds);

        if (inviters) {
          inviters.forEach((inv: { id: string; name: string }) => {
            inviterMap[inv.id] = inv.name;
          });
        }
      }

      const enriched: Profile[] = (data || []).map((p: Omit<Profile, 'inviter_name'>) => ({
        ...p,
        inviter_name: p.invited_by ? inviterMap[p.invited_by] || p.invited_by : undefined,
      }));

      setProfiles(enriched);
    } catch (err: unknown) {
    } finally {
      setLoadingProfiles(false);
    }
  };

  const openModal = () => {
    setModal({
      open: true,
      role: 'Operador',
      loading: false,
      generatedLink: '',
      copied: false,
      error: '',
    });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, open: false, generatedLink: '', error: '', copied: false }));
  };

  const handleGenerateInvite = async () => {
    if (!currentUser) return;
    setModal(prev => ({ ...prev, loading: true, error: '', generatedLink: '', copied: false }));

    try {
      const token = crypto.randomUUID();

      const { error } = await supabase
        .from('invites')
        .insert({
          token,
          invited_by: currentUser.id,
          role: modal.role,
        });

      if (error) throw error;

      const link = `${window.location.origin}/login?token=${token}`;
      setModal(prev => ({ ...prev, loading: false, generatedLink: link }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar convite.';
      setModal(prev => ({ ...prev, loading: false, error: message }));
    }
  };

  const handleCopyLink = async () => {
    if (!modal.generatedLink) return;
    try {
      await navigator.clipboard.writeText(modal.generatedLink);
      setModal(prev => ({ ...prev, copied: true }));
      setTimeout(() => setModal(prev => ({ ...prev, copied: false })), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = modal.generatedLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setModal(prev => ({ ...prev, copied: true }));
      setTimeout(() => setModal(prev => ({ ...prev, copied: false })), 2000);
    }
  };

  const roleBadgeClass = (role: string) => {
    if (role === 'Root') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    if (role === 'Admin') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  };

  const roleLabel = (role: string) => {
    if (role === 'Root') return 'Root';
    if (role === 'Admin') return 'Administrador';
    return 'Operador';
  };

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                onClick={() => setIsSidebarOpen(true)}
              >
                <UsersIcon size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Usuários</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie usuários e convites</p>
              </div>
            </div>
            <button
              onClick={openModal}
              className="btn-primary flex items-center gap-2"
            >
              <UserPlus size={18} />
              <span className="hidden sm:inline">Gerar Link de Convite</span>
              <span className="sm:hidden">Convidar</span>
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8">
          {/* Tabela de usuários */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <UsersIcon size={18} className="text-primary" />
                Usuários Cadastrados
              </h2>
            </div>

            {loadingProfiles ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-slate-500">Carregando usuários...</span>
              </div>
            ) : profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <UsersIcon size={40} className="mb-3 opacity-30" />
                <p className="text-sm">Nenhum usuário encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-3 text-left">Nome</th>
                      <th className="px-6 py-3 text-left">CPF</th>
                      <th className="px-6 py-3 text-left">Papel</th>
                      <th className="px-6 py-3 text-left">Convidado por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {profiles.map((profile) => (
                      <tr
                        key={profile.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-800 dark:text-white">{profile.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                            {profile.cpf
                              ? profile.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                              : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                            roleBadgeClass(profile.role)
                          )}>
                            <Shield size={11} />
                            {roleLabel(profile.role)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {profile.inviter_name || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal de convite */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-primary" />
                <h3 className="font-semibold text-slate-800 dark:text-white">Gerar Link de Convite</h3>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {modal.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{modal.error}</p>
                </div>
              )}

              {!modal.generatedLink && (
                <>
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Papel do convidado
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setModal(prev => ({ ...prev, role: 'Operador' }))}
                        className={cn(
                          "h-12 rounded-xl border-2 font-semibold text-sm transition-all",
                          modal.role === 'Operador'
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        Operador
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal(prev => ({ ...prev, role: 'Admin' }))}
                        className={cn(
                          "h-12 rounded-xl border-2 font-semibold text-sm transition-all",
                          modal.role === 'Admin'
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                        )}
                      >
                        Admin
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      O papel Root só pode ser criado diretamente no Supabase.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateInvite}
                    disabled={modal.loading}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {modal.loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <LinkIcon size={16} />
                        <span>Gerar Link</span>
                      </>
                    )}
                  </button>
                </>
              )}

              {modal.generatedLink && (
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
                    Link gerado com sucesso! Compartilhe com o convidado.
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Link de convite
                    </label>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <p className="text-xs text-slate-600 dark:text-slate-300 break-all flex-1 font-mono">
                        {modal.generatedLink}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyLink}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 font-semibold text-sm transition-all",
                      modal.copied
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                        : "border-primary bg-primary/5 text-primary hover:bg-primary/10"
                    )}
                  >
                    {modal.copied ? (
                      <>
                        <Check size={16} />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={openModal}
                    className="w-full h-10 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Gerar outro convite
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
