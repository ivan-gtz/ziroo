
import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Branch, ManagedRestaurant, User, SystemSettings, UserRole } from '../types';
import { INITIAL_BRANCHES, INITIAL_MANAGED_RESTAURANTS, MAIN_BRANCH_ID, INITIAL_CATEGORIES } from '../constants';
import { useAuth } from './AuthContext';

interface RestaurantState {
    branches: Branch[];
    managedRestaurants: ManagedRestaurant[];
    systemSettings: SystemSettings;
    superAdminCreds: { email: string; password_INSECURE: string }; // Legacy/Local
}

const INITIAL_RESTAURANT_STATE: RestaurantState = {
    branches: INITIAL_BRANCHES,
    managedRestaurants: INITIAL_MANAGED_RESTAURANTS,
    systemSettings: {
        appWebsiteUrl: '',
        logoSidebar: '',
        logoLogin: '',
        logoAnimation: '',
        faviconUrl: '',
        appTitle: 'Ziroo chef'
    },
    superAdminCreds: {
        email: 'super@ziroo.app',
        password_INSECURE: 'superadmin'
    }
};

interface RestaurantContextProps {
    // Sucursales
    branches: Branch[];
    activeBranchId: string | null;
    setActiveBranchId: (id: string) => void;
    activeBranch: Branch | undefined;
    addBranch: (name: string) => void;
    approveBranch: (branchId: string) => void;
    deleteBranch: (id: string) => Promise<void>;

    // Restaurantes
    managedRestaurants: ManagedRestaurant[];
    currentRestaurant: ManagedRestaurant | undefined;
    addManagedRestaurant: (r: Omit<ManagedRestaurant, 'id'>) => Promise<boolean>;
    updateManagedRestaurant: (r: ManagedRestaurant) => void;
    deleteManagedRestaurant: (id: string) => void;

    // Configuración del sistema
    systemSettings: SystemSettings;
    updateSystemSettings: (settings: Partial<SystemSettings>) => void;
    superAdminCreds: { email: string; password_INSECURE: string };
    updateSuperAdminCreds: (email: string, pass: string) => void;
}

const RestaurantContext = createContext<RestaurantContextProps | undefined>(undefined);

interface RestaurantProviderProps {
    children: ReactNode;
    currentUser: any; // User | SuperAdmin | null
    onUserCreated?: (user: User) => void; // Callback para notificar creación de usuario
}

export const RestaurantProvider: React.FC<{ children: ReactNode, onUserCreated?: (user: User) => void }> = ({
    children,
    onUserCreated
}) => {
    const { currentUser } = useAuth();
    const [restaurantState, setRestaurantState] = useState<RestaurantState>({
        branches: [],
        managedRestaurants: [],
        systemSettings: {
            appWebsiteUrl: '',
            logoSidebar: '',
            logoLogin: '',
            logoAnimation: '',
            faviconUrl: '',
            appTitle: ''
        },
        superAdminCreds: { email: '', password_INSECURE: '' }
    });

    const [activeBranchId, setActiveBranchIdState] = useState<string | null>(() => {
        // 1. Check URL first (highest priority for customers/monitors)
        const hash = window.location.hash;
        const customerMatch = hash.match(/\/customer\/branch\/([^\/]+)/);
        const monitorMatch = hash.match(/\/monitor\/([^\/]+)/);
        const urlId = customerMatch?.[1] || monitorMatch?.[1] || null;
        if (urlId) return urlId;

        // 2. Check localStorage
        const stored = localStorage.getItem('ziroo_active_branch');
        // If we have a stored branch and it looks like a valid ID (basic check), verify later
        return stored || null;
    });

    // Fetch Initial Data
    useEffect(() => {
        let isMounted = true;
        const fetchRestaurantsAndBranches = async () => {
            console.log("🏪 RestaurantContext: Fetching data...");

            // 1. Detect if we are in a public view (Customer Menu or Monitor)
            const hash = window.location.hash;
            const customerMatch = hash.match(/\/customer\/branch\/([^\/]+)/);
            const monitorMatch = hash.match(/\/monitor\/([^\/]+)/);
            const urlBranchId = customerMatch?.[1] || monitorMatch?.[1] || null;

            // 2. Build targeted queries
            let restsQuery = supabase.from('restaurants').select('id, name, address, phone, logo_url, is_active, created_at, subscription_end, country, city, admin_email, feature_menu_digital, feature_kitchen_display, feature_inventory, feature_reports, feature_basic_pagers, feature_whatsapp, feature_delivery, can_create_users, can_create_branches, can_customer_view, can_customize_animation, type, trial_start, trial_end, custom_plan_price, custom_online_fee, currency_symbol, last_commission_payment, commission_paid_dates, is_trial_active');
            let branchesQuery = supabase.from('branches').select('id, restaurant_id, name, is_approved, is_open, settings');

            if (currentUser && currentUser.role === 'SuperAdmin') {
                // SuperAdmin fetches everything
            } else if (currentUser && currentUser.role !== 'SuperAdmin' && 'restaurantId' in currentUser && currentUser.restaurantId && currentUser.restaurantId !== 'null') {
                console.log(`🔍 Filtering branches for restaurant: ${currentUser.restaurantId}`);
                restsQuery = restsQuery.eq('id', currentUser.restaurantId);
                branchesQuery = branchesQuery.eq('restaurant_id', currentUser.restaurantId);
            } else if (!currentUser && urlBranchId) {
                // PUBLIC MODE OPTIMIZATION: Only fetch what the customer needs
                console.log(`🚀 Public mode: Fetching only branch ${urlBranchId}`);
                branchesQuery = branchesQuery.eq('id', urlBranchId);
            }

            // 3. Try to fetch from DB
            try {
                const [restsRes, branchesRes, settingsRes] = await Promise.all([
                    restsQuery,
                    branchesQuery,
                    supabase.from('system_settings').select('key, value')
                ]);

                if (isMounted && restsRes.data && branchesRes.data) {
                    const rests = restsRes.data;
                    const branches = branchesRes.data;
                    const sysSettings = settingsRes.data;

                    // Update Cache
                    localStorage.setItem('ziroo_rest_cache', JSON.stringify(rests));
                    localStorage.setItem('ziroo_branch_cache', JSON.stringify(branches));
                    if (sysSettings) localStorage.setItem('ziroo_sys_settings_cache', JSON.stringify(sysSettings));
                    
                    processAndSetData(rests, branches, sysSettings);
                }
            } catch (err) {
                console.warn("⚠️ Sync failed, using localized cache:", err);
            }
        };

        const processAndSetData = async (rests: any[], branches: any[], sysSettings: any) => {
            const mappedRests: ManagedRestaurant[] = rests.map(r => ({
                id: r.id,
                name: r.name,
                address: r.address || '',
                phone: r.phone || '',
                adminEmail: r.admin_email,
                adminPassword_INSECURE: 'HIDDEN',
                logo: r.logo_url || '',
                isActive: r.is_active,
                startDate: r.created_at,
                endDate: r.subscription_end || new Date().toISOString(),
                country: r.country || '',
                city: r.city || '',
                features: {
                    menuDigital: r.feature_menu_digital || false,
                    kitchenDisplay: r.feature_kitchen_display || false,
                    inventory: r.feature_inventory || false,
                    reports: r.feature_reports || false,
                    basicPagers: r.feature_basic_pagers || false,
                    whatsappNotifications: r.feature_whatsapp || false,
                    delivery: r.feature_delivery || false
                },
                canCreateUsers: r.can_create_users,
                canCreateBranches: r.can_create_branches,
                canCustomerView: r.can_customer_view !== undefined ? r.can_customer_view : true,
                canCustomizeAnimation: r.can_customize_animation,
                type: r.type || 'Full',
                trialDays: 0,
                trialStartDate: r.trial_start,
                trialEndDate: r.trial_end,
                customPlanPrice: r.custom_plan_price,
                customOnlineFee: r.custom_online_fee,
                currencySymbol: r.currency_symbol,
                lastCommissionPayment: r.last_commission_payment,
                commissionPaidDates: r.commission_paid_dates,
                isTrialActive: r.is_trial_active ?? false
            }));

            const mappedBranches: Branch[] = branches.map(b => ({
                id: b.id,
                restaurantId: b.restaurant_id,
                name: b.name,
                isApproved: b.is_approved === undefined ? true : b.is_approved,
                isOpen: b.is_open
            }));

            let config = INITIAL_RESTAURANT_STATE.systemSettings;
            let suCreds = INITIAL_RESTAURANT_STATE.superAdminCreds;

            if (sysSettings) {
                const configRow = sysSettings.find(s => s.key === 'config');
                if (configRow) config = configRow.value;
            }

            // Only fetch SuperAdmin data if the current session role is SuperAdmin
            if (currentUser?.role === 'SuperAdmin') {
                try {
                    const { data: adminProfile } = await supabase.from('user_profiles').select('id, email, role, full_name').eq('role', 'SuperAdmin').single();
                    if (adminProfile) {
                        suCreds = { email: adminProfile.email, password_INSECURE: '********' };
                    }
                } catch (e) {
                    console.warn("Could not fetch SuperAdmin profile in background.");
                }
            }

            if (isMounted) {
                setRestaurantState(prev => ({
                    ...prev,
                    managedRestaurants: mappedRests,
                    branches: mappedBranches,
                    systemSettings: config,
                    superAdminCreds: suCreds
                }));
            }
        };

        fetchRestaurantsAndBranches();
        
        let channels: any[] = [];

        // Pillar 2: Zero Realtime for guests
        const isStaff = currentUser && (currentUser.role === 'SuperAdmin' || currentUser.role === 'Admin');

        if (isStaff) {
            const channelId = currentUser.restaurantId || 'global';
            console.log(`🔌 RestaurantContext: Admin Session - Monitoring channel ${channelId}`);
            let retryCount = 0;
            const MAX_RETRIES = 2;

            const setupChannels = () => {
                if (!isMounted) return;

                console.log(`🔌 RestaurantContext: Mode Admin - Consolidating channel ${channelId}`);
                
                // CONSOLIDATED CHANNEL: Listen for both restaurants and branches in one channel
                const unifiedChannel = supabase.channel(`admin_sync_unified_${channelId}`)
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, (payload) => {
                        if (!isMounted) return;
                        console.log("⚡ Restaurant sync:", payload.eventType);
                        fetchRestaurantsAndBranches(); // Refetch properly for consistency
                    })
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, (payload) => {
                        if (!isMounted) return;
                        console.log("⚡ Branch sync:", payload.eventType);
                        fetchRestaurantsAndBranches();
                    })
                    .subscribe((status) => {
                        if (status === 'CHANNEL_ERROR') {
                            if (retryCount < MAX_RETRIES) {
                                retryCount++;
                                console.warn(`⚠️ Restaurant Realtime Error. Retry ${retryCount}/${MAX_RETRIES} in 5s...`);
                                setTimeout(() => { if (isMounted) setupChannels(); }, 5000);
                            } else {
                                console.error("🚨 Restaurant Realtime: Max retries reached. Using poll-only mode.");
                            }
                        } else if (status === 'SUBSCRIBED') {
                            retryCount = 0;
                        }
                    });

                channels = [unifiedChannel];
            };

            setupChannels();
        } else {
            console.log("🛡️ RestaurantContext: Mode Guest/Staff - Realtime disabled.");
        }

        return () => {
            isMounted = false;
            channels.forEach(c => c && supabase.removeChannel(c));
        };
    }, [currentUser]); // Eliminamos activeBranchId de aquí para evitar re-fetches innecesarios al cambiar de vista


    const visibleBranches = useMemo(() => {
        if (!currentUser) return restaurantState.branches || [];

        const role = String(currentUser.role).toLowerCase();
        
        // PRIORIDAD 1: SuperAdmin ve TODO de forma inmediata
        if (role === 'superadmin') {
            return restaurantState.branches;
        }

        // PRIORIDAD 2: Filtrado por restaurante para otros roles
        const restId = currentUser.restaurantId;
        if (restId) {
            return restaurantState.branches.filter(b => {
                const isOwnRestaurant = b.restaurantId === restId;
                if (role === 'admin') return isOwnRestaurant;
                // Staff normal solo ve las aprobadas
                return isOwnRestaurant && b.isApproved;
            });
        }

        return [];
    }, [restaurantState.branches, currentUser]);

    // Auto-seleccionar sucursal
    useEffect(() => {
        if (currentUser && visibleBranches.length > 0) {
            const isValidBranch = visibleBranches.find(b => b.id === activeBranchId);

            if (!activeBranchId || !isValidBranch) {
                // PRIORIDAD 1: La sucursal específicamente asignada al usuario (para Workers/Admins)
                const userAssignedBranch = currentUser.branchId ? visibleBranches.find(b => b.id === currentUser.branchId) : null;

                if (userAssignedBranch) {
                    console.log("🔀 Auto-selecting assigned branch:", userAssignedBranch.name);
                    setActiveBranchIdState(userAssignedBranch.id);
                    localStorage.setItem('ziroo_active_branch', userAssignedBranch.id);
                } else {
                    // PRIORIDAD 2: La primera aprobada (para SuperAdmins o si no hay asignada)
                    const firstApproved = visibleBranches.find(b => b.isApproved);
                    if (firstApproved) {
                        console.log("🔀 Auto-selecting first approved branch:", firstApproved.name);
                        setActiveBranchIdState(firstApproved.id);
                        localStorage.setItem('ziroo_active_branch', firstApproved.id);
                    } else if (currentUser.role === 'SuperAdmin' && visibleBranches.length > 0) {
                        console.log("🔀 Auto-selecting first available branch (SuperAdmin):", visibleBranches[0].name);
                        setActiveBranchIdState(visibleBranches[0].id);
                        localStorage.setItem('ziroo_active_branch', visibleBranches[0].id);
                    }
                }
            }
        }
    }, [currentUser, visibleBranches, activeBranchId]);

    const activeBranch = useMemo(() => {
        return visibleBranches.find(b => b.id === activeBranchId);
    }, [visibleBranches, activeBranchId]);

    const currentRestaurant = useMemo(() => {
        if (activeBranch && activeBranch.restaurantId) {
            return restaurantState.managedRestaurants.find(r => r.id === activeBranch.restaurantId);
        }
        if (currentUser && 'restaurantId' in currentUser && currentUser.restaurantId) {
            return restaurantState.managedRestaurants.find(r => r.id === currentUser.restaurantId);
        }
        return undefined;
    }, [activeBranch, restaurantState.managedRestaurants, currentUser]);

    const setActiveBranchId = (id: string) => {
        console.log("👉 Manually setting active branch:", id);
        setActiveBranchIdState(id);
        localStorage.setItem('ziroo_active_branch', id);
    };

    const addBranch = async (name: string) => {
        const restaurantId = currentUser && 'restaurantId' in currentUser
            ? currentUser.restaurantId
            : (currentRestaurant?.id || 'main_restaurant');

        // Main logic: SuperAdmin creates approved branches, RestaurantAdmins create Pending branches
        const isSuperAdmin = currentUser?.role === 'SuperAdmin';

        const { data: newBranch, error } = await supabase.from('branches').insert({
            restaurant_id: restaurantId,
            name: name,
            is_approved: isSuperAdmin // True if SA, False otherwise
        }).select().single();

        if (error) {
            console.error("Error creating branch:", error);
            alert("Error creando sucursal: " + error.message);
            return;
        }

        if (newBranch) {
            setRestaurantState(prev => ({
                ...prev,
                branches: [...prev.branches, {
                    id: newBranch.id,
                    restaurantId: newBranch.restaurant_id,
                    name: newBranch.name,
                    isApproved: newBranch.is_approved
                }]
            }));
        }

        if (!isSuperAdmin) {
            alert("Sucursal creada. Debe esperar aprobación del Super Admin.");
        }
    };

    const approveBranch = async (branchId: string) => {
        const { error } = await supabase.from('branches').update({ is_approved: true }).eq('id', branchId);
        if (!error) {
            // Optimistic update: reflect approval immediately in local state
            setRestaurantState(prev => ({
                ...prev,
                branches: prev.branches.map(b =>
                    b.id === branchId ? { ...b, isApproved: true } : b
                )
            }));
        } else {
            console.error('Error approving branch:', error);
            alert('Error al aprobar sucursal: ' + error.message);
        }
    };

    const deleteBranch = async (id: string) => {
        // Guardar estado previo para reversión segura
        const previousBranches = [...restaurantState.branches];

        // Optimistic update
        setRestaurantState(prev => ({
            ...prev,
            branches: prev.branches.filter(b => b.id !== id)
        }));

        const { error } = await supabase.rpc('delete_branch_safely', { p_branch_id: id });
        if (error) {
            console.error("Error deleting branch:", error);
            // Revertir a la vista original si la BD falla
            setRestaurantState(prev => ({
                ...prev,
                branches: previousBranches
            }));
            alert("Error al eliminar sucursal: " + error.message);
        }
    };

    const addManagedRestaurant = async (r: Omit<ManagedRestaurant, 'id'>) => {
        // 1. Insert Restaurant (Generamos IDs primero)
        const newRestId = crypto.randomUUID();
        const newBranchId = crypto.randomUUID();

        const { data: newRest, error } = await supabase.from('restaurants').insert({
            id: newRestId,
            name: r.name,
            address: r.address || '',
            phone: r.phone || '',
            country: r.country || '',
            city: r.city || '',
            logo_url: r.logo || '',
            admin_email: r.adminEmail,
            admin_password_insecure: r.adminPassword_INSECURE, 
            feature_menu_digital: r.features.menuDigital,
            feature_kitchen_display: r.features.kitchenDisplay,
            feature_inventory: r.features.inventory,
            feature_reports: r.features.reports,
            feature_basic_pagers: r.features.basicPagers,
            feature_whatsapp: r.features.whatsappNotifications,
            feature_delivery: r.features.delivery,
            // Permissions
            can_create_users: r.canCreateUsers,
            can_create_branches: r.canCreateBranches,
            can_customer_view: r.canCustomerView,
            can_customize_animation: r.canCustomizeAnimation,
            subscription_end: r.endDate,
            type: (r as any).type || 'Full'
        }).select().single();

        if (error) {
            console.error('Error creating restaurant:', error);
            alert('Error creating restaurant: ' + error.message);
            return false;
        }

        if (newRest) {
            // 2. Insert Main Branch
            const initialSettings = {
                restaurantName: r.name,
                address: r.address || '',
                phone: r.phone || '',
                country: r.country || '',
                city: r.city || '',
                fiscalNit: '',
                fiscalBusinessName: r.name,
                fiscalMunicipio: r.city || '',
                currency: '$',
                enableSound: true,
                enableVibration: true
            };

            const { data: newBranch, error: branchError } = await supabase.from('branches').insert({
                id: newBranchId,
                restaurant_id: newRestId,
                name: `${r.name} (Sede Principal)`,
                settings: initialSettings
            }).select().single();

            if (branchError || !newBranch) {
                console.error('Error creating branch:', branchError);
                await supabase.from('restaurants').delete().eq('id', newRestId);
                return false;
            }

            // 3. Insert Default Categories
            const defaultCategories = [
                { name: 'Platos', icon_type: 'lucide', icon_value: 'UtensilsCrossed' },
                { name: 'Bebidas', icon_type: 'lucide', icon_value: 'Coffee' },
                { name: 'Postres', icon_type: 'lucide', icon_value: 'IceCream' }
            ];

            const categoriesToInsert = defaultCategories.map(cat => ({
                branch_id: newBranchId,
                ...cat
            }));

            await supabase.from('categories').insert(categoriesToInsert);

            // 4. Create User Native in Supabase Auth via RPC
            const { data: workerData, error: workerError } = await supabase.rpc('create_staff_user', {
                p_email: r.adminEmail,
                p_password: r.adminPassword_INSECURE,
                p_full_name: `Admin ${r.name}`,
                p_role: 'Admin',
                p_restaurant_id: newRestId,
                p_branch_id: newBranchId
            });

            if (workerError || (workerData && !workerData.success)) {
                console.error("⚠️ Error creating admin via RPC:", workerError || workerData?.error);
                
                // 🛑 MANUAL ROLLBACK OF THE RESTAURANT (Cascades to branch & categories)
                console.log("Rolling back restaurant insertion due to user creation failure...");
                await supabase.from('restaurants').delete().eq('id', newRestId);
                
                alert(`No se pudo generar el restaurante. Problema con el usuario: ${workerError?.message || workerData?.error}\n\nPor favor, verifica que el correo electrónico no esté en uso.`);
                return false;
            }

            // 5. Fallback Legacy: Insertar al Admin en restaurant_workers (para listar en tabla UI)
            if (workerData && workerData.user_id) {
                try {
                    await supabase.from('restaurant_workers').insert([{
                        id: workerData.user_id,
                        name: `Admin ${r.name}`,
                        email: r.adminEmail,
                        role: 'Admin',
                        phone: r.phone || '',
                        branch_id: newBranchId,
                        restaurant_id: newRestId,
                        password_insecure: 'HIDDEN'
                    }]);
                } catch (e) {
                    console.warn("Could not insert admin into legacy restaurant_workers:", e);
                }
            }

            console.log("✅ Admin user created natively in Supabase Auth. Restaurant data successfully saved.");
                
            // Mapped local state update so it appears without refresh
            // Mapped local state update so it appears without refresh
            setRestaurantState(prev => ({
                ...prev,
                managedRestaurants: [...prev.managedRestaurants, {
                    ...r,
                    id: newRest.id,
                    startDate: newRest.created_at,
                    isActive: true,
                    features: r.features
                } as any],
                branches: [...prev.branches, {
                    id: newBranchId,
                    restaurantId: newRestId,
                    name: newBranch.name,
                    isApproved: newBranch.is_approved
                }]
            }));
            
            return true;
        }
        return false;
    };

    const updateManagedRestaurant = async (id: string, updates: Partial<ManagedRestaurant>) => {
        // 1. Get current state to merge
        const current = restaurantState.managedRestaurants.find(r => r.id === id);
        if (!current) return;

        const updated = { 
            ...current, 
            ...updates,
            features: updates.features ? { ...current.features, ...updates.features } : (current.features || {})
        };

        // Helper to convert empty strings to null for DB compatibility
        const toNullable = (val: string | undefined | null) => (val && val.trim() !== '') ? val : null;

        // 2. Prepare DB mapping
        const updateData: any = {
            name: updated.name,
            address: updated.address,
            phone: updated.phone,
            country: updated.country || '',
            city: updated.city || '',
            logo_url: updated.logo,
            admin_email: updated.adminEmail,
            feature_menu_digital: updated.features.menuDigital,
            feature_inventory: updated.features.inventory,
            feature_reports: updated.features.reports,
            feature_kitchen_display: updated.features.kitchenDisplay,
            feature_basic_pagers: updated.features.basicPagers,
            feature_whatsapp: updated.features.whatsappNotifications,
            feature_delivery: updated.features.delivery,
            can_create_users: updated.canCreateUsers,
            can_create_branches: updated.canCreateBranches,
            can_customer_view: updated.canCustomerView,
            can_customize_animation: updated.canCustomizeAnimation,

            // Dates - Check nullable
            subscription_end: toNullable(updated.endDate),
            trial_start: toNullable(updated.trialStartDate),
            trial_end: toNullable(updated.trialEndDate),
            last_commission_payment: toNullable(updated.lastCommissionPayment),

            type: updated.type || 'Full',
            custom_plan_price: updated.customPlanPrice,
            custom_online_fee: updated.customOnlineFee,
            currency_symbol: updated.currencySymbol,
            commission_paid_dates: updated.commissionPaidDates,
            is_trial_active: updated.isTrialActive ?? false
        };

        if (updated.adminPassword_INSECURE && updated.adminPassword_INSECURE !== 'HIDDEN') {
            updateData.admin_password_insecure = updated.adminPassword_INSECURE;
        }

        // 3. Update Supabase
        const { data: updatedRest, error } = await supabase.from('restaurants').update(updateData).eq('id', id).select().single();

        if (error) {
            console.error("Error updating restaurant:", error);
            alert("Error actualizando restaurante: " + error.message);
            return;
        }

        // 4. Update Main Branch Settings if they exist to keep sync
        const mainBranch = restaurantState.branches.find(b => b.restaurantId === id && b.name.toLowerCase().includes('principal'));
        if (mainBranch) {
            const { data: bData } = await supabase.from('branches').select('settings').eq('id', mainBranch.id).single();
            if (bData && bData.settings) {
                const newSettings = { ...bData.settings };
                if (updates.name) newSettings.restaurantName = updates.name;
                if (updates.address) newSettings.address = updates.address;
                if (updates.phone) newSettings.phone = updates.phone;
                if (updates.country) newSettings.country = updates.country;
                if (updates.city) newSettings.city = updates.city;
                if (updates.logo) newSettings.logoImage = updates.logo;

                await supabase.from('branches').update({ settings: newSettings }).eq('id', mainBranch.id);
            }
        }

        setRestaurantState(prev => ({
            ...prev,
            managedRestaurants: prev.managedRestaurants.map(r => r.id === id ? {
                ...updated,
                isActive: updatedRest.is_active,
                country: updatedRest.country,
                city: updatedRest.city
            } : r)
        }));
    };

    const deleteManagedRestaurant = async (id: string) => {
        const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar este restaurante? Esta acción borrará TODO: órdenes, menú, personal e imágenes. Es irreversible.");
        if (!confirmDelete) return;

        console.log(`🗑️ Iniciando borrado atómico del restaurante: ${id}`);

        try {
            // 0. Obtener todas las sucursales para poder filtrar en tablas que no tengan restaurant_id directo
            const { data: bList } = await supabase.from('branches').select('id').eq('restaurant_id', id);
            const branchIds = bList?.map(b => b.id) || [];

            if (branchIds.length > 0) {
                // 1. Eliminar Órdenes (Items primero por FK)
                console.log("-> Eliminando order_items y orders...");
                await supabase.from('order_items').delete().in('branch_id', branchIds);
                await supabase.from('orders').delete().in('branch_id', branchIds);

                // 2. Eliminar Transacciones e Historial (Inventory)
                console.log("-> Eliminando inventario y transacciones...");
                await supabase.from('inventory_transactions').delete().in('branch_id', branchIds);
                await supabase.from('stock_history').delete().in('branch_id', branchIds);
                await supabase.from('daily_counters').delete().in('branch_id', branchIds);

                // 3. Limpieza de imágenes de Storage (Todos los archivos relacionados al restaurante)
                console.log("-> Eliminando archivos del storage...");
                const { data: filesData } = await supabase.storage.from('menu-images').list(id + '/', { limit: 1000 });
                if (filesData && filesData.length > 0) {
                    const filesToDelete = filesData.map(x => `${id}/${x.name}`);
                    await supabase.storage.from('menu-images').remove(filesToDelete);
                    console.log(`✅ ${filesToDelete.length} imágenes eliminadas del bucket menu-images.`);
                }

                // Extra fallback - remove generic ones by URL if saved that way mapping
                const { data: items } = await supabase.from('menu_items').select('image_url').in('branch_id', branchIds);
                if (items && items.length > 0) {
                    const extraFiles = items
                        .map(item => item.image_url)
                        .filter(url => url && url.includes('menu-images/'))
                        .map(url => url.split('menu-images/')[1])
                        // Evitar borrar los mismos que acabamos de borrar por subcarpeta
                        .filter(f => !f.startsWith(id + '/')); 
                        
                    if (extraFiles.length > 0) {
                        await supabase.storage.from('menu-images').remove(extraFiles);
                    }
                }

                // 4. Eliminar Menú
                console.log("-> Eliminando menu_items...");
                await supabase.from('menu_items').delete().in('branch_id', branchIds);
            }

            // 5. Eliminar Categorías
            console.log("-> Eliminando categorías...");
            const { error: catError } = await supabase.from('categories').delete().eq('restaurant_id', id);
            if (catError && branchIds.length > 0) {
                // Fallback a borrar por id de sucursal
                await supabase.from('categories').delete().in('branch_id', branchIds);
            }

            // 6. Eliminar Personal y Sucursales
            console.log("-> Eliminando personal y sucursales...");
            await supabase.from('restaurant_workers').delete().eq('restaurant_id', id);
            await supabase.from('branches').delete().eq('restaurant_id', id);

            // 7. Finalmente borrar el restaurante
            console.log("-> Finalizando con la tabla restaurants...");
            const { error: restError } = await supabase.from('restaurants').delete().eq('id', id);

            if (restError) throw restError;

            // Update UI State
            setRestaurantState(prev => ({
                ...prev,
                managedRestaurants: prev.managedRestaurants.filter(r => r.id !== id),
                branches: prev.branches.filter(b => b.restaurantId !== id)
            }));

            alert("✅ Restaurante y toda su basura eliminada exitosamente.");

        } catch (error: any) {
            console.error("❌ Error en borrado atómico:", error);
            alert("Error al eliminar restaurante: " + error.message);
        }
    };

    const updateSystemSettings = async (settings: Partial<SystemSettings>) => {
        const updated = { ...restaurantState.systemSettings, ...settings };

        const { error } = await supabase
            .from('system_settings')
            .upsert({ key: 'config', value: updated }, { onConflict: 'key' });

        if (!error) {
            setRestaurantState(prev => ({
                ...prev,
                systemSettings: updated
            }));
        } else {
            console.error("Error updating system settings:", error);
        }
    };

    const updateSuperAdminCreds = async (email: string, password_INSECURE: string) => {
        // 1. Update Supabase Auth
        const updateData: any = { email };
        if (password_INSECURE && password_INSECURE !== '********') {
            updateData.password = password_INSECURE;
        }

        const { error: authError } = await supabase.auth.updateUser(updateData);

        if (authError) {
            console.error("Error updating auth:", authError);
            throw authError;
        }

        // 2. Update Profile
        const { error: profileError } = await supabase
            .from('user_profiles')
            .update({ email })
            .eq('role', 'SuperAdmin');

        if (profileError) {
            console.error("Error updating profile:", profileError);
        }

        // 3. Update legacy system_settings key
        const updated = { email, password_INSECURE };
        await supabase
            .from('system_settings')
            .update({ value: updated })
            .eq('key', 'super_admin');

        setRestaurantState(prev => ({
            ...prev,
            superAdminCreds: updated
        }));
    };

    const value: RestaurantContextProps = useMemo(() => ({
        branches: visibleBranches,
        activeBranchId,
        setActiveBranchId,
        activeBranch,
        addBranch: addBranch as any,
        approveBranch: approveBranch as any,
        deleteBranch,
        managedRestaurants: restaurantState.managedRestaurants,
        currentRestaurant,
        addManagedRestaurant: addManagedRestaurant as any,
        updateManagedRestaurant: updateManagedRestaurant as any,
        deleteManagedRestaurant: deleteManagedRestaurant as any,
        systemSettings: restaurantState.systemSettings,
        updateSystemSettings,
        superAdminCreds: restaurantState.superAdminCreds,
        updateSuperAdminCreds
    }), [
        visibleBranches,
        activeBranchId,
        activeBranch,
        restaurantState.managedRestaurants,
        currentRestaurant,
        restaurantState.systemSettings,
        restaurantState.superAdminCreds
    ]);

    return (
        <RestaurantContext.Provider value={value}>
            {children}
        </RestaurantContext.Provider>
    );
};

export const useRestaurant = () => {
    const context = useContext(RestaurantContext);
    if (context === undefined) {
        throw new Error('useRestaurant must be used within a RestaurantProvider');
    }
    return context;
};
