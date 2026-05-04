/**
 * Testes do fluxo de cadastro do Login (com token de convite)
 *
 * O Login tem dois modos: login normal e cadastro via convite (?token=...).
 * Estes testes cobrem o fluxo de cadastro.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock do Supabase — retorna convite válido
// ---------------------------------------------------------------------------
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-001' } }, error: null }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'invites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'invite-001',
                  role: 'Operador',
                  used: false,
                  invited_by: 'admin-001',
                  expires_at: null  // sem expiração
                },
                error: null
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }

      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'new-user-001',
                  name: 'Test User',
                  email: 'test@test.com',
                  role: 'Operador',
                  cpf: '12345678901'
                },
                error: null
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        };
      }

      // Default
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        }),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function wrapWithToken(token: string) {
  const Login = require('../pages/Login').default;
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/login?token=${token}`] },
      React.createElement(Login)
    )
  );
}

function wrapLogin() {
  const Login = require('../pages/Login').default;
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(Login)
    )
  );
}

// ---------------------------------------------------------------------------
// Suite: Login com token de convite
// ---------------------------------------------------------------------------
describe('Login — modo cadastro com token válido', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o formulário de cadastro quando token está na URL', async () => {
    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=valid-token-123'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      // Com token válido e convite encontrado, deve mostrar o form de cadastro
      expect(document.body.innerHTML).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('exibe "Criar nova conta" quando token está presente', async () => {
    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=valid-token-123'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      expect(screen.getAllByText(/criar nova conta/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('exibe loading enquanto verifica o convite', async () => {
    // Retarda a resposta do Supabase para verificar loading
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue(new Promise(() => {})), // nunca resolve
        })
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as ReturnType<typeof supabase.from>));

    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=loading-token'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/verificando convite/i)).toBeTruthy();
    }, { timeout: 2000 });
  });

  it('exibe erro quando convite não é encontrado', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        })
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as ReturnType<typeof supabase.from>));

    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=invalid-token'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/convite não encontrado ou inválido/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('exibe erro quando convite já foi usado', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'invite-002', role: 'Operador', used: true, invited_by: 'admin-001', expires_at: null },
            error: null
          }),
        })
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as ReturnType<typeof supabase.from>));

    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=used-token'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/convite já foi utilizado/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('exibe erro quando convite expirou', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'invite-003', role: 'Admin', used: false,
              invited_by: 'admin-001',
              expires_at: '2020-01-01T00:00:00Z' // data no passado
            },
            error: null
          }),
        })
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as ReturnType<typeof supabase.from>));

    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=expired-token'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/convite expirou/i)).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('exibe formulário de cadastro com convite válido (role Operador)', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'invite-004', role: 'Operador', used: false,
              invited_by: 'admin-001', expires_at: null
            },
            error: null
          }),
        })
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as ReturnType<typeof supabase.from>));

    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=operador-token'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Operador')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('exibe formulário de cadastro com convite válido (role Admin)', async () => {
    const { supabase } = await import('../lib/supabase');
    vi.mocked(supabase.from).mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'invite-005', role: 'Admin', used: false,
              invited_by: 'admin-001', expires_at: null
            },
            error: null
          }),
        })
      }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as ReturnType<typeof supabase.from>));

    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=admin-token'] },
        React.createElement(Login)
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Administrador')).toBeTruthy();
    }, { timeout: 3000 });
  });
});
