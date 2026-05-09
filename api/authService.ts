/**
 * SERVICIO DE AUTENTICACIÓN
 * 
 * Este servicio maneja toda la lógica de autenticación.
 * Actualmente usa LocalStorage, pero está preparado para migrar a Supabase.
 */

import { User, SuperAdmin } from '../../types';

// TODO: Reemplazar con Supabase cuando se migre
// import { supabase } from './supabaseClient';

export const authService = {
    /**
     * Iniciar sesión
     */
    async login(email: string, password: string): Promise<User | SuperAdmin | null> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase.auth.signInWithPassword({
        //     email,
        //     password
        // });

        // Por ahora, retorna null (la lógica está en AuthContext)
        return null;
    },

    /**
     * Cerrar sesión
     */
    async logout(): Promise<void> {
        // TODO: Implementar con Supabase
        // await supabase.auth.signOut();

        // Por ahora, solo limpia LocalStorage
        localStorage.removeItem('ziroo_current_user');
    },

    /**
     * Obtener usuario actual
     */
    async getCurrentUser(): Promise<User | SuperAdmin | null> {
        // TODO: Implementar con Supabase
        // const { data: { user } } = await supabase.auth.getUser();

        // Por ahora, lee de LocalStorage
        const userJson = localStorage.getItem('ziroo_current_user');
        return userJson ? JSON.parse(userJson) : null;
    },

    /**
     * Verificar si el usuario está autenticado
     */
    async isAuthenticated(): Promise<boolean> {
        const user = await this.getCurrentUser();
        return user !== null;
    },

    /**
     * Hashear contraseña (para migración a Supabase)
     */
    async hashPassword(password: string): Promise<string> {
        // TODO: Implementar con bcrypt cuando se migre a backend
        // const bcrypt = require('bcryptjs');
        // return await bcrypt.hash(password, 10);

        return password; // Por ahora, retorna sin hashear
    },

    /**
     * Verificar contraseña
     */
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        // TODO: Implementar con bcrypt cuando se migre a backend
        // const bcrypt = require('bcryptjs');
        // return await bcrypt.compare(password, hash);

        return password === hash; // Por ahora, comparación directa
    }
};
