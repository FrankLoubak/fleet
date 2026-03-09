import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Truck, Car, BarChart3, User, LogOut, Mail, Phone, Shield, ChevronDown, Play, Clock } from 'lucide-react';
import { cn } from '../utils';
import { User as UserType } from '../types';

const navItems = [
  { icon: Play, label: 'Início', path: '/daily-report' },
  { icon: Car, label: 'Veículos', path: '/vehicles' },
  { icon: Clock, label: 'Jornadas', path: '/journeys', adminOnly: true },
  { icon: BarChart3, label: 'Relatórios', path: '/dashboard', adminOnly: true },
  { icon: User, label: 'Perfil', path: '/profile' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const userJson = localStorage.getItem('fleet_user');
    if (userJson) {
      setCurrentUser(JSON.parse(userJson));
    }
  }, []);

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

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden lg:flex">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary rounded-lg p-2 flex items-center justify-center">
          <Truck className="text-white w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight dark:text-white">Gestor Frota</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
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
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => navigate('/profile')}
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
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
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
    </aside>
  );
}
