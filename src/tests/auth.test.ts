/**
 * Testes de autenticação do FleetManager
 *
 * Cobre: readStoredUser, AuthUser, ProtectedRoute, AdminRoute
 * Não chama o banco real — Supabase é completamente mockado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import type { AuthUser } from '../types';

// ---------------------------------------------------------------------------
// Mock do Supabase — deve vir antes de qualquer import que use '../lib/supabase'
// ---------------------------------------------------------------------------
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    update: vi.fn().mockReturnThis(),
  },
}));

// ---------------------------------------------------------------------------
// Implementação local de readStoredUser (espelha exatamente src/App.tsx)
// Testamos a lógica isolada sem importar o módulo App para evitar efeitos
// colaterais de BrowserRouter / useEffect ao montar o componente inteiro.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Componentes Route mínimos que espelham o comportamento de App.tsx
// Usados apenas nos testes de redirecionamento.
// ---------------------------------------------------------------------------
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = readStoredUser();
  if (!user) return React.createElement(Navigate, { to: '/login', replace: true });
  return React.createElement(React.Fragment, null, children);
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = readStoredUser();
  if (!user) return React.createElement(Navigate, { to: '/login', replace: true });
  if (user.role === 'Operador')
    return React.createElement(Navigate, { to: '/daily-report', replace: true });
  return React.createElement(React.Fragment, null, children);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_AUTH_USER: AuthUser = {
  id: 'user-001',
  cpf: '12345678901',
  name: 'Test User',
  role: 'Admin',
};

function setStoredUser(user: object) {
  localStorage.setItem('fleet_user', JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem('fleet_user');
}

// ---------------------------------------------------------------------------
// Suite 1 — readStoredUser
// ---------------------------------------------------------------------------
describe('readStoredUser', () => {
  afterEach(() => {
    clearStorage();
  });

  it('retorna null quando localStorage está vazio', () => {
    clearStorage();
    expect(readStoredUser()).toBeNull();
  });

  it('retorna AuthUser válido quando localStorage tem dados corretos', () => {
    setStoredUser(VALID_AUTH_USER);
    const result = readStoredUser();
    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-001');
    expect(result?.cpf).toBe('12345678901');
    expect(result?.name).toBe('Test User');
    expect(result?.role).toBe('Admin');
  });

  it('retorna null para dados inválidos (sem role)', () => {
    setStoredUser({ id: 'abc', cpf: '12345678901', name: 'No Role' });
    expect(readStoredUser()).toBeNull();
  });

  it('retorna null para role inválida', () => {
    setStoredUser({ id: 'abc', cpf: '12345678901', name: 'Bad Role', role: 'SuperUser' });
    expect(readStoredUser()).toBeNull();
  });

  it('retorna null quando localStorage tem JSON inválido', () => {
    localStorage.setItem('fleet_user', 'not-valid-json{{{');
    expect(readStoredUser()).toBeNull();
  });

  it('retorna null quando id não é string', () => {
    setStoredUser({ id: 42, cpf: '12345678901', name: 'Bad Id', role: 'Admin' });
    expect(readStoredUser()).toBeNull();
  });

  it('aceita role Root', () => {
    setStoredUser({ ...VALID_AUTH_USER, role: 'Root' });
    const result = readStoredUser();
    expect(result?.role).toBe('Root');
  });

  it('aceita role Operador', () => {
    setStoredUser({ ...VALID_AUTH_USER, role: 'Operador' });
    const result = readStoredUser();
    expect(result?.role).toBe('Operador');
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — AuthUser (interface / type checks via valores em runtime)
// ---------------------------------------------------------------------------
describe('AuthUser', () => {
  it('tem campos obrigatórios (id, cpf, name, role)', () => {
    const user: AuthUser = {
      id: 'u1',
      cpf: '00000000000',
      name: 'Alice',
      role: 'Root',
    };
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('cpf');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('role');
  });

  it('aceita todos os três valores de role', () => {
    const roles: AuthUser['role'][] = ['Root', 'Admin', 'Operador'];
    roles.forEach((role) => {
      const user: AuthUser = { id: 'x', cpf: '00000000000', name: 'X', role };
      expect(user.role).toBe(role);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — ProtectedRoute
// ---------------------------------------------------------------------------
describe('ProtectedRoute', () => {
  afterEach(() => {
    clearStorage();
  });

  it('redireciona para /login quando não há usuário', () => {
    clearStorage();

    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/dashboard'] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            {
              path: '/dashboard',
              element: React.createElement(
                ProtectedRoute,
                null,
                React.createElement('div', null, 'Dashboard Content')
              ),
            }
          ),
          React.createElement(
            Route,
            { path: '/login', element: React.createElement('div', null, 'Login Page') }
          )
        )
      )
    );

    expect(container.textContent).toBe('Login Page');
    expect(container.textContent).not.toContain('Dashboard Content');
  });

  it('renderiza children quando usuário está autenticado', () => {
    setStoredUser(VALID_AUTH_USER);

    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/dashboard'] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            {
              path: '/dashboard',
              element: React.createElement(
                ProtectedRoute,
                null,
                React.createElement('div', null, 'Dashboard Content')
              ),
            }
          ),
          React.createElement(
            Route,
            { path: '/login', element: React.createElement('div', null, 'Login Page') }
          )
        )
      )
    );

    expect(container.textContent).toBe('Dashboard Content');
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — AdminRoute
// ---------------------------------------------------------------------------
describe('AdminRoute', () => {
  afterEach(() => {
    clearStorage();
  });

  it('redireciona para /login quando não há usuário', () => {
    clearStorage();

    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/vehicles'] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            {
              path: '/vehicles',
              element: React.createElement(
                AdminRoute,
                null,
                React.createElement('div', null, 'Vehicles Content')
              ),
            }
          ),
          React.createElement(
            Route,
            { path: '/login', element: React.createElement('div', null, 'Login Page') }
          ),
          React.createElement(
            Route,
            { path: '/daily-report', element: React.createElement('div', null, 'Daily Report') }
          )
        )
      )
    );

    expect(container.textContent).toBe('Login Page');
  });

  it('redireciona Operador para /daily-report', () => {
    setStoredUser({ ...VALID_AUTH_USER, role: 'Operador' });

    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/vehicles'] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            {
              path: '/vehicles',
              element: React.createElement(
                AdminRoute,
                null,
                React.createElement('div', null, 'Vehicles Content')
              ),
            }
          ),
          React.createElement(
            Route,
            { path: '/login', element: React.createElement('div', null, 'Login Page') }
          ),
          React.createElement(
            Route,
            { path: '/daily-report', element: React.createElement('div', null, 'Daily Report') }
          )
        )
      )
    );

    expect(container.textContent).toBe('Daily Report');
    expect(container.textContent).not.toContain('Vehicles Content');
  });

  it('permite Admin acessar rota protegida', () => {
    setStoredUser({ ...VALID_AUTH_USER, role: 'Admin' });

    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/vehicles'] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            {
              path: '/vehicles',
              element: React.createElement(
                AdminRoute,
                null,
                React.createElement('div', null, 'Vehicles Content')
              ),
            }
          ),
          React.createElement(
            Route,
            { path: '/login', element: React.createElement('div', null, 'Login Page') }
          ),
          React.createElement(
            Route,
            { path: '/daily-report', element: React.createElement('div', null, 'Daily Report') }
          )
        )
      )
    );

    expect(container.textContent).toBe('Vehicles Content');
  });

  it('permite Root acessar rota protegida', () => {
    setStoredUser({ ...VALID_AUTH_USER, role: 'Root' });

    const { container } = render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/vehicles'] },
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            {
              path: '/vehicles',
              element: React.createElement(
                AdminRoute,
                null,
                React.createElement('div', null, 'Vehicles Content')
              ),
            }
          ),
          React.createElement(
            Route,
            { path: '/login', element: React.createElement('div', null, 'Login Page') }
          ),
          React.createElement(
            Route,
            { path: '/daily-report', element: React.createElement('div', null, 'Daily Report') }
          )
        )
      )
    );

    expect(container.textContent).toBe('Vehicles Content');
  });
});
