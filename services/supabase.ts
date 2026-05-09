import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase URL or Anon Key. Please check your .env file.');
}

// Helper to get session token from localStorage immediately
const getInitialSessionToken = () => {
    try {
        const stored = localStorage.getItem('ziroo_custom_user');
        if (stored) {
            const user = JSON.parse(stored);
            return user.sessionToken || null;
        }
    } catch (e) {
        return null;
    }
    return null;
};

const initialToken = getInitialSessionToken();

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    global: {
        headers: initialToken ? { 'x-ziroo-session-token': initialToken } : {},
    },
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

// Helper para actualizar el token dinámicamente en todas las peticiones
export const setSupabaseSessionToken = (token: string | null) => {
    if (!token) {
        delete (supabase as any).rest.headers['x-ziroo-session-token'];
        // También intentar en el objeto global por si acaso
        if ((supabase as any).global?.headers) {
            delete (supabase as any).global.headers['x-ziroo-session-token'];
        }
    } else {
        // En Supabase-js v2, los headers residen en rest.headers
        (supabase as any).rest.headers['x-ziroo-session-token'] = token;

        // Reforzamos en la configuración global
        if (!(supabase as any).rest.headers) (supabase as any).rest.headers = {};

        console.log("🔑 Supabase: Header 'x-ziroo-session-token' actualizado.");
    }
};
