import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Refueling from './pages/Refueling';
import Maintenance from './pages/Maintenance';
import DailyReport from './pages/DailyReport';
import RequestMaintenance from './pages/RequestMaintenance';
import Vehicles from './pages/Vehicles';
import Journeys from './pages/Journeys';
import MaintenanceList from './pages/MaintenanceList';
import TimeBank from './pages/TimeBank';
import Users from './pages/Users';
import { supabase } from './lib/supabase';
import { AuthUser } from './types';

/**
 * Lê o usuário autenticado do localStorage e valida o formato mínimo esperado.
 * Retorna null se não houver sessão válida.
 */
function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('fleet_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.cpf === 'string' &&
      typeof parsed.name === 'string' &&
      (parsed.role === 'Root' || parsed.role === 'Admin' || parsed.role === 'Operador')
    ) {
      return parsed as AuthUser;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Rota protegida: exige usuário autenticado.
 * Redireciona para /login se não houver sessão ativa.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = readStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Rota exclusiva para Admin e Root.
 * Redireciona para /login se não autenticado.
 * Redireciona Operador para /daily-report.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = readStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'Operador') return <Navigate to="/daily-report" replace />;
  return <>{children}</>;
}

export default function App() {
  // Estado de carregamento da sessão — evita flash de redirecionamento no refresh
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Verifica sessão ativa no Supabase na montagem
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // Sessão Supabase expirou — limpa localStorage para manter consistência
        localStorage.removeItem('fleet_user');
      }
      setSessionChecked(true);
    });

    // Sincroniza o estado local com mudanças na sessão do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('fleet_user');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Aguarda verificação de sessão antes de renderizar as rotas protegidas
  if (!sessionChecked) return null;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Rotas exclusivas para Admin e Root */}
        <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/vehicles" element={<AdminRoute><Vehicles /></AdminRoute>} />
        <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="/journeys" element={<AdminRoute><Journeys /></AdminRoute>} />
        <Route path="/maintenance-list" element={<AdminRoute><MaintenanceList /></AdminRoute>} />
        <Route path="/refueling" element={<AdminRoute><Refueling /></AdminRoute>} />
        <Route path="/maintenance" element={<AdminRoute><Maintenance /></AdminRoute>} />

        {/* Rotas acessíveis por qualquer usuário autenticado */}
        <Route path="/daily-report" element={<ProtectedRoute><DailyReport /></ProtectedRoute>} />
        <Route path="/request-maintenance" element={<ProtectedRoute><RequestMaintenance /></ProtectedRoute>} />
        <Route path="/time-bank" element={<ProtectedRoute><TimeBank /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
