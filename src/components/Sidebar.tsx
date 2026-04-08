import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Truck, Car, BarChart3, User, LogOut, Mail, Phone, Shield, ChevronDown, Play, Clock, Wrench, X, AlertCircle, Users } from 'lucide-react';
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
  { icon: Users, label: 'Usuários', path: '/users', rootOnly: true },
  { icon: User, label: 'Perfil', path: '/profile' },
];

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [maintenanceCount, setMaintenanceCount] = useState(0);
  const [journeyCount, setJourneyCount] = useState(0);

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Root')) return;
      
      try {
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
          
        setMaintenanceCount((pendingReqCount || 0) + (overdueMainCount || 0));
        setJourneyCount(pendingJourneysCount || 0);
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
          <div className="bg-blue-600 rounded-xl p-2.5 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
            <Truck className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Gestor Frota</h1>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const userRole = currentUser?.role;
          if (item.adminOnly && userRole !== 'Admin' && userRole !== 'Root') return null;
          if (item.rootOnly && userRole !== 'Root') return null;
          
          const isActive = location.pathname === item.path;
          
          if (item.label === 'Perfil') {
            return (
              <div key={item.label} className="relative profile-dropdown-container">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-xl font-medium transition-all duration-200",
                    isProfileOpen || isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <item.icon size={22} className={cn(isActive || isProfileOpen ? "text-white" : "text-slate-500")} />
                    <span className="text-[15px]">{item.label}</span>
                  </div>
                  <ChevronDown size={16} className={cn("transition-transform duration-200", isProfileOpen && "rotate-180")} />
                </button>

                {isProfileOpen && currentUser && (
                  <div className="absolute left-full ml-2 top-0 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 z-50 animate-in slide-in-from-left-2 duration-200">
                    <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100 dark:border-slate-800">
                      <img
                        alt="Profile"
                        className="w-14 h-14 rounded-full border-2 border-blue-100 object-cover"
                        src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`}
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{currentUser?.name || 'Usuário'}</p>
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mt-1">{currentUser?.role || 'Motorista'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <Mail size={16} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">E-mail</p>
                          <p className="text-slate-600 dark:text-slate-300 truncate font-medium">{currentUser.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <Phone size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Telefone</p>
                          <p className="text-slate-600 dark:text-slate-300 font-medium">{currentUser.phone || '(11) 99999-9999'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                          <Shield size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Nível de Acesso</p>
                          <p className="text-slate-600 dark:text-slate-300 font-medium">
                            {currentUser.role === 'Root' ? 'Super Usuário' : currentUser.role === 'Admin' ? 'Administrador' : 'Motorista'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => {
                          navigate('/profile');
                          setIsProfileOpen(false);
                          if (onClose) onClose();
                        }}
                        className="w-full py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all duration-200"
                      >
                        Ver Perfil Completo
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
                "flex items-center justify-between px-3 py-3 rounded-xl font-medium transition-all duration-200",
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <div className="flex items-center gap-4">
                <item.icon size={22} className={cn(isActive ? "text-white" : "text-slate-500")} />
                <span className="text-[15px]">{item.label}</span>
              </div>
              {item.label === 'Manutenções' && maintenanceCount > 0 && (
                <span className={cn(
                  "flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold",
                  isActive ? "bg-white text-blue-600" : "bg-red-500 text-white"
                )}>
                  {maintenanceCount}
                </span>
              )}
              {item.label === 'Jornadas' && journeyCount > 0 && (
                <span className={cn(
                  "flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold",
                  isActive ? "bg-white text-blue-600" : "bg-orange-500 text-white"
                )}>
                  {journeyCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2">
          <div className="relative">
            <img
              alt="Profile"
              className="w-11 h-11 rounded-full border-2 border-slate-100 dark:border-slate-700 object-cover"
              src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`}
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-[14px] font-bold truncate dark:text-white leading-tight">{currentUser?.name || 'Usuário'}</p>
            <p className="text-[12px] text-slate-500 font-medium">{currentUser?.role || 'Motorista'}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
            title="Sair"
          >
            <LogOut size={20} />
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
        "fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-transform duration-300 md:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {SidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden md:flex">
        {SidebarContent}
      </aside>
    </>
  );
}
