
import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { ChefHat, Eye, EyeOff, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const { currentUser, login, t, systemSettings } = useAppContext();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [loadTime] = useState(Date.now());
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If a user is already logged in, redirect them to the dashboard.
    if (currentUser) {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 1. Bot Protection: Honeypot (If filled, it's a bot)
    if (honeypot) return;

    // 2. Bot Protection: Too fast submission (less than 1 second)
    if (Date.now() - loadTime < 1000) {
      setError("Por seguridad, espere un momento antes de enviar.");
      return;
    }

    // 3. Brute Force Protection: Basic rate limiting
    if (isLocked) {
      setError("Demasiados intentos. Por favor, espere 1 minuto.");
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);

      if (!result.success) {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          setIsLocked(true);
          setTimeout(() => { setIsLocked(false); setAttempts(0); }, 60000); // Lock for 1 min
        }

        if (result.errorType === 'lockout' && result.lockoutTime) {
          setError(`Demasiados intentos. Vuelve a intentar en 12 horas.`);
        } else if (result.errorType === 'branch_not_approved') {
          setError('Acceso Denegado: Esta sucursal aún no ha sido aprobada por el Super Admin.');
        } else if (result.errorType === 'custom_error' && (result as any).customMessage) {
          setError((result as any).customMessage);
        } else if ((result as any).remainingAttempts !== undefined) {
          const remaining = (result as any).remainingAttempts;
          if (remaining === 0) {
            setError(`Cuenta bloqueada. Vuelve a intentar en 12 horas.`);
          } else {
            setError(`${t('login.error_invalid_credentials')} (Te quedan ${remaining} ${remaining === 1 ? 'oportunidad' : 'oportunidades'})`);
          }
        } else {
          setError(t('login.error_invalid_credentials'));
        }
      }
    } catch (err) {
      console.error("Login attempt failed:", err);
      setError("Error al intentar iniciar sesión. Por favor, intente de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  // Safety cleanup for hung processes
  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setTimeout(() => {
        setIsLoading(false);
        setError("La conexión está tardando demasiado. Por favor, intente de nuevo.");
      }, 45000); // 45s absolute safety window
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] dark:bg-gray-950 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800/50 p-8 pt-10">
          <div className="text-center mb-10">
            <div className="flex flex-col items-center justify-center">
              {systemSettings.logoLogin ? (
                <div className="p-4 mb-4 transition-transform hover:scale-105 duration-300">
                  <img src={systemSettings.logoLogin} alt="Ziroo Logo" className="h-20 w-20 object-contain" />
                </div>
              ) : (
                <div className="p-5 mb-4 bg-primary-500 rounded-3xl shadow-xl shadow-primary-500/20 transition-transform hover:scale-105 duration-300">
                  <ChefHat size={48} className="text-white" />
                </div>
              )}

              <div className="flex flex-col items-center justify-center">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight">
                  Ziroo<span className="text-primary-600">.</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium uppercase tracking-[0.2em] text-xs mt-[-4px]">
                  chef
                </p>
              </div>
            </div>

            <h2 className="mt-8 text-xl font-semibold text-gray-700 dark:text-gray-300">
              {t('login.title')}
            </h2>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="group">
                <label htmlFor="email-address" className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1 transition-colors group-focus-within:text-primary-600">
                  {t('login.email_placeholder')}
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
                  placeholder="ejemplo@correo.com"
                />
              </div>

              <div className="group">
                <label htmlFor="password" className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-1 transition-colors group-focus-within:text-primary-600">
                  {t('login.password_placeholder')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium animate-shake">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg shadow-primary-600/20 transition-all duration-200 flex items-center justify-center gap-2 group ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Iniciando sesión...</span>
                  </div>
                ) : (
                  <>
                    <span>{t('login.signin_button')}</span>
                    <div className="w-1.5 h-1.5 bg-white rounded-full transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-xs font-medium">
              &copy; {new Date().getFullYear()} Ziroo chef. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
