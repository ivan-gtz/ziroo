/**
 * SERVICIO DE USUARIOS
 * 
 * Maneja todas las operaciones CRUD de usuarios.
 * Preparado para migración a Supabase.
 */

import { User, UserRole } from '../../types';

// TODO: Reemplazar con Supabase cuando se migre
// import { supabase } from './supabaseClient';

export const userService = {
    /**
     * Obtener todos los usuarios
     */
    async getAll(): Promise<User[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('users')
        //     .select('*')
        //     .order('name');

        // Por ahora, lee de LocalStorage
        const stateJson = localStorage.getItem('ziroo_user_state');
        const state = stateJson ? JSON.parse(stateJson) : { users: [] };
        return state.users || [];
    },

    /**
     * Obtener usuarios por sucursal
     */
    async getByBranch(branchId: string): Promise<User[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('users')
        //     .select('*')
        //     .eq('branch_id', branchId);

        const users = await this.getAll();
        return users.filter(u => u.branchId === branchId);
    },

    /**
     * Obtener usuario por ID
     */
    async getById(id: string): Promise<User | null> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('users')
        //     .select('*')
        //     .eq('id', id)
        //     .single();

        const users = await this.getAll();
        return users.find(u => u.id === id) || null;
    },

    /**
     * Crear usuario
     */
    async create(userData: Omit<User, 'id'>): Promise<User> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('users')
        //     .insert([userData])
        //     .select()
        //     .single();

        const newUser: User = {
            ...userData,
            id: Date.now().toString()
        };

        const users = await this.getAll();
        const updatedUsers = [...users, newUser];

        localStorage.setItem('ziroo_user_state', JSON.stringify({ users: updatedUsers }));

        return newUser;
    },

    /**
     * Actualizar usuario
     */
    async update(user: User): Promise<User> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('users')
        //     .update(user)
        //     .eq('id', user.id)
        //     .select()
        //     .single();

        const users = await this.getAll();
        const updatedUsers = users.map(u => u.id === user.id ? user : u);

        localStorage.setItem('ziroo_user_state', JSON.stringify({ users: updatedUsers }));

        return user;
    },

    /**
     * Eliminar usuario
     */
    async delete(id: string): Promise<void> {
        // TODO: Implementar con Supabase
        // const { error } = await supabase
        //     .from('users')
        //     .delete()
        //     .eq('id', id);

        const users = await this.getAll();
        const updatedUsers = users.filter(u => u.id !== id);

        localStorage.setItem('ziroo_user_state', JSON.stringify({ users: updatedUsers }));
    },

    /**
     * Buscar usuarios por email
     */
    async findByEmail(email: string): Promise<User | null> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('users')
        //     .select('*')
        //     .eq('email', email)
        //     .single();

        const users = await this.getAll();
        return users.find(u => u.email === email) || null;
    },

    /**
     * Verificar si el email ya existe
     */
    async emailExists(email: string, excludeId?: string): Promise<boolean> {
        const user = await this.findByEmail(email);
        if (!user) return false;
        if (excludeId && user.id === excludeId) return false;
        return true;
    }
};
