
import React, { createContext, useContext, ReactNode, useMemo, useEffect, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { supabase } from '../services/supabase';
import { User, UserRole } from '../types';

export interface UserState {
    users: User[];
}
import { INITIAL_USERS } from '../constants';
import { useAuth } from './AuthContext';

interface UserContextProps {
    users: User[];
    loading: boolean;
    addUser: (userData: Omit<User, 'id' | 'restaurantId' | 'branchId'>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;
    syncUsers: () => Promise<void>;
}

const INITIAL_USER_STATE: UserState = {
    users: INITIAL_USERS
};

const UserContext = createContext<UserContextProps | undefined>(undefined);

interface UserProviderProps {
    children: ReactNode;
    activeBranchId: string | null;
    activeBranch: any; // Branch | undefined
    userToCreate?: any; // Usuario a crear automáticamente
}

export const UserProvider: React.FC<UserProviderProps> = ({
    children,
    activeBranchId,
    activeBranch,
    userToCreate
}) => {
    const [userState, setUserState] = useState<UserState>({ users: [] });
    const [loading, setLoading] = useState(true);
    const { currentUser } = useAuth();

    // Fetch users from Supabase with LocalStorage fallback
    useEffect(() => {
        const fetchUsers = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                let allFetchedUsers: User[] = [];
                console.log(`🔍 UserContext: Fetching for Restaurant: ${currentUser.restaurantId}, Role: ${currentUser.role}`);

                // 1. Try Standard Query (RLS)
                let query = supabase.from('restaurant_workers').select('id, name, email, role, phone, branch_id, restaurant_id, password_insecure');
                
                const isGlobalPage = window.location.hash.includes('/restaurants') || 
                                   window.location.hash.includes('/earnings') || 
                                   window.location.hash.includes('/team-repartidor');

                if (currentUser.role === 'SuperAdmin') {
                    if (!isGlobalPage && activeBranchId) {
                        console.log(`🛡️ UserContext: Scoping fetch to branch ${activeBranchId} for SuperAdmin (Non-global page)`);
                        query = query.eq('branch_id', activeBranchId);
                    }
                } else if (currentUser.restaurantId && currentUser.restaurantId !== 'null') {
                    query = query.eq('restaurant_id', currentUser.restaurantId);
                }

                const { data, error } = await query;
                if (!error && data) {
                    allFetchedUsers = data.map(item => ({
                        id: item.id,
                        name: item.name,
                        email: item.email,
                        role: item.role as UserRole,
                        phone: item.phone,
                        branchId: item.branch_id,
                        restaurantId: item.restaurant_id,
                        password_INSECURE: (item as any).password_insecure || ''
                    }));
                }

                // 2. If EMPTY and NOT SuperAdmin, potential RLS lock - use secure RPC
                if (allFetchedUsers.length === 0 && currentUser.sessionToken) {
                    const { data: secureData, error: secureError } = await supabase.rpc('get_restaurant_workers_secure', {
                        p_token: currentUser.sessionToken
                    });
                    if (!secureError && secureData) {
                        allFetchedUsers = secureData.map((item: any) => ({
                            id: item.id,
                            name: item.name,
                            email: item.email,
                            role: item.role as UserRole,
                            phone: item.phone,
                            branchId: item.branch_id,
                            restaurantId: item.restaurant_id,
                            password_INSECURE: item.password_insecure || ''
                        }));
                    }
                }

                // 3. Finalize State
                setUserState({ users: allFetchedUsers });
                localStorage.setItem('ziroo_users_cache', JSON.stringify(allFetchedUsers));
                console.log(`✅ UserContext: Loaded ${allFetchedUsers.length} users.`);

            } catch (err) {
                console.error("❌ UserContext: Unexpected error:", err);
                const cached = localStorage.getItem('ziroo_users_cache');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    setUserState({ users: parsed });
                }
            } finally {
                setLoading(false);
            }
        };

        const isAuth = !!currentUser;
        if (isAuth) {
            fetchUsers();
        } else {
            setLoading(false);
        }

        // --- REALTIME: ZERO-REALTIME FOR GUESTS ---
        const isStaff = currentUser && (currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin');
        let channel: any = null;

        if (isStaff && currentUser.restaurantId) {
            channel = supabase
                .channel(`users_updates_${currentUser.restaurantId}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'restaurant_workers',
                    filter: currentUser.role !== 'SuperAdmin' ? `restaurant_id=eq.${currentUser.restaurantId}` : undefined
                }, () => {
                    fetchUsers();
                })
                .subscribe();
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [activeBranchId, currentUser]);

    const addUser = async (userData: Omit<User, 'id' | 'restaurantId' | 'branchId'>) => {
        if (!activeBranchId) {
            throw new Error("No hay sucursal activa seleccionada");
        }

        // 1. Validamos que el branchId y restaurantId se pasen correctamente desde el contexto
        const restId = currentUser?.restaurantId || activeBranch?.restaurantId;
        
        if (!restId || !activeBranchId) {
            throw new Error("Error de contexto: restaurant_id o branch_id inválidos o nulos.");
        }

        // 2. Usar el nuevo RPC unificado para crear en auth.users y user_profiles nativamente
        const { data: workerData, error: workerError } = await supabase.rpc('create_staff_user', {
            p_email: userData.email,
            p_password: (userData as any).password_INSECURE,
            p_full_name: userData.name,
            p_role: userData.role,
            p_restaurant_id: restId,
            p_branch_id: activeBranchId
        });

        if (workerError || (workerData && !workerData.success)) {
            console.error("⚠️ Error creating staff user via RPC:", workerError || workerData?.error);
            throw new Error(workerData?.error || workerError?.message || "Error al crear empleado en Auth.");
        }

        const newUserId = workerData.user_id;

        const newUser: any = {
            ...userData,
            id: newUserId,
            branchId: activeBranchId,
            restaurantId: restId,
            branch_id: activeBranchId,
            restaurant_id: restId
        };

        // 3. (Opcional - Retrocompatibilidad) Insertar en la tabla vieja para que el listado siga incluyendo roles como teléfono y fallback
        try {
            await supabase.from('restaurant_workers').insert([{
                id: newUserId, // Forzar que comparta el ID de auth.users
                name: userData.name,
                email: userData.email,
                role: userData.role,
                phone: userData.phone,
                branch_id: activeBranchId,
                restaurant_id: restId,
                password_insecure: 'HIDDEN'
            }]);
        } catch (e) {
            console.warn("Could not insert into legacy restaurant_workers, ignoring:", e);
        }
        
        setUserState(prev => ({ users: [...prev.users, newUser] }));
        await new Promise(r => setTimeout(r, 500)); // Latencia para RLS
    };

    const updateUser = async (user: User) => {
        if (currentUser?.sessionToken) {
            // Ruta segura: Admin/Worker con sesión custom usa RPC que bypassea RLS
            const { error } = await supabase.rpc('update_worker_secure', {
                p_token: currentUser.sessionToken,
                p_worker_id: user.id,
                p_name: user.name,
                p_email: user.email,
                p_role: user.role,
                p_phone: user.phone || null,
                p_branch_id: user.branchId || null,
                p_password: (user as any).password_INSECURE && 
                             (user as any).password_INSECURE !== 'REDACTED' && 
                             (user as any).password_INSECURE !== 'HIDDEN'
                    ? (user as any).password_INSECURE
                    : null
            });
            if (error) {
                console.error('❌ updateUser RPC error:', error);
                throw error;
            }
        } else {
            // Ruta Supabase Auth (SuperAdmin con JWT)
            const updatePayload: any = {
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                branch_id: user.branchId
            };
            if ((user as any).password_INSECURE && 
                (user as any).password_INSECURE !== 'REDACTED' && 
                (user as any).password_INSECURE !== 'HIDDEN') {
                updatePayload.password_insecure = (user as any).password_INSECURE;
            }
            const { error } = await supabase
                .from('restaurant_workers')
                .update(updatePayload)
                .eq('id', user.id);
            if (error) throw error;
        }

        // Actualizar UI local de inmediato y Caché
        setUserState(prev => {
            const updatedUsers = prev.users.map(u => u.id === user.id ? { ...u, ...user } : u);
            localStorage.setItem('ziroo_users_cache', JSON.stringify(updatedUsers));
            return { users: updatedUsers };
        });
    };

    const deleteUser = async (id: string) => {
        if (currentUser?.sessionToken) {
            // Ruta segura: Admin/Worker con sesión custom usa RPC
            const { error } = await supabase.rpc('delete_worker_secure', {
                p_token: currentUser.sessionToken,
                p_worker_id: id
            });
            if (error) {
                console.error('❌ deleteUser RPC error:', error);
                throw error;
            }
        } else {
            // Ruta Supabase Auth (SuperAdmin con JWT)
            const { error } = await supabase
                .from('restaurant_workers')
                .delete()
                .eq('id', id);
            if (error) throw error;
        }

        // Actualizar UI local de inmediato y Caché
        setUserState(prev => {
            const remainingUsers = prev.users.filter(u => u.id !== id);
            localStorage.setItem('ziroo_users_cache', JSON.stringify(remainingUsers));
            return { users: remainingUsers };
        });
    };

    const syncUsers = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            let query = supabase
                .from('restaurant_workers')
                .select('id, name, email, role, phone, branch_id, restaurant_id, password_insecure');
            if (currentUser.role !== 'SuperAdmin' && currentUser.restaurantId && currentUser.restaurantId !== 'null') {
                query = query.eq('restaurant_id', currentUser.restaurantId);
            }
            const { data, error } = await query;
            if (!error && data) {
                const mapped = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    email: item.email,
                    role: item.role as UserRole,
                    phone: item.phone,
                    branchId: item.branch_id,
                    restaurantId: item.restaurant_id,
                    password_INSECURE: item.password_insecure || ''
                }));
                setUserState({ users: mapped });
                localStorage.setItem('ziroo_users_cache', JSON.stringify(mapped));
            }
        } finally {
            setLoading(false);
        }
    };

    const users = useMemo(() => {
        if (!activeBranchId) {
            console.log("🔍 UserView: No active branch, showing all users:", userState.users.length);
            return userState.users;
        }

        const filtered = userState.users.filter(u => {
            const userBranchId = String(u.branchId || "").trim().toLowerCase();
            const targetBranchId = String(activeBranchId).trim().toLowerCase();
            return userBranchId === targetBranchId;
        });

        console.log(`🔍 UserView: Filtered ${filtered.length}/${userState.users.length} users for branch ${activeBranchId}`);
        return filtered;
    }, [activeBranchId, userState.users]);

    const value: UserContextProps = useMemo(() => ({
        users,
        loading,
        addUser,
        updateUser,
        deleteUser,
        syncUsers
    }), [users, loading, activeBranchId, activeBranch, currentUser]);

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
