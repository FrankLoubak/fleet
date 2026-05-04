import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, User } from 'lucide-react';
import { cn } from '../utils';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Admin' | 'Motorista' | 'Gestor Frota'>('Motorista');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isInviteValid, setIsInviteValid] = useState(false);
  const navigate = useNavigate();

  // Busca convite pelo token quando a URL tem ?token=XXXX
  useEffect(() => {
    if (!token) return;

    const fetchInvite = async () => {
      setInviteLoading(true);
      setInviteError('');
      try {
        const { data, error } = await supabase
          .from('invites')
          .select('id, role, used, invited_by, expires_at')
          .eq('token', token)
          .single();

        if (error || !data) {
          setInviteError('Convite não encontrado ou inválido.');
          return;
        }

        if (data.used) {
          setInviteError('Este convite já foi utilizado.');
          return;
        }

        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setInviteError('Este convite expirou.');
          return;
        }

        setInviteRole(data.role);
        setInviteId(data.id);
        setInvitedBy(data.invited_by);
      } catch (_err: unknown) {
        setInviteError('Erro ao verificar convite.');
      } finally {
        setInviteLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

  const validateInvite = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        console.warn('Invalid or expired invite token');
        setIsInviteValid(false);
        // If it's a legacy token (from btoa), we might want to allow it for now
        if (token.length === 12) {
           setIsInviteValid(true);
        }
      } else {
        setIsInviteValid(true);
        setRole(data.role as 'Admin' | 'Motorista' | 'Gestor Frota');
        setIsSignUp(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Clean CPF (remove dots and dashes)
      const cleanCpf = cpf.replace(/\D/g, '');
      if (cleanCpf.length !== 11) {
        throw new Error('CPF deve ter 11 dígitos.');
      }

      let loginEmail = `${cleanCpf}@fleetmanager.com`;

      // Buscar e-mail associado ao CPF na tabela profiles
      const { data: profileLookup, error: lookupError } = await supabase
        .from('profiles')
        .select('email')
        .eq('cpf', cleanCpf)
        .single();

      if (profileLookup?.email) {
        loginEmail = profileLookup.email;
      } else if (lookupError) {
        // CPF não encontrado em profiles — prossegue com e-mail padrão derivado do CPF
      }

      if (isSignUp) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: {
            data: {
              name,
              role,
              cpf: cleanCpf,
            }
          }
        });

        if (signUpError) throw signUpError;
        
        if (signUpData.user) {
          // Mark invite as used if applicable
          if (inviteToken && isInviteValid) {
            await supabase
              .from('invites')
              .update({ used_at: new Date().toISOString() })
              .eq('token', inviteToken);
          }

          setSuccess('Conta criada com sucesso! Você já pode entrar agora.');
          setIsSignUp(false);
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          // Fetch profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (profileError) throw profileError;

        // Erro ao buscar jornadas abertas é não-bloqueante; segue com o redirecionamento padrão
        void journeyError;

          if (journeyError) console.error('Error checking journeys', journeyError);

          const hasOpenJourney = openJourneys && openJourneys.length > 0;

          if (hasOpenJourney || profile.role === 'Motorista') {
            navigate('/daily-report');
          } else {
            navigate('/dashboard');
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao processar solicitação. Tente novamente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-primary/20 p-4 rounded-xl">
            <Truck className="text-primary w-12 h-12" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">FleetManager</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Gestão inteligente de frotas</p>
          </div>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold mb-6 text-center">
            {isSignUp ? 'Criar nova conta' : 'Bem-vindo de volta'}
          </h2>
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 text-green-600 dark:text-green-400 text-sm animate-in fade-in slide-in-from-top-1">
              <Truck size={18} className="shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {/* Formulário de Cadastro via Token */}
          {isSignUp && (
            <>
              {inviteLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-slate-500">Verificando convite...</span>
                </div>
              )}

              {!inviteLoading && inviteError && (
                <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle size={18} className="shrink-0" />
                  <p>{inviteError}</p>
                </div>
              )}

              {!inviteLoading && !inviteError && inviteRole && (
                <form onSubmit={handleSignUp} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1" htmlFor="name">
                      Nome Completo
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                        <User size={20} />
                      </div>
                      <input
                        id="name"
                        type="text"
                        className="input-field pl-10"
                        placeholder="Seu nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1" htmlFor="cpf-signup">
                      CPF
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                        <User size={20} />
                      </div>
                      <input
                        id="cpf-signup"
                        type="text"
                        className="input-field pl-10"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 11) {
                            setCpf(value);
                          }
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                      Nível de Acesso
                    </label>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <Shield size={18} className="text-primary shrink-0" />
                      <span className="text-sm font-semibold text-primary">{roleLabel}</span>
                      <span className="text-xs text-slate-400 ml-auto">(definido pelo convite)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1" htmlFor="password-signup">
                      Senha
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                        <Lock size={20} />
                      </div>
                      <input
                        id="password-signup"
                        type={showPassword ? 'text' : 'password'}
                        className="input-field pl-10 pr-12"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="off"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Criando conta...</span>
                      </div>
                    ) : (
                      'Criar Conta'
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Formulário de Login */}
          {!isSignUp && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1" htmlFor="cpf">
                  CPF
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <User size={20} />
                  </div>
                  <input
                    id="cpf"
                    type="text"
                    className="input-field pl-10"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 11) {
                        setCpf(value);
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
                    Senha
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                      <User size={20} />
                    </div>
                    <input
                      id="name"
                      type="text"
                      className="input-field pl-10"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pl-10 pr-12"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                    Tipo de Acesso
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('Motorista')}
                      className={cn(
                        "h-12 rounded-xl border-2 font-bold transition-all",
                        role === 'Motorista' 
                          ? "border-primary bg-primary/5 text-primary" 
                          : "border-slate-200 dark:border-slate-800 text-slate-500"
                      )}
                    >
                      Motorista
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('Gestor Frota')}
                      className={cn(
                        "h-12 rounded-xl border-2 font-bold transition-all",
                        role === 'Gestor Frota' 
                          ? "border-primary bg-primary/5 text-primary" 
                          : "border-slate-200 dark:border-slate-800 text-slate-500"
                      )}
                    >
                      Gestor Frota
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('Admin')}
                      className={cn(
                        "h-12 rounded-xl border-2 font-bold transition-all",
                        role === 'Admin' 
                          ? "border-primary bg-primary/5 text-primary" 
                          : "border-slate-200 dark:border-slate-800 text-slate-500"
                      )}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1" htmlFor="cpf">
                CPF
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <User size={20} />
                </div>
                <input
                  id="cpf"
                  type="text"
                  className="input-field pl-10"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => {
                    // Simple mask for CPF
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      setCpf(value);
                    }
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">
                  Senha
                </label>
                <a className="text-xs font-semibold text-primary hover:underline" href="#">
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pl-10 pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 text-primary focus:ring-primary border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800"
              />
              <label className="ml-2 block text-sm text-slate-600 dark:text-slate-400" htmlFor="remember">
                Lembrar de mim
              </label>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isSignUp ? 'Criando conta...' : 'Entrando...'}</span>
                </div>
              ) : (
                isSignUp ? 'Criar Conta' : 'Entrar'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}
              {' '}
              {isSignUp ? (
                <button 
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="font-semibold text-primary hover:underline"
                >
                  Fazer login
                </button>
              ) : (
                inviteToken && isInviteValid ? (
                  <button 
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className="font-semibold text-primary hover:underline"
                  >
                    Criar uma agora
                  </button>
                ) : (
                  <span className="text-xs italic text-slate-400 block mt-2">
                    O cadastro de novos usuários é restrito a convites.
                  </span>
                )
              )}
            </p>
          </div>
        </div>

        <div className="text-center space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-600">
            © 2024 FleetManager. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
