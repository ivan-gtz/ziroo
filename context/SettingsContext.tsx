
import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo } from 'react';
import { BranchSettings, Branch } from '../types';
import { MAIN_BRANCH_ID } from '../constants';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

import { setRestaurantTimezone } from '../utils/dateUtils';

interface SettingsState {
    allSettings: Record<string, BranchSettings>;
}

const DEFAULT_SETTINGS: BranchSettings = {
    restaurantName: 'Ziroo chef',
    currency: '$',
    socialLinks: {},
};

interface SettingsContextProps {
    allSettings: Record<string, BranchSettings>;
    branchSettings: BranchSettings | undefined;
    saveBranchSettings: (settings: Partial<BranchSettings>) => Promise<void>;
    formatCurrency: (amount: number) => string;
    loading: boolean;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

interface SettingsProviderProps {
    children: ReactNode;
    activeBranchId: string | null;
    activeBranch?: Branch;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
    children,
    activeBranchId,
    activeBranch
}) => {
    const { currentUser } = useAuth();
    const [allSettings, setAllSettings] = useState<Record<string, BranchSettings>>({
        [MAIN_BRANCH_ID]: DEFAULT_SETTINGS
    });
    const [loading, setLoading] = useState(true);

    // Fetch settings - always target the active branch for efficiency
    useEffect(() => {
        const fetchSettings = async () => {
            // Priority 1: activeBranchId from context (admin or staff)
            // Priority 2: branchId from URL hash (public customer / monitor views)
            const hash = window.location.hash;
            const customerMatch = hash.match(/\/customer\/branch\/([^\/]+)/);
            const monitorMatch = hash.match(/\/monitor\/([^\/]+)/);
            const urlBranchId = customerMatch?.[1] || monitorMatch?.[1] || null;

            const targetId = activeBranchId || urlBranchId;

            // ✅ FIX: Always use targeted fetch when we have a known branch ID.
            // Removed the fragile `!hash.includes('/dashboard')` guard that was
            // causing admin users on the dashboard to sometimes get empty settings.
            let query = supabase.from('branches').select('id, settings, restaurants(can_customer_view, feature_delivery)');
            
            const isGlobalPage = window.location.hash.includes('/restaurants') || 
                               window.location.hash.includes('/earnings') || 
                               window.location.hash.includes('/team-repartidor');

            if (targetId) {
                console.log(`🚀 SettingsContext: Targeted fetch for branch ${targetId}`);
                query = query.eq('id', targetId);
            } else if (currentUser?.role === 'SuperAdmin' && !isGlobalPage) {
                // Prevent mass download on initial mount/dashboard for SuperAdmin
                setLoading(false);
                return;
            }

            const { data, error } = await query;

            if (!error && data) {
                const mapped: Record<string, BranchSettings> = {};
                data.forEach((b: any) => {
                    const extraSettings = {
                        canCustomerView: b.restaurants?.can_customer_view ?? true,
                        featureDelivery: b.restaurants?.feature_delivery ?? true,
                    };

                    if (b.settings) {
                        mapped[b.id] = { ...b.settings, ...extraSettings };
                    } else if (activeBranch && activeBranch.id === b.id) {
                        mapped[b.id] = {
                            ...DEFAULT_SETTINGS,
                            restaurantName: activeBranch.name,
                            ...extraSettings
                        };
                    } else {
                        mapped[b.id] = { ...DEFAULT_SETTINGS, ...extraSettings };
                    }
                });
                setAllSettings(prev => ({ ...prev, ...mapped }));
            }
            setLoading(false);
        };

        let isMounted = true;
        let channel: any = null;

        const setupSubscription = async () => {
            // PILLAR 1: Zero-Realtime for Guests
            const isStaff = currentUser && (currentUser?.role === 'Admin' || currentUser?.role === 'SuperAdmin');
            if (!isMounted || !isStaff) return;

            console.log(`🔌 SettingsContext: Staff Session - monitoring ${activeBranchId || 'global'}`);
            
            // Real-time sync for settings changes
            channel = supabase
                .channel(`branches-settings-${activeBranchId || 'global'}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'branches',
                    filter: activeBranchId ? `id=eq.${activeBranchId}` : undefined
                }, payload => {
                    if (!isMounted) return;
                    const updated = (payload.new || payload.old) as any;
                    if (updated && updated.id && updated.settings) {
                        setAllSettings(prev => ({
                            ...prev,
                            [updated.id]: updated.settings
                        }));
                    }
                });

            channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ SettingsContext: Subscribed successfully to ${activeBranchId || 'global'}`);
                }
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.warn(`⚠️ SettingsContext: Subscription status: ${status}`);
                }
            });
        };

        fetchSettings();
        setupSubscription();

        return () => {
            isMounted = false;
            if (channel) {
                console.log(`🔌 SettingsContext: Cleaning up channel for branch ${activeBranchId || 'global'}`);
                supabase.removeChannel(channel);
            }
        };
    }, [activeBranchId, currentUser]);

    // Keep timezone perfectly synced with local storage whenever settings change
    useEffect(() => {
        if (activeBranchId && allSettings[activeBranchId]) {
            const tz = allSettings[activeBranchId].timezone;
            if (tz !== undefined && tz !== null) {
                setRestaurantTimezone(Number(tz));
            }
        }
    }, [activeBranchId, allSettings]);

    const branchSettings = activeBranchId ? allSettings[activeBranchId] : undefined;

    const saveBranchSettings = async (settings: Partial<BranchSettings>) => {
        if (!activeBranchId) return;

        const current = allSettings[activeBranchId] || DEFAULT_SETTINGS;
        const updated = { ...current, ...settings };

        // Save to Supabase
        const { error } = await supabase
            .from('branches')
            .update({ settings: updated })
            .eq('id', activeBranchId);

        if (error) {
            console.error("Error saving settings:", error);
            throw error;
        }

        // 2. Sync to Restaurant table if it's the main branch or we want to persist metadata
        if (activeBranch && activeBranch.restaurantId) {
            const restUpdate: any = {};
            if (settings.restaurantName) restUpdate.name = settings.restaurantName;
            if (settings.address) restUpdate.address = settings.address;
            if (settings.phone) restUpdate.phone = settings.phone;
            if (settings.logoImage) restUpdate.logo_url = settings.logoImage;

            if (Object.keys(restUpdate).length > 0 || settings.country || settings.city) {
                if (settings.country) restUpdate.country = settings.country;
                if (settings.city) restUpdate.city = settings.city;

                const { error: restError } = await supabase
                    .from('restaurants')
                    .update(restUpdate)
                    .eq('id', activeBranch.restaurantId);

                if (restError) console.error("Error syncing to restaurant table:", restError);
            }
        }

        // Local state will update via Realtime or manually
        setAllSettings(prev => ({
            ...prev,
            [activeBranchId]: updated
        }));
    };

    const formatCurrency = (amount: number) => {
        const symbol = (activeBranchId && allSettings[activeBranchId]?.currency) || '$';
        return `${symbol} ${amount.toFixed(2)}`;
    };

    const value: SettingsContextProps = useMemo(() => ({
        allSettings,
        branchSettings,
        saveBranchSettings,
        formatCurrency,
        loading
    }), [allSettings, branchSettings, activeBranchId, loading]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
