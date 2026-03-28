import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Truck, Car, BarChart3, User, LogOut, Mail, Phone, Shield, ChevronDown, Play, Clock, Wrench, X, AlertCircle } from 'lucide-react';
import { cn } from '../utils';
import { User as UserType } from '../types';
import { supabase } from '../lib/supabase';

const navItems = [
  { icon: Play, label: 'Início', path: '/daily-report' },
  { icon: Car, label: 'Veículos', path: '/vehicles' },
  { icon: Wrench, label: 'Manutenções', path: '/maintenance-list', adminOnly: true },
  { icon: Clock, label: 'Jornadas', path: '/journeys', adminOnly: true },
  { icon: Clock, label: 'Banco de Horas', path: '/time-bank' },
  { icon: BarChart3, label: 'Relatórios', path: '/dashboard', adminOnly: true },
  { icon: User, label: 'Perfil', path: '/profile' },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!currentUser || currentUser.role !== 'Admin') return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        
        const { count: pendingReqCount } = await supabase
          .from('maintenance_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente');
          
        const { count: overdueMainCount } = await supabase
          .from('maintenances')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pendente');
          
        const { count: pendingJourneysCount } = await supabase
          .from('journeys')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'encerrada')
          .eq('validation_status', 'pendente');
          
        setAlertCount((pendingReqCount || 0) + (overdueMainCount || 0) + (pendingJourneysCount || 0));
      } catch (err) {
        console.error('Error fetching alerts for sidebar:', err);
      }
    };
    
    fetchAlerts();
  }, [currentUser]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.profile-dropdown-container')) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = () => {
    localStorage.removeItem('fleet_user');
    navigate('/login');
  };

  if (!currentUser) return null;

  const SidebarContent = (
    <>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-lg p-2 flex items-center justify-center">
            <Truck className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight dark:text-white">Gestor Frota</h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && currentUser.role !== 'Admin') return null;
          
          const isActive = location.pathname === item.path;
          
          if (item.label === 'Perfil') {
            return (
              <div key={item.label} className="relative profile-dropdown-container">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-colors",
                    isProfileOpen || isActive
                      ? "bg-primary text-white"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown size={16} className={cn("transition-transform", isProfileOpen && "rotate-180")} />
                </button>

                {isProfileOpen && currentUser && (
                  <div className="absolute left-full ml-2 top-0 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in slide-in-from-left-2 duration-200">
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <img
                        alt="Profile"
                        className="w-12 h-12 rounded-full border-2 border-primary/20 object-cover"
                        src={currentUser.avatar}
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                        <p className="text-xs text-primary font-bold uppercase tracking-wider">{currentUser.role}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <Mail size={14} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">E-mail</p>
                          <p className="text-slate-600 dark:text-slate-300 truncate">{currentUser.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <Phone size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Telefone</p>
                          <p className="text-slate-600 dark:text-slate-300">{currentUser.phone || '(11) 99999-9999'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <Shield size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Nível de Acesso</p>
                          <p className="text-slate-600 dark:text-slate-300">{currentUser.role === 'Admin' ? 'Administrador' : 'Motorista'}</p>
                        </div>
                      </div>

                      {alertCount > 0 && (
                        <div className="flex items-center gap-3 text-sm p-2 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/20">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                            <AlertCircle size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] text-orange-500 uppercase font-bold">Alertas Ativos</p>
                            <p className="text-orange-700 dark:text-orange-400 font-bold">{alertCount} pendências</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => {
                          navigate('/profile');
                          if (onClose) onClose();
                        }}
                        className="w-full py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      >
                        Editar Perfil Completo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (onClose) onClose();
              }}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} />
                <span>{item.label}</span>
              </div>
              {item.label === 'Manutenções' && alertCount > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  isActive ? "bg-white text-primary" : "bg-red-500 text-white"
                )}>
                  {alertCount}
                </span>
              )}
              {item.label === 'Jornadas' && alertCount > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  isActive ? "bg-white text-primary" : "bg-amber-500 text-white"
                )}>
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <img
            alt="Profile"
            className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
            src={currentUser.avatar}
            referrerPolicy="no-referrer"
          />
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate dark:text-white">{currentUser.name}</p>
            <p className="text-xs text-slate-500">{currentUser.role}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-transform duration-300 md:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {SidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden md:flex">
        {SidebarContent}
      </aside>
    </>
  );
}
