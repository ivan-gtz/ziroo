
import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { User, SuperAdmin, Language, Theme } from '../types';
import { SUPER_ADMIN_USER } from '../constants';
import { translations } from '../lib/i18n';
import { supabase, setSupabaseSessionToken } from '../services/supabase';

interface AuthContextProps {
    currentUser: User | SuperAdmin | null;
    login: (email: string, password: string, allUsers?: User[], managedRestaurants?: any[], branches?: any[]) => Promise<{ success: boolean; errorType?: string; lockoutTime?: number }>;
    logout: () => void;
    isShowingWelcome: boolean;
    setIsShowingWelcome: (show: boolean) => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: any) => string;
    updateCurrentUser: (user: Partial<User | SuperAdmin>) => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{
    children: ReactNode;
    superAdminCreds?: { email: string; password_INSECURE: string } // Optional now
}> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | SuperAdmin | null>(() => {
        try {
            const stored = localStorage.getItem('ziroo_custom_user');
            if (stored) {
                const user = JSON.parse(stored);
                // Set header immediately to avoid race conditions with child useEffects
                if (user && user.sessionToken) {
                    setSupabaseSessionToken(user.sessionToken);
                }
                return user;
            }
            return null;
        } catch (e) {
            return null;
        }
    });

    // Persist custom user session
    React.useEffect(() => {
        // Guard: If we are logging out, don't persist anything
        if (window.sessionStorage.getItem('ziroo_logging_out')) return;

        if (currentUser) {
            localStorage.setItem('ziroo_custom_user', JSON.stringify(currentUser));
            if ((currentUser as any).sessionToken) {
                setSupabaseSessionToken((currentUser as any).sessionToken);
            }
        } else {
            localStorage.removeItem('ziroo_custom_user');
            setSupabaseSessionToken(null);
        }
    }, [currentUser]);

    const [language, setLanguage] = useLocalStorage<Language>('ziroo_language', Language.ES);
    const [theme, setTheme] = useLocalStorage<Theme>('ziroo_theme', Theme.Light);
    const [isShowingWelcome, setIsShowingWelcome] = useState(false);
    
    // CACHE-FIRST: Si ya tenemos un usuario en localStorage, NO bloqueamos la UI con loading=true
    const [loading, setLoading] = useState(() => {
        try {
            return !localStorage.getItem('ziroo_custom_user');
        } catch {
            return true;
        }
    });

    // Apply theme class to document element
    React.useEffect(() => {
        if (theme === Theme.Dark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Initialize Supabase Auth Listener
    React.useEffect(() => {
        console.log("🔐 AuthContext: Inicializando sesión...");

        // Check active session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                // Background verification
                console.log("📡 Sesión encontrada en Supabase, verificando perfil...");
                fetchUserProfile(session.user.id, session.user.email!);
            } else {
                console.log("ℹ️ No hay sesión activa en Supabase.");
                setLoading(false);
            }
        }).catch(err => {
            console.warn("⚠️ Error obteniendo sesión de Supabase (posible timeout/offline):", err);
            // Si falla la red, confiamos en lo que hay en localStorage (ya seteado inicialmente)
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("🔐 Auth state change:", event);
            if (session?.user) {
                fetchUserProfile(session.user.id, session.user.email!);
            } else if (event === 'SIGNED_OUT') {
                setCurrentUser(null);
                localStorage.removeItem('ziroo_custom_user');
                setLoading(false);
            } else {
                setLoading(false);
            }
        });

        // Safety timeout crítico para evitar pantallas en blanco (Reducido a 4s)
        const safetyTimer = setTimeout(() => {
            if (loading) {
                console.warn("⏰ AuthContext: Safety timeout disparado. Forzando resolución de loading.");
                setLoading(false);
            }
        }, 4000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, []);

    const fetchUserProfile = async (userId: string, email: string) => {
        // Prevent overwriting if we already have a custom worker/admin session with a token
        if (currentUser && (currentUser as any).sessionToken) {
            console.log("🛡️ fetchUserProfile: Skipping active worker/admin session.");
            setLoading(false);
            return null;
        }

        const maxRetries = 2;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                console.log(`📡 Fetching user profile (Attempt ${attempt + 1}/${maxRetries + 1})...`);
                const profileResponse = await Promise.race([
                    supabase.from('user_profiles').select('id, email, full_name, role, branch_id, restaurant_id').eq('id', userId),
                    new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), attempt === 0 ? 10000 : 15000))
                ]).catch(err => ({ error: err, data: null }));

                const { data: list, error } = profileResponse;

                if (error) {
                    if (error.message === 'TIMEOUT' && attempt < maxRetries) {
                        console.warn(`⏳ fetchUserProfile: Timeout on attempt ${attempt + 1}. Retrying...`);
                        attempt++;
                        continue;
                    }
                    console.error('Error fetching user profile:', error);
                    // Si el error es PGRST116 (no rows), devolvemos null para que el login pueda reintentar como trabajador
                    if (error.code === 'PGRST116') {
                        setLoading(false);
                        return null;
                    }
                    break; // Final error
                }

                const data = (list && list.length > 0) ? list[0] : null;

                if (data) {
                    // Map DB profile to App User Type
                    const user: any = {
                        id: data.id,
                        email: email,
                        name: data.full_name || email.split('@')[0],
                        role: data.role || 'Waiter',
                        branchId: data.branch_id,
                        restaurantId: data.restaurant_id,
                        password_INSECURE: 'HIDDEN'
                    };
                    setCurrentUser(user);
                    setLoading(false);
                    return user;
                } else {
                    // No profile found
                    setLoading(false);
                    return null;
                }
            } catch (err) {
                console.error("❌ fetchUserProfile Exception:", err);
                if (attempt >= maxRetries) break;
                attempt++;
            }
        }

        setLoading(false);
        return null;
    };

    const t = (key: string, params: any = {}) => {
        let text = translations[language][key] || key;
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        return text;
    };

    const updateCurrentUser = (userData: Partial<User | SuperAdmin>) => {
        setCurrentUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...userData } as any;
            localStorage.setItem('ziroo_custom_user', JSON.stringify(updated));
            return updated;
        });
    };

    const login = async (
        emailRaw: string,
        password: string,
        _allUsers: User[] = [], // No longer used for comparison
        managedRestaurants: any[] = [],
        branches: any[] = []
    ) => {
        const email = emailRaw.trim().toLowerCase();
        try {
            // 0. Limpiar sesiones previas de Supabase Auth para evitar conflictos de RLS y Roles
            // Esto es crucial para que un Cajero no sea visto como SuperAdmin si hubo una sesión previa abierta
            const sessionData = await Promise.race([
                supabase.auth.getSession(),
                new Promise<any>((resolve) => setTimeout(() => resolve({ data: { session: null } }), 1000))
            ]);
            const session = sessionData?.data?.session;

            if (session) {
                console.log("🧹 Limpiando sesión previa de Supabase Auth...");
                // Add extreme timeout to prevent hanging
                try {
                    await Promise.race([
                        supabase.auth.signOut(),
                        new Promise((resolve) => setTimeout(resolve, 2000))
                    ]);
                } catch (e) {
                    console.error("SignOut cleanup failed, continuing...", e);
                }
            }

            // 1. Intentar Login via Supabase Auth (Todas las cuentas ahora son nativas)
            console.log(`🔐 Intentando login via Supabase Auth: ${email}`);
            const authResponse = await Promise.race([
                supabase.auth.signInWithPassword({ email, password }),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000))
            ]).catch(err => ({ error: err, data: { user: null } }));

            const { data: authData, error: authError } = authResponse;

            if (!authError && authData.user) {
                console.log('✅ Login exitoso via Supabase Auth. Verificando perfil...');

                const profile = await fetchUserProfile(authData.user.id, authData.user.email!);

                if (profile) {
                    console.log('✅ Perfil verificado exitosamente');
                    setIsShowingWelcome(true);
                    return { success: true };
                } else {
                    console.warn('⚠️ Usuario autenticado pero sin perfil en user_profiles. No tiene permisos definidos.');
                    await supabase.auth.signOut();
                    return { success: false, errorType: 'custom_error', customMessage: "No tienes un perfil asignado. Contacta al administrador." };
                }
            }

            // 2. Fallback: Intentar login como Repartidor (Delivery Drivers están en una tabla separada, usan tokens custom)
            console.log(`🚚 Fallback: Intentando login de Repartidor...`);
            const { data: driverData, error: driverError } = await supabase.rpc('verify_driver_login', { p_email: email, p_password: password });
            
            if (!driverError && driverData && driverData.success && driverData.role === 'DeliveryDriver') {
                console.log('✅ Login exitoso via RPC (Repartidor)');
                const user = {
                    id: driverData.id,
                    email: driverData.email,
                    name: driverData.name,
                    role: driverData.role,
                    sessionToken: driverData.session_token,
                    credits: driverData.credits,
                    isAvailable: driverData.is_available,
                    city: driverData.city,
                    country: driverData.country,
                    password_INSECURE: 'HIDDEN'
                };
                setCurrentUser(user as any);
                setIsShowingWelcome(true);
                return { success: true };
            }

            // Si llegamos aquí, fue error de credenciales en todos los ecosistemas
            return { success: false, errorType: 'invalid_credentials' };
        } catch (err) {
            console.error('Unexpected login error:', err);
            return { success: false, errorType: 'unknown' };
        }
    };

    // Helper for brute force protection
    const checkBruteForceStatus = (email: string) => {
        const key = `login_attempts_${email.replace(/@/g, '_')}`;
        const stored = localStorage.getItem(key);
        if (!stored) return { attempts: 0, lockoutUntil: 0 };

        try {
            const data = JSON.parse(stored);
            return {
                attempts: data.attempts || 0,
                lockoutUntil: data.lockoutUntil || 0
            };
        } catch (e) {
            return { attempts: 0, lockoutUntil: 0 };
        }
    };

    const recordFailedAttempt = (email: string) => {
        const key = `login_attempts_${email.replace(/@/g, '_')}`;
        const status = checkBruteForceStatus(email);
        const newAttempts = status.attempts + 1;
        let lockoutUntil = status.lockoutUntil;

        if (newAttempts >= 7) {
            // 7 failures = 12 hours lockout
            lockoutUntil = Date.now() + (12 * 60 * 60 * 1000);
        }

        localStorage.setItem(key, JSON.stringify({
            attempts: newAttempts,
            lockoutUntil
        }));

        return { attempts: newAttempts, lockoutUntil };
    };

    const resetAttempts = (email: string) => {
        const key = `login_attempts_${email.replace(/@/g, '_')}`;
        localStorage.removeItem(key);
    };

    const loginEnhanced = async (
        emailRaw: string,
        password: string,
        allUsers: User[] = [],
        managedRestaurants: any[] = [],
        branches: any[] = []
    ) => {
        const email = emailRaw.trim().toLowerCase();

        // 1. Check Lockout
        const status = checkBruteForceStatus(email);
        if (status.lockoutUntil > Date.now()) {
            const remainingLockout = status.lockoutUntil - Date.now();
            return {
                success: false,
                errorType: 'lockout',
                lockoutTime: remainingLockout
            };
        }

        const result = await login(email, password, allUsers, managedRestaurants, branches);

        if (result.success) {
            resetAttempts(email);
        } else if (result.errorType === 'invalid_credentials') {
            const newStatus = recordFailedAttempt(email);
            return {
                ...result,
                remainingAttempts: Math.max(0, 7 - newStatus.attempts),
                lockoutTime: newStatus.lockoutUntil > Date.now() ? (newStatus.lockoutUntil - Date.now()) : 0
            };
        }

        return result;
    };

    const logout = async () => {
        console.log("🚪 Hard Logout (Full Cleanup)...");

        // 0. Set local blocking flag
        sessionStorage.setItem('ziroo_logging_out', 'true');

        try {
            // 1. Clear Supabase session globally first
            setSupabaseSessionToken(null);
            await Promise.race([
                supabase.auth.signOut({ scope: 'global' }),
                new Promise((resolve) => setTimeout(resolve, 2000))
            ]);
            console.log("✅ Supabase context cleared");
        } catch (err) {
            console.error('Error during signOut:', err);
        }

        // 2. Clear ALL storage aggressively
        try {
            localStorage.clear();
            sessionStorage.clear();
            
            // Clear all database indexes if using indexedDB (optional but safe)
            if (window.indexedDB) {
                const dbs = await window.indexedDB.databases();
                dbs.forEach(db => {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                });
            }

            // Desregistrar todos los Service Workers activos
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log("✅ Service Workers desregistrados");
            }
        } catch (err) {
            console.error('Error clearing storage/SW:', err);
        }

        // 3. Reset React State
        setCurrentUser(null);
        setIsShowingWelcome(false);

        // 4. Force Absolute Redirect (Breaking the Service Worker / PWA Loop)
        const loginUrl = window.location.origin + '/#/login';
        console.log("♻️ Final absolute redirect to:", loginUrl);
        
        window.location.replace(loginUrl);
    };

    const value: AuthContextProps = useMemo(() => ({
        currentUser,
        login: loginEnhanced,
        logout,
        isShowingWelcome,
        setIsShowingWelcome,
        theme,
        setTheme,
        language,
        setLanguage,
        t,
        updateCurrentUser,
        loading
    }), [currentUser, isShowingWelcome, theme, language, loading]);

    return (
        <AuthContext.Provider value={value}>
            <div className={theme}>
                {children}
            </div>
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
