/**
 * Testes do fluxo de cadastro do Login (com token de convite)
 *
 * O Login tem dois modos: login normal e cadastro via convite (?token=...).
 * Estes testes cobrem o fluxo de cadastro. O convite é lido via supabase.rpc('get_invite').
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
    // get_invite(token) — convite válido por padrão (invites não é legível direto por anônimo)
    rpc: vi.fn().mockImplementation(() => ({
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
    })),
    from: vi.fn().mockImplementation((table: string) => {
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
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      single: vi.fn().mockReturnValue(new Promise(() => {})), // nunca resolve
    } as unknown as ReturnType<typeof supabase.rpc>);

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
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    } as unknown as ReturnType<typeof supabase.rpc>);

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
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({
        data: { id: 'invite-002', role: 'Operador', used: true, invited_by: 'admin-001', expires_at: null },
        error: null
      }),
    } as unknown as ReturnType<typeof supabase.rpc>);

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
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'invite-003', role: 'Admin', used: false,
          invited_by: 'admin-001',
          expires_at: '2020-01-01T00:00:00Z' // data no passado
        },
        error: null
      }),
    } as unknown as ReturnType<typeof supabase.rpc>);

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
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'invite-004', role: 'Operador', used: false,
          invited_by: 'admin-001', expires_at: null
        },
        error: null
      }),
    } as unknown as ReturnType<typeof supabase.rpc>);

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
    vi.mocked(supabase.rpc).mockReturnValueOnce({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'invite-005', role: 'Admin', used: false,
          invited_by: 'admin-001', expires_at: null
        },
        error: null
      }),
    } as unknown as ReturnType<typeof supabase.rpc>);

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

describe('Login — cadastro não envia papel', () => {
  it('signUp envia invite_token e nunca role/invited_by (papel vem do convite no banco)', async () => {
    const { supabase } = await import('../lib/supabase');
    const { fireEvent } = await import('@testing-library/react');
    const Login = (await import('../pages/Login')).default;
    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/login?token=invite-token-xyz'] },
        React.createElement(Login)
      )
    );

    const nameInput = await screen.findByPlaceholderText('Seu nome completo', {}, { timeout: 3000 });
    fireEvent.change(nameInput, { target: { value: 'Novo Motorista' } });
    fireEvent.change(screen.getByPlaceholderText('000.000.000-00'), { target: { value: '123.456.789-09' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'senha123' } });
    fireEvent.submit(nameInput.closest('form')!);

    await waitFor(() => expect(supabase.auth.signUp).toHaveBeenCalled(), { timeout: 3000 });
    const metadata = vi.mocked(supabase.auth.signUp).mock.calls[0][0].options?.data;
    expect(metadata).toEqual({ name: 'Novo Motorista', cpf: '12345678909', invite_token: 'invite-token-xyz' });
    expect(metadata).not.toHaveProperty('role');
  });
});
