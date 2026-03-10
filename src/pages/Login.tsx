import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, User } from 'lucide-react';
import { cn } from '../utils';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'Admin' | 'Motorista'>('Motorista');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role,
            }
          }
        });

        if (signUpError) throw signUpError;
        
        if (signUpData.user) {
          setSuccess('Conta criada com sucesso! Como a confirmação de e-mail está simplificada, você já pode entrar agora.');
          setIsSignUp(false);
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
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

          // Save user to localStorage for session persistence (compatibility with existing code)
          localStorage.setItem('fleet_user', JSON.stringify(profile));
          
          // Check if user has an open journey
          const { data: openJourneys, error: journeyError } = await supabase
            .from('journeys')
            .select('id')
            .eq('user_id', authData.user.id)
            .eq('status', 'aberta');

          if (journeyError) console.error('Error checking journeys', journeyError);

          const hasOpenJourney = openJourneys && openJourneys.length > 0;

          if (hasOpenJourney || profile.role === 'Motorista') {
            navigate('/daily-report');
          } else {
            navigate('/dashboard');
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Erro ao processar solicitação. Tente novamente.');
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <>
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
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                    Tipo de Acesso
                  </label>
                  <div className="grid grid-cols-2 gap-4">
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
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1" htmlFor="email">
                E-mail
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  id="email"
                  type="email"
                  className="input-field pl-10"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

            {!isSignUp && (
              <button 
                type="button"
                onClick={() => {
                  const mockUser = {
                    id: '00000000-0000-0000-0000-000000000001',
                    name: 'Admin Temporário',
                    email: 'admin@teste.com',
                    role: 'Admin'
                  };
                  localStorage.setItem('fleet_user', JSON.stringify(mockUser));
                  window.location.href = '/dashboard';
                }}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-primary transition-colors border border-dashed border-slate-200 dark:border-slate-800 rounded-lg"
              >
                Acesso de Emergência (Pular Login para Teste)
              </button>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}
              {' '}
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-semibold text-primary hover:underline"
              >
                {isSignUp ? 'Fazer login' : 'Criar uma agora'}
              </button>
            </p>
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg text-left">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Aviso de Migração</p>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              O sistema agora utiliza autenticação real via Supabase. As credenciais de teste anteriores não funcionam automaticamente. 
              Por favor, utilize a opção <strong>"Criar uma agora"</strong> acima para registrar seu usuário.
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-600">
            © 2024 FleetManager. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
