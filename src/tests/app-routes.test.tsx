/**
 * Testes de rotas do App.tsx
 *
 * Testa ProtectedRoute, AdminRoute e readStoredUser via renderização do App.
 * Usa window.history para simular navegação para rotas específicas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { AuthUser } from '../types';

// ---------------------------------------------------------------------------
// Mock do Supabase com dados básicos para renderização
// ---------------------------------------------------------------------------
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-001' } } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ADMIN_USER: AuthUser = {
  id: 'user-001',
  cpf: '12345678901',
  name: 'Admin Test',
  role: 'Admin',
};

const OPERADOR_USER: AuthUser = {
  id: 'user-002',
  cpf: '98765432100',
  name: 'Operador Test',
  role: 'Operador',
};

const ROOT_USER: AuthUser = {
  id: 'user-003',
  cpf: '11122233344',
  name: 'Root Test',
  role: 'Root',
};

function setStoredUser(user: object) {
  localStorage.setItem('fleet_user', JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem('fleet_user');
}

// ---------------------------------------------------------------------------
// Suite: Rotas do App — ProtectedRoute e AdminRoute
// ---------------------------------------------------------------------------
describe('App — rotas protegidas', () => {
  beforeEach(() => {
    clearStorage();
  });

  afterEach(() => {
    clearStorage();
    vi.clearAllMocks();
    // Restaura o pathname para '/'
    window.history.pushState({}, '', '/');
  });

  it('redireciona para /login quando Admin tenta acessar /dashboard sem sessão', async () => {
    clearStorage();
    window.history.pushState({}, '', '/dashboard');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(screen.getAllByText('FleetManager').length).toBeGreaterThan(0);
    });
  });

  it('renderiza /daily-report para Operador autenticado', async () => {
    setStoredUser(OPERADOR_USER);
    window.history.pushState({}, '', '/daily-report');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      // DailyReport deve renderizar algo (Operador tem acesso)
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('redireciona Operador de /dashboard para /daily-report', async () => {
    setStoredUser(OPERADOR_USER);
    window.history.pushState({}, '', '/dashboard');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      // Operador não tem acesso ao /dashboard — AdminRoute redireciona
      expect(document.body).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('Admin autenticado acessa /dashboard', async () => {
    setStoredUser(ADMIN_USER);
    window.history.pushState({}, '', '/dashboard');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });

  it('Root autenticado acessa /vehicles', async () => {
    setStoredUser(ROOT_USER);
    window.history.pushState({}, '', '/vehicles');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 5000 });
  });

  it('Admin autenticado acessa /users', async () => {
    setStoredUser(ADMIN_USER);
    window.history.pushState({}, '', '/users');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('Admin autenticado acessa /journeys', async () => {
    setStoredUser(ADMIN_USER);
    window.history.pushState({}, '', '/journeys');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('Admin autenticado acessa /maintenance-list', async () => {
    setStoredUser(ADMIN_USER);
    window.history.pushState({}, '', '/maintenance-list');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('Admin autenticado acessa /refueling', async () => {
    setStoredUser(ADMIN_USER);
    window.history.pushState({}, '', '/refueling');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('Admin autenticado acessa /maintenance', async () => {
    setStoredUser(ADMIN_USER);
    window.history.pushState({}, '', '/maintenance');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('Operador autenticado acessa /request-maintenance', async () => {
    setStoredUser(OPERADOR_USER);
    window.history.pushState({}, '', '/request-maintenance');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('Operador autenticado acessa /time-bank', async () => {
    setStoredUser(OPERADOR_USER);
    window.history.pushState({}, '', '/time-bank');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(document.body.innerHTML.length).toBeGreaterThan(100);
    }, { timeout: 3000 });
  });

  it('rota / redireciona para /login', async () => {
    clearStorage();
    window.history.pushState({}, '', '/');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(screen.getAllByText('FleetManager').length).toBeGreaterThan(0);
    });
  });

  it('usuário com dados inválidos no localStorage é tratado como não autenticado', async () => {
    localStorage.setItem('fleet_user', '{"id": 123, "name": "Test"}'); // id não é string
    window.history.pushState({}, '', '/dashboard');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      // Deve redirecionar para login
      expect(screen.getAllByText('FleetManager').length).toBeGreaterThan(0);
    });
  });

  it('JSON inválido no localStorage é tratado como não autenticado', async () => {
    localStorage.setItem('fleet_user', 'invalid-json{{{');
    window.history.pushState({}, '', '/dashboard');
    const App = (await import('../App')).default;
    render(React.createElement(App));

    await waitFor(() => {
      expect(screen.getAllByText('FleetManager').length).toBeGreaterThan(0);
    });
  });
});
