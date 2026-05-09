
import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { PagerStatus, PagerLog, PagerState } from '../types';
import { supabase } from '../services/supabase';
import { useRestaurant } from './RestaurantContext';
import { useAuth } from './AuthContext';

interface PagerContextInternalState {
    pagerStatuses: Record<number, PagerStatus>;
    pagerLogs: PagerLog[];
}

const INITIAL_PAGER_STATE: PagerContextInternalState = {
    pagerStatuses: {},
    pagerLogs: []
};

interface PagerContextProps {
    pagerStatuses: Record<number, PagerStatus>;
    pagerLogs: PagerLog[];
    updatePagerStatus: (id: number, state: PagerState) => void;
    resetAllPagers: () => void;
}

const PagerContext = createContext<PagerContextProps | undefined>(undefined);

interface PagerProviderProps {
    children: ReactNode;
}

export const PagerProvider: React.FC<PagerProviderProps> = ({ children }) => {
    const { activeBranchId } = useRestaurant();
    const { currentUser } = useAuth();
    const [pagerState, setPagerState] = React.useState<PagerContextInternalState>({
        pagerStatuses: {},
        pagerLogs: []
    });

    React.useEffect(() => {
        if (!activeBranchId) {
            setPagerState({ pagerStatuses: {}, pagerLogs: [] });
            return;
        }

        // --- CACHE FALLBACK ---
        const CACHE_PAGERS = `ziroo_pagers_${activeBranchId}`;
        const CACHE_LOGS = `ziroo_pager_logs_${activeBranchId}`;

        const fetchPagersAndLogs = async () => {
            try {
                // 1. Fetch Statuses
                const { data: pagers, error: pError } = await supabase
                    .from('pagers')
                    .select('number, state, updated_at, elapsed, branch_id')
                    .eq('branch_id', activeBranchId);

                if (pError) throw pError;

                const map: Record<number, PagerStatus> = {};
                if (pagers) {
                    pagers.forEach(p => {
                        map[p.number] = {
                            id: p.number,
                            state: p.state as any,
                            timestamp: new Date(p.updated_at),
                            elapsed: p.elapsed
                        };
                    });
                    setPagerState(prev => ({ ...prev, pagerStatuses: map }));
                    localStorage.setItem(CACHE_PAGERS, JSON.stringify(map));
                }

                // 2. Fetch Logs (Only last 24h to save egress)
                const dateLimit = new Date();
                dateLimit.setHours(dateLimit.getHours() - 24);

                const { data: logs, error: lError } = await supabase
                    .from('pager_logs')
                    .select('id, pager_id, completion_time, duration_seconds')
                    .eq('branch_id', activeBranchId)
                    .gte('completion_time', dateLimit.toISOString());

                if (lError) throw lError;

                if (logs) {
                    const mappedLogs: PagerLog[] = logs.map(l => ({
                        id: l.id,
                        pagerId: l.pager_id,
                        completionTime: new Date(l.completion_time),
                        durationSeconds: l.duration_seconds
                    }));
                    setPagerState(prev => ({ ...prev, pagerLogs: mappedLogs }));
                    localStorage.setItem(CACHE_LOGS, JSON.stringify(mappedLogs));
                }
            } catch (err) {
                console.warn("⚠️ PagerContext: Fetch failed, using cache:", err);
                const cPagers = localStorage.getItem(CACHE_PAGERS);
                const cLogs = localStorage.getItem(CACHE_LOGS);
                if (cPagers) setPagerState(prev => ({ ...prev, pagerStatuses: JSON.parse(cPagers) }));
                if (cLogs) setPagerState(prev => ({ ...prev, pagerLogs: JSON.parse(cLogs) }));
            }
        };

        fetchPagersAndLogs();

        // Subscribe to changes (STAFF ONLY)
        let isMounted = true;
        let channel: any = null;
        let retryCount = 0;
        const MAX_RETRIES = 2;

        // AUTH CHECK FOR REALTIME (Pillar 1)
        const isStaff = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin' || currentUser.role === 'Waiter' || currentUser.role === 'Cashier' || currentUser.role === 'Cook');

        const setupSubscription = () => {
             if (!isMounted || !isStaff) return;

             console.log(`🔌 PagerContext: Staff session - Subscribing ${activeBranchId}`);
             channel = supabase
                .channel(`pagers_all_${activeBranchId}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'pagers', filter: `branch_id=eq.${activeBranchId}`
                }, (payload: any) => {
                    const updated = payload.new as any;
                    setPagerState(prev => {
                        const nextStatuses = { ...prev.pagerStatuses };
                        nextStatuses[updated.number] = {
                            id: updated.number,
                            state: updated.state as any,
                            timestamp: new Date(updated.updated_at),
                            elapsed: updated.elapsed
                        };
                        return { ...prev, pagerStatuses: nextStatuses };
                    });
                })
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'pager_logs', filter: `branch_id=eq.${activeBranchId}`
                }, (payload) => {
                    const newLog = payload.new as any;
                    setPagerState(prev => ({
                        ...prev,
                        pagerLogs: [...prev.pagerLogs, {
                            id: newLog.id,
                            pagerId: newLog.pager_id,
                            completionTime: new Date(newLog.completion_time),
                            durationSeconds: newLog.duration_seconds
                        }]
                    }));
                })
                .subscribe((status) => {
                    if (status === 'CHANNEL_ERROR') {
                        if (retryCount < MAX_RETRIES) {
                            retryCount++;
                            console.warn(`⚠️ Pager Realtime Error. Retry ${retryCount}/${MAX_RETRIES} in 5s...`);
                            setTimeout(() => { if (isMounted) setupSubscription(); }, 5000);
                        } else {
                            console.error("🚨 Pager Realtime: Max retries reached.");
                        }
                    } else if (status === 'SUBSCRIBED') {
                        retryCount = 0;
                    }
                });
        };

        if (isStaff) setupSubscription();

        const pollingInterval = setInterval(() => {
            if (isMounted) fetchPagersAndLogs();
        }, isStaff ? 60000 : 300000); // 1min for staff, 5min for guests

        return () => {
            isMounted = false;
            if (channel) supabase.removeChannel(channel);
            clearInterval(pollingInterval);
        };
    }, [activeBranchId, currentUser]);

    // Automatic cleanup for Basic Plans (Historical Data > 3 Weeks)
    const { currentRestaurant } = useRestaurant();

    React.useEffect(() => {
        if (!activeBranchId || !currentRestaurant) return;

        // Perform cleanup only if it's a Basic restaurant or has the basic feature enabled
        // Safety check: Don't run this every render, use a timeout or check once per session load
        const shouldRunCleanup = currentRestaurant.type === 'Basic' || currentRestaurant.features?.basicPagers;

        if (shouldRunCleanup) {
            const cleanupOldLogs = async () => {
                const threeWeeksAgo = new Date();
                threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21); // 21 Days
                const cutoffDate = threeWeeksAgo.toISOString();

                console.log(`🧹 [Basic Plan] Limpiando historial de pagers anterior a ${cutoffDate}...`);

                const { error } = await supabase
                    .from('pager_logs')
                    .delete()
                    .eq('branch_id', activeBranchId)
                    .lt('completion_time', cutoffDate);

                if (error) {
                    console.error("Error en limpieza automática de pagers:", error);
                } else {
                    console.log("✅ [Basic Plan] Historial antiguo eliminado correctamente.");
                }
            };

            // Run with a slight delay to not block initial render
            const timer = setTimeout(cleanupOldLogs, 5000);
            return () => clearTimeout(timer);
        }
    }, [activeBranchId, currentRestaurant]);

    const updatePagerStatus = async (id: number, state: PagerState) => {
        if (!activeBranchId) return;

        let elapsed: number | null = null;
        let shouldLog = false;
        let logDuration = 0;

        const currentStatus = pagerState.pagerStatuses[id];

        // Logic for transitions
        if (state === 'ready') {
            if (currentStatus && currentStatus.state === 'preparing') {
                const startTime = new Date(currentStatus.timestamp).getTime();
                const now = new Date().getTime();
                elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
            } else {
                elapsed = currentStatus?.elapsed || 0;
            }
        } else if (state === 'inactive') {
            if (currentStatus && currentStatus.state === 'ready') {
                shouldLog = true;
                logDuration = currentStatus.elapsed || 0;
            }
        }

        const nowIso = new Date().toISOString();

        // --- OPTIMISTIC UPDATE ---
        setPagerState(prev => {
            const nextStatuses = { ...prev.pagerStatuses };
            nextStatuses[id] = {
                id,
                state,
                timestamp: new Date(),
                elapsed: elapsed
            };

            let nextLogs = [...prev.pagerLogs];
            if (shouldLog) {
                // Temporary ID for optimistic log
                nextLogs.push({
                    id: `temp-${Date.now()}`,
                    pagerId: id,
                    completionTime: new Date(),
                    durationSeconds: logDuration
                });
            }

            return {
                pagerStatuses: nextStatuses,
                pagerLogs: nextLogs
            };
        });

        // 1. Update Current Status (DB)
        await supabase.from('pagers').upsert({
            branch_id: activeBranchId,
            number: id,
            state: state,
            elapsed: elapsed,
            updated_at: nowIso
        }, { onConflict: 'branch_id, number' });

        // 2. Insert Log if applicable (DB)
        if (shouldLog) {
            await supabase.from('pager_logs').insert({
                branch_id: activeBranchId,
                pager_id: id,
                completion_time: nowIso,
                duration_seconds: logDuration
            });
        }
    };

    const resetAllPagers = async () => {
        if (!activeBranchId) return;

        // --- OPTIMISTIC UPDATE ---
        setPagerState(prev => {
            const nextStatuses = { ...prev.pagerStatuses };
            // Reset all visible keys to inactive
            Object.keys(nextStatuses).forEach(key => {
                const k = Number(key);
                nextStatuses[k] = {
                    ...nextStatuses[k],
                    state: 'inactive',
                    elapsed: null, // Reset elapsed
                    timestamp: new Date()
                };
            });
            return {
                ...prev,
                pagerStatuses: nextStatuses
            };
        });

        // Set all to inactive for this branch
        await supabase
            .from('pagers')
            .update({ state: 'inactive', elapsed: null, updated_at: new Date().toISOString() })
            .eq('branch_id', activeBranchId);
    };

    const value: PagerContextProps = useMemo(() => ({
        pagerStatuses: pagerState.pagerStatuses,
        pagerLogs: pagerState.pagerLogs,
        updatePagerStatus: updatePagerStatus as any, // Cast due to type mismatch in state definition
        resetAllPagers
    }), [pagerState.pagerStatuses, pagerState.pagerLogs, activeBranchId]);

    return (
        <PagerContext.Provider value={value}>
            {children}
        </PagerContext.Provider>
    );
};

export const usePager = () => {
    const context = useContext(PagerContext);
    if (context === undefined) {
        throw new Error('usePager must be used within a PagerProvider');
    }
    return context;
};
