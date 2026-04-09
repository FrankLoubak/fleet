import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users as UsersIcon, UserPlus, Search, Shield, Mail, Phone, MoreVertical, Edit2, Trash2, Share2, Check, Copy, RefreshCw, AlertCircle, Loader2, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { cn } from '../utils';
import { toast } from 'react-hot-toast';

export default function Users() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Motorista' | 'Root'>('Motorista');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setCurrentUser(user);
      
      // Restrict access to Root only
      if (user.role !== 'Root') {
        toast.error('Acesso restrito ao usuário Root');
        navigate('/daily-report');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Erro ao carregar usuários. Verifique suas permissões no banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'Root') {
      fetchUsers();
    }
  }, [currentUser]);

  const generateInviteLink = async () => {
    setGeneratingInvite(true);
    try {
      const baseUrl = window.location.origin;
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Save invite to database
      const { error } = await supabase
        .from('invites')
        .insert([
          { 
            token, 
            role: inviteRole, 
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
          }
        ]);

      if (error) {
        console.warn('Invite table might not exist yet, using fallback method');
        // Fallback if table doesn't exist
        const fallbackToken = btoa(new Date().getTime().toString()).substring(0, 12);
        setInviteLink(`${baseUrl}/login?invite=${fallbackToken}`);
      } else {
        setInviteLink(`${baseUrl}/login?invite=${token}`);
      }
      
      setCopied(false);
      toast.success('Novo link de convite gerado!');
    } catch (err: any) {
      console.error('Error generating invite:', err);
      toast.error('Erro ao gerar link de convite');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = users.filter(user => 
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.cpf || '').includes(searchTerm)
  );

  if (!currentUser || currentUser.role !== 'Root') return null;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UsersIcon className="text-blue-600" />
                Gestão de Usuários
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie motoristas, administradores e permissões do sistema.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setShowInviteModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all border border-blue-100 dark:border-blue-900/30"
              >
                <Share2 size={18} />
                <span>Gerar Convite</span>
              </button>
              <button className="btn-primary flex items-center justify-center gap-2 px-6">
                <UserPlus size={20} />
                <span>Novo Usuário</span>
              </button>
            </div>
          </div>

          {/* Invite Modal */}
          {showInviteModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                    <Share2 size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Convidar Usuário</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">
                    Gere um link de convite para que novos usuários possam se cadastrar no sistema. O link expira em 24 horas.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nível de Acesso</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Motorista', 'Admin', 'Root'] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => setInviteRole(r)}
                            className={cn(
                              "py-2 rounded-lg text-xs font-bold border-2 transition-all",
                              inviteRole === r 
                                ? "border-blue-600 bg-blue-50 text-blue-600" 
                                : "border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200"
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {inviteLink ? (
                      <div className="relative">
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 pr-12 font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                          {inviteLink}
                        </div>
                        <button 
                          onClick={handleCopyLink}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center">
                        <p className="text-sm text-slate-400">Nenhum link gerado ainda</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={generateInviteLink}
                      disabled={generatingInvite}
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                    >
                      {generatingInvite ? <RefreshCw size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                      <span>{inviteLink ? 'Gerar Novo Link' : 'Gerar Link de Convite'}</span>
                    </button>
                    <button 
                      onClick={() => setShowInviteModal(false)}
                      className="w-full py-3 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
              <button onClick={fetchUsers} className="ml-auto text-xs font-bold underline">Tentar novamente</button>
            </div>
          )}

          <div className="card p-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou CPF..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                  </div>
                </div>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div key={user.id} className="card p-6 hover:shadow-xl transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                        alt={user.name}
                        className="w-14 h-14 rounded-full border-2 border-slate-100 dark:border-slate-800 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{user.name}</h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          user.role === 'Root' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                          user.role === 'Admin' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          {user.role}
                        </span>
                      </div>
                    </div>
                    <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <MoreVertical size={20} />
                    </button>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <Mail size={16} className="text-slate-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                      <Shield size={16} className="text-slate-400" />
                      <span>CPF: {user.cpf ? user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : 'Não informado'}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                        <Phone size={16} className="text-slate-400" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <button className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      <Edit2 size={14} />
                      Editar
                    </button>
                    <button className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={14} />
                      Excluir
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <UsersIcon size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhum usuário encontrado</h3>
                <p className="text-slate-500 dark:text-slate-400">Tente ajustar sua busca ou adicione um novo usuário.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
