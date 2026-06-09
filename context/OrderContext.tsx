
import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { Order, OrderStatus, MenuItem, InventoryTransaction, CashRegister, MonthlySummary, Expense } from '../types';
import { supabase } from '../services/supabase';
import { INITIAL_ORDERS, MAIN_BRANCH_ID } from '../constants';
import { generateMonthlyReportData } from '../utils/reportGenerator';
import { useAuth } from './AuthContext';

interface OrderState {
    allOrders: Record<string, Order[]>;
    allInventoryTransactions: Record<string, InventoryTransaction[]>;
    allDailyCounters: Record<string, number>;
    allMonthlySummaries: Record<string, MonthlySummary[]>;
    allExpenses: Record<string, Expense[]>;
}

const INITIAL_ORDER_STATE: OrderState = {
    allOrders: { [MAIN_BRANCH_ID]: INITIAL_ORDERS },
    allInventoryTransactions: {},
    allDailyCounters: { [MAIN_BRANCH_ID]: 3 },
    allMonthlySummaries: {},
    allExpenses: {}
};

interface OrderContextProps {
    // Órdenes
    orders: Order[];
    allOrders: Record<string, Order[]>;
    addOrder: (order: Omit<Order, 'id' | 'timestamp' | 'dailyTicketNumber'>, branchId?: string) => { order: Order };
    updateOrderStatus: (id: string, status: OrderStatus, branchId?: string) => void;
    shareOrderWithDrivers: (id: string) => Promise<void>;
    fetchAllSystemOrders: () => Promise<void>;
    fetchAllGlobalSummaries: () => Promise<void>;
    fetchAllInventoryTransactions: () => Promise<void>; // New exposed action for Reports only

    // Inventario
    allInventoryTransactions: Record<string, InventoryTransaction[]>;
    addInventoryStock: (itemId: string, variationId: string | undefined, quantity: number) => void;
    setInventoryStock: (itemId: string, variationId: string | undefined, newStock: number | null) => void;
    updateInventoryTransaction: (id: string, quantity: number) => void;

    // Gastos (Expenses)
    expenses: Expense[];
    addExpense: (amount: number, description: string) => Promise<void>;

    // Contadores diarios
    allDailyCounters: Record<string, number>;

    // Caja (Cash Register)
    activeCashRegister: CashRegister | null;
    openCashRegister: (amount: number) => Promise<void>;
    closeCashRegister: (physicsAmount: number) => Promise<void>;
    allCashRegisters: CashRegister[];
    loadingRegisters: boolean;

    // Mantenimiento y Resúmenes
    allMonthlySummaries: Record<string, MonthlySummary[]>;
    archiveMonth: (year: number, month: number, settings: any) => Promise<void>;
    cleanupOldReceipts: (days?: number) => Promise<void>;
}

const OrderContext = createContext<OrderContextProps | undefined>(undefined);

interface OrderProviderProps {
    children: ReactNode;
    activeBranchId: string | null;
    currentUser: any; // User | SuperAdmin | null
    allMenuItems: Record<string, MenuItem[]>;
    updateMenuItemStock: (branchId: string, items: MenuItem[]) => void;
}

export const OrderProvider: React.FC<{
    children: ReactNode,
    activeBranchId: string | null,
    allMenuItems: Record<string, MenuItem[]>,
    updateMenuItemStock: (branchId: string, items: MenuItem[]) => void
}> = ({
    children,
    activeBranchId,
    allMenuItems,
    updateMenuItemStock
}) => {
    const { currentUser } = useAuth();
    const [orderState, setOrderState] = useState<OrderState>(INITIAL_ORDER_STATE);
    const [activeCashRegister, setActiveCashRegister] = useState<CashRegister | null>(null);
    const [allCashRegisters, setAllCashRegisters] = useState<CashRegister[]>([]);
    const [loadingRegisters, setLoadingRegisters] = useState(false);

    // ===== ANTI-LOOP: Refs to avoid stale closures & prevent infinite re-renders =====
    // Store currentUser in a ref so fetchOrders/fetchTransactions don't need it as a dep
    const currentUserRef = useRef(currentUser);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

    const activeBranchIdRef = useRef(activeBranchId);
    useEffect(() => { activeBranchIdRef.current = activeBranchId; }, [activeBranchId]);

    // Mount guard: ensures initial fetch only runs once per branch session
    const initialFetchDoneRef = useRef<string | null>(null);

    // Motor de latidos: Guarda la última fecha de actualización conocida de la sucursal
    const lastOrdersUpdateRef = useRef<number>(0);

    // Initial Fetch & Realtime Subscription
    const fetchCashRegisters = async (isSilent = false) => {
        if (!currentUser || (!activeBranchId && !isSilent)) return;
        if (!isSilent) setLoadingRegisters(true);
        try {
            let query = supabase
                .from('cash_registers')
                .select('id, branch_id, restaurant_id, opening_amount, closing_amount, expected_amount, difference, status, opened_at, closed_at, opened_by_name, closed_by_name');

            if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }
            if (currentUser?.role !== 'SuperAdmin' && currentUser?.restaurantId) {
                query = query.eq('restaurant_id', currentUser.restaurantId);
            }

            const { data: dbRegisters, error } = await query
                .order('opened_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            if (dbRegisters) {
                const mapped = dbRegisters.map(r => ({
                    id: r.id,
                    branchId: r.branch_id,
                    openingAmount: r.opening_amount,
                    closingAmount: r.closing_amount,
                    expectedAmount: r.expected_amount,
                    difference: r.difference,
                    status: r.status,
                    openedAt: new Date(r.opened_at),
                    closedAt: r.closed_at ? new Date(r.closed_at) : undefined,
                    openedByName: r.opened_by_name,
                    closedByName: r.closed_by_name
                } as CashRegister));

                setAllCashRegisters(mapped);
                localStorage.setItem(`ziroo_registers_${activeBranchId}`, JSON.stringify(mapped));

                // Set active if one is open
                const openRegister = mapped.find(r => r.status === 'open');
                setActiveCashRegister(openRegister || null);
            }
        } catch (e) {
            console.warn("⚠️ Using cached registers due to network error:", e);
            const cached = localStorage.getItem(`ziroo_registers_${activeBranchId}`);
            if (cached) {
                const mapped = JSON.parse(cached);
                setAllCashRegisters(mapped);
                const openRegister = mapped.find((r: any) => r.status === 'open');
                setActiveCashRegister(openRegister || null);
            }
        } finally {
            if (!isSilent) setLoadingRegisters(false);
        }
    };

    const mapRawOrder = (o: any): Order => {
        return {
            id: o.id,
            dailyTicketNumber: o.daily_ticket_number,
            tableId: o.table_id,
            status: o.status,
            timestamp: new Date(o.created_at),
            orderType: o.order_type,
            customerName: o.customer_name,
            paymentMethod: o.payment_method,
            totalAmount: o.total_amount,
            deliveryFee: o.delivery_fee,
            discount: o.discount,
            waiterName: o.waiter_name,
            cashPaid: o.cash_paid,
            qrPaid: o.qr_paid,
            paymentReceiptImage: o.payment_receipt_url,
            readyTime: o.ready_time ? new Date(o.ready_time) : undefined,
            deliveredTime: o.delivered_time ? new Date(o.delivered_time) : undefined,
            completionTime: (o.ready_time || o.delivered_time) ? Math.floor((new Date(o.ready_time || o.delivered_time).getTime() - new Date(o.created_at).getTime()) / 60000) : undefined,
            branchId: o.branch_id,
            source: o.source,
            notes: o.notes,
            customerNitCI: o.customer_nit_ci,
            customerComplement: o.customer_complement,
            customerDocType: o.customer_doc_type,
            fiscalNumber: o.fiscal_number,
            customerPhone: o.customer_phone,
            isSharedWithDrivers: o.is_shared_with_drivers,
            assigned_driver_id: o.assigned_driver_id,
            driverFlowStatus: o.driver_flow_status,
            items: (o.order_items || []).map((item: any) => ({
                menuItem: {
                    id: item.menu_item_id,
                    name: item.menu_item?.name || item.name_snapshot || 'Unknown',
                    price: Number(item.unit_price),
                    category: item.menu_item?.category_id || 'unknown',
                    isCombo: item.menu_item?.is_combo,
                    mainProductId: item.menu_item?.main_product_id,
                    mainVariantId: item.menu_item?.main_variant_id,
                    comboItems: item.menu_item?.combo_items
                },
                quantity: item.quantity,
                variation: item.variation_id ? { 
                    id: item.variation_id, 
                    name: item.variation?.name || 'Variación' 
                } : undefined,
                selectedExtras: (item.order_item_extras || []).map((ex: any) => ({
                    id: ex.extra_id,
                    name: ex.name_snapshot || 'Extra',
                    price: Number(ex.price_at_time || 0)
                }))
            })),
            assignedDriver: o.delivery_drivers ? {
                name: o.delivery_drivers.name,
                phone: o.delivery_drivers.phone,
                licenseNumber: o.delivery_drivers.license_number,
                profileImage: o.delivery_drivers.profile_image
            } : undefined
        } as Order;
    };

    // Dynamic timezone helper — reads from restaurant settings, falls back to browser clock.
    // No more hardcoded -4h Bolivia offset.
    const getLocalDayStart = (): string => {
        try {
            const stored = localStorage.getItem('ziroo_restaurant_timezone_offset');
            const offsetHours = stored !== null ? parseFloat(stored) : -(new Date().getTimezoneOffset() / 60);
            const offsetMs = offsetHours * 60 * 60 * 1000;
            const localNow = new Date(Date.now() + offsetMs);
            const year = localNow.getUTCFullYear();
            const month = String(localNow.getUTCMonth() + 1).padStart(2, '0');
            const day = String(localNow.getUTCDate()).padStart(2, '0');
            const startHour = String(Math.floor(-offsetHours)).padStart(2, '0');
            const startMin = String(Math.abs((-offsetHours % 1) * 60)).padStart(2, '0');
            return `${year}-${month}-${day}T${startHour}:${startMin}:00.000Z`;
        } catch (_) {
            // Absolute fallback: midnight UTC
            const d = new Date();
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}T00:00:00.000Z`;
        }
    };

    // ANTI-LOOP: fetchOrders uses refs instead of state vars as deps → stable reference across renders
    const fetchOrders = useCallback(async (isGlobal = false, branchIdOverride?: string, forceIncludeItems = false) => {
        const branchId = branchIdOverride || activeBranchIdRef.current;
        const user = currentUserRef.current;
        try {
            // SERVER-SIDE FILTER: Only fetch TODAY's Bolivia data for daily ops.
            // SuperAdmin/Global fetches 31 days for reporting.
            let dateLimitString;
            
            if (isGlobal) {
                const dateLimit = new Date();
                dateLimit.setDate(dateLimit.getDate() - 31);
                dateLimitString = dateLimit.toISOString();
            } else {
                // Dynamic timezone filter — no more hardcoded Bolivia UTC-4
                dateLimitString = getLocalDayStart();
            }

            let selectFields = `
                id, daily_ticket_number, table_id, status, created_at, order_type, customer_name, 
                payment_method, total_amount, discount, waiter_name, cash_paid, qr_paid, 
                payment_receipt_url, ready_time, delivered_time, branch_id, restaurant_id, source, notes, 
                customer_nit_ci, auto_cancelled, shipping_lat, shipping_lng, 
                shipping_reference, customer_phone, is_shared_with_drivers, assigned_driver_id,
                driver_flow_status, delivery_fee
            `;

            // CORTE RADICAL DE EGRESS: Si NO es Global (operación diaria) y hay usuario, se traen los detalles (items, extras).
            // Tambien si forceIncludeItems es true (pagina de historial especifica de una sucursal).
            if (!isGlobal || forceIncludeItems) {
                selectFields += `,
                delivery_drivers(name, phone, license_number, profile_image),
                order_items (
                    id, quantity, unit_price, name_snapshot, menu_item_id, variation_id,
                    menu_item:menu_items(id, name, price, category_id, is_combo, main_product_id, main_variant_id, combo_items),
                    variation:menu_item_variations(id, name),
                    order_item_extras (id, extra_id, name_snapshot, price_at_time)
                )`;
            }

            // OPTIMIZED SELECTS: Guests only need minimal fields for the monitor
            if (!user) {
                selectFields = 'id, daily_ticket_number, status, created_at, branch_id';
            }

            let query = supabase.from('orders').select(selectFields);

            if (branchIdOverride) {
                query = query.eq('branch_id', branchIdOverride);
            } else if (!isGlobal && branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query
                .gte('created_at', dateLimitString)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedOrders = data.map(mapRawOrder);
                
                if ((isGlobal && !branchIdOverride) || !branchId) {
                    const newGrouped: Record<string, Order[]> = {};
                    mappedOrders.forEach(o => {
                        if (!newGrouped[o.branchId]) newGrouped[o.branchId] = [];
                        newGrouped[o.branchId].push(o);
                    });
                    
                    setOrderState(prev => {
                        const merged = { ...prev.allOrders };
                        // Merge each branch's new orders
                        Object.entries(newGrouped).forEach(([bId, orders]) => {
                            merged[bId] = orders;
                        });
                        return { ...prev, allOrders: merged };
                    });
                    localStorage.setItem('ziroo_orders_global', JSON.stringify(newGrouped));
                } else {
                    setOrderState(prev => ({
                        ...prev,
                        allOrders: { ...prev.allOrders, [branchId]: mappedOrders }
                    }));
                    localStorage.setItem(`ziroo_orders_${branchId}`, JSON.stringify(mappedOrders));
                }
            }
        } catch (e) {
            console.warn("⚠️ Network error fetching orders, using cache:", e);
            const cacheKey = (isGlobal && !branchIdOverride) || !branchId ? 'ziroo_orders_global' : `ziroo_orders_${branchId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if ((isGlobal && !branchIdOverride) || !branchId) {
                    setOrderState(prev => {
                       const merged = { ...prev.allOrders };
                       Object.entries(parsed as Record<string, Order[]>).forEach(([bId, orders]) => {
                           merged[bId] = orders;
                       });
                       return { ...prev, allOrders: merged };
                    });
                } else {
                    setOrderState(prev => ({
                        ...prev,
                        allOrders: { ...prev.allOrders, [branchId]: parsed }
                    }));
                }
            }
        }
    // 🔑 KEY FIX: Empty deps array → fetchOrders is STABLE and never recreated.
    // It reads branchId/user from refs instead of closure, breaking the infinite loop.
    }, []);

    const fetchTransactions = useCallback(async (isGlobal = false, branchIdOverride?: string) => {
        const branchId = branchIdOverride || activeBranchId;
        const user = currentUser;
        if (!branchId || !user) return;

        try {
            let query = supabase
                .from('inventory_transactions')
                .select(`
                    id, branch_id, restaurant_id, menu_item_id, variation_id, quantity_change, created_at, created_by, type,
                    menu_item: menu_items(id, name),
                    variation: menu_item_variations(id, name),
                    user: user_profiles!inventory_transactions_created_by_fkey(full_name)
                `);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            let dateLimitString;
            let queryLimit;
            if (isGlobal) {
                const dateLimit = new Date();
                dateLimit.setDate(dateLimit.getDate() - 31);
                dateLimitString = dateLimit.toISOString();
                queryLimit = 3000;
            } else {
                dateLimitString = getLocalDayStart();
                queryLimit = 50;
            }

            const { data: dbTransactions, error: txError } = await query
                .order('created_at', { ascending: false })
                .gte('created_at', dateLimitString)
                .limit(queryLimit);

            if (txError) throw txError;

            if (dbTransactions) {
                const mappedTransactions = dbTransactions.map((tx: any) => {
                    let itemName = tx.menu_item?.name || 'Unknown Item';
                    if (tx.variation?.name) itemName += ` (${tx.variation.name})`;

                    return {
                        id: tx.id,
                        branchId: tx.branch_id,
                        menuItemId: tx.menu_item_id,
                        variationId: tx.variation_id,
                        itemName: itemName,
                        quantity: tx.quantity_change,
                        timestamp: new Date(tx.created_at),
                        userId: tx.created_by,
                        userName: tx.user?.full_name || 'Usuario',
                        type: tx.type
                    };
                });

                 setOrderState(prev => ({
                    ...prev,
                    allInventoryTransactions: { ...prev.allInventoryTransactions, [branchId]: mappedTransactions }
                }));
                localStorage.setItem(`ziroo_transactions_${branchId}`, JSON.stringify(mappedTransactions));
                localStorage.removeItem('DEBUG_TX_ERROR');
            }
        } catch (e: any) {
            console.warn("⚠️ Inventory fetch failed, checking cache:", e);
            localStorage.setItem('DEBUG_TX_ERROR', e?.message || JSON.stringify(e));
            const cached = localStorage.getItem(`ziroo_transactions_${branchId}`);
            if (cached) {
                setOrderState(prev => ({
                    ...prev,
                    allInventoryTransactions: { ...prev.allInventoryTransactions, [branchId]: JSON.parse(cached) }
                }));
            }
        }
    }, [activeBranchId, currentUser]);
    const fetchSummaries = async (isGlobal = false) => {
        if (!currentUser) return;
        try {
            let query = supabase
                .from('monthly_summaries')
                .select('id, branch_id, restaurant_id, year, month, operating_days, average_ticket, total_sales, created_at, daily_data_json');

            if (isGlobal && currentUser?.role === 'SuperAdmin') {
                // Global fetch: no branch filter, load ALL summaries for all branches
                console.log('🌐 Fetching ALL monthly summaries for SuperAdmin (Global mode)');
            } else if (currentUser?.role === 'SuperAdmin' && activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            } else if (currentUser?.restaurantId && currentUser?.restaurantId !== 'null') {
                query = query.eq('restaurant_id', currentUser.restaurantId);
            } else if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data: dbSummaries, error } = await query
                .order('year', { ascending: false })
                .order('month', { ascending: false });

            if (error) throw error;

            if (dbSummaries) {
                const mapped = dbSummaries.map(s => ({
                    id: s.id,
                    branchId: s.branch_id,
                    year: s.year,
                    month: s.month,
                    operatingDays: s.operating_days,
                    averageTicket: parseFloat(s.average_ticket),
                    totalSales: parseFloat(s.total_sales),
                    dailyDataJson: s.daily_data_json,
                    createdAt: new Date(s.created_at)
                } as MonthlySummary));

                if (isGlobal) {
                    // Group by branchId for global fetch
                    const grouped: Record<string, MonthlySummary[]> = {};
                    mapped.forEach(s => {
                        if (!grouped[s.branchId]) grouped[s.branchId] = [];
                        grouped[s.branchId].push(s);
                    });
                    setOrderState(prev => ({
                        ...prev,
                        allMonthlySummaries: { ...prev.allMonthlySummaries, ...grouped }
                    }));
                    localStorage.setItem('ziroo_summaries_global', JSON.stringify(grouped));
                } else {
                    setOrderState(prev => ({
                        ...prev,
                        allMonthlySummaries: { ...prev.allMonthlySummaries, [activeBranchId]: mapped }
                    }));
                    localStorage.setItem(`ziroo_summaries_${activeBranchId}`, JSON.stringify(mapped));
                }
            }
        } catch (e) {
            console.warn("⚠️ Summaries fetch failed, using cache:", e);
            if (isGlobal) {
                const cached = localStorage.getItem('ziroo_summaries_global');
                if (cached) {
                    setOrderState(prev => ({
                        ...prev,
                        allMonthlySummaries: { ...prev.allMonthlySummaries, ...JSON.parse(cached) }
                    }));
                }
            } else {
                const cached = localStorage.getItem(`ziroo_summaries_${activeBranchId}`);
                if (cached) {
                    setOrderState(prev => ({
                        ...prev,
                        allMonthlySummaries: { ...prev.allMonthlySummaries, [activeBranchId]: JSON.parse(cached) }
                    }));
                }
            }
        }
    };

    const fetchExpenses = async () => {
        if (!currentUser) return;
        try {
            let query = supabase
                .from('expenses')
                .select('id, branch_id, restaurant_id, cash_register_id, amount, description, created_by, created_at');

            const isGlobalPage = window.location.hash.includes('/restaurants') || 
                               window.location.hash.includes('/earnings') || 
                               window.location.hash.includes('/team-repartidor');

            if (currentUser?.role === 'SuperAdmin') {
                if (!isGlobalPage && activeBranchId) {
                    query = query.eq('branch_id', activeBranchId);
                }
            } else if (currentUser?.restaurantId && currentUser?.restaurantId !== 'null') {
                query = query.eq('restaurant_id', currentUser.restaurantId);
            } else if (activeBranchId) {
                query = query.eq('branch_id', activeBranchId);
            }

            const { data, error } = await query
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (data) {
                const mappedExpenses: Expense[] = data.map(e => ({
                    id: e.id,
                    branchId: e.branch_id,
                    cashRegisterId: e.cash_register_id,
                    amount: e.amount,
                    description: e.description,
                    createdBy: e.created_by,
                    createdAt: new Date(e.created_at)
                }));

                setOrderState(prev => ({
                    ...prev,
                    allExpenses: {
                        ...prev.allExpenses,
                        [activeBranchId]: mappedExpenses
                    }
                }));
                localStorage.setItem(`ziroo_expenses_${activeBranchId}`, JSON.stringify(mappedExpenses));
            }
        } catch (e) {
            console.warn("⚠️ Expenses fetch failed, checking cache:", e);
            const cached = localStorage.getItem(`ziroo_expenses_${activeBranchId}`);
            if (cached) {
                setOrderState(prev => ({
                    ...prev,
                    allExpenses: { ...prev.allExpenses, [activeBranchId]: JSON.parse(cached) }
                }));
            }
        }
    };

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        if (!activeBranchId) return;

        // 🔒 ANTI-LOOP: Only run initial fetch ONCE per branch ID.
        // Prevents repeated fetches when currentUser object identity changes (a common React pattern issue).
        if (initialFetchDoneRef.current === activeBranchId) {
            console.log(`🛡️ OrderContext: Fetch inicial ya realizado para ${activeBranchId}. Omitiendo.`);
            return;
        }
        initialFetchDoneRef.current = activeBranchId;
        console.log(`🚀 OrderContext: Iniciando fetch inicial para sucursal ${activeBranchId}`);

        // Fetch inicial de datos necesarios
        fetchCashRegisters();
        fetchOrders();
        fetchTransactions();
        fetchSummaries();
        fetchExpenses();

        let isMounted = true;

        // PILLAR 2: Soft-Polling de Alta Velocidad (El Bypass Final)
        // Ya que los WebSockets de Supabase bloquean los "Tokens de Sesión" personalizados, 
        // utilizamos una táctica de latido HTTP (Heartbeat) de 3 segundos que descarga SOLO un Timestamp.
        // Si el Timestamp cambia, se descarga la orden visualmente. Esto da "Tiempo Real simulado" sin castigar la base ni la red.
        const checkUpdates = async () => {
            if (!isMounted || !activeBranchId) return;
            const currentStaff = currentUserRef.current;
            const isStaff = currentStaff && (currentStaff.role === 'Admin' || currentStaff.role === 'SuperAdmin' || currentStaff.role === 'Waiter' || currentStaff.role === 'Cashier' || currentStaff.role === 'Cook');
            if (!isStaff) return; // Solo el staff revisa la frecuencia alta

            try {
                // Consulta ultra-ligera y atómica de la última hora de cambio 
                const { data, error } = await supabase
                    .from('orders')
                    .select('updated_at')
                    .eq('branch_id', activeBranchId)
                    .order('updated_at', { ascending: false })
                    .limit(1);

                if (!error && data && data.length > 0) {
                    const serverTimeMs = new Date(data[0].updated_at).getTime();
                    // Comparamos. Si el server tiene una fecha más nueva que nuestra cabeza local, recargamos la tabla entera.
                    if (serverTimeMs > lastOrdersUpdateRef.current) {
                        if (lastOrdersUpdateRef.current !== 0) { // No recargar si es el primer arranque (0)
                            console.log("⚡️ Soft-Polling: ¡Se detectó un cambio en la base de datos! Refrescando vista en vivo.");
                            fetchOrders();
                        }
                        lastOrdersUpdateRef.current = serverTimeMs;
                    }
                }
            } catch (e) {
                // Silencio en errores de red pasajeros
            }
        };

        // Latido cada 3500 milisegundos (3.5s)
        const activePollingInterval = setInterval(checkUpdates, 3500);

        return () => {
            isMounted = false;
            clearInterval(activePollingInterval);
        };
    // 🔑 KEY FIX: Only re-run when activeBranchId changes (not currentUser, which is an object).
    // currentUser is read from currentUserRef inside the effect to avoid stale values.
    }, [activeBranchId]);



    // Órdenes filtradas por sucursal activa
    const orders = useMemo(() => {
        return activeBranchId ? (orderState.allOrders[activeBranchId] || []) : [];
    }, [activeBranchId, orderState.allOrders]);

    const expenses = useMemo(() => {
        return activeBranchId ? (orderState.allExpenses[activeBranchId] || []) : [];
    }, [activeBranchId, orderState.allExpenses]);

    // Automatic rejection of orders older than 25 minutes (Awaiting Approval)
    useEffect(() => {
        if (!activeBranchId || orders.length === 0) return;

        const checkAutoRejection = async () => {
            const TWENTY_FIVE_MINUTES_MS = 25 * 60 * 1000;
            const now = Date.now();

            const pendingOrders = orders.filter(o => o.status === OrderStatus.AwaitingApproval);

            for (const order of pendingOrders) {
                const orderTime = new Date(order.timestamp).getTime();
                if (now - orderTime >= TWENTY_FIVE_MINUTES_MS) {
                    console.log(`Auto - cancelling order #${order.dailyTicketNumber} due to 25 - minute timeout`);
                    // Direct DB update. Realtime subscription will handle state updates.
                    await supabase
                        .from('orders')
                        .update({
                            status: OrderStatus.Cancelled,
                            auto_cancelled: true,
                            waiter_name: 'Sistema Auto-Cancelado'
                        })
                        .eq('id', order.id);
                }
            }
        };

        const interval = setInterval(checkAutoRejection, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [orders, activeBranchId]);


    // ===== CAJA (Cash Register) =====

    const openCashRegister = async (amount: number) => {
        if (!activeBranchId || !currentUser) return;

        const { data, error } = await supabase.from('cash_registers').insert({
            branch_id: activeBranchId,
            restaurant_id: currentUser.restaurantId,
            opening_amount: amount,
            status: 'open',
            opened_by_name: currentUser.name || currentUser.email
        }).select('id, branch_id, opening_amount, status, opened_by_name').single();

        if (error) throw error;

        // 3. Proactive Local Update
        setActiveCashRegister({
            id: data.id,
            branchId: data.branch_id,
            openingAmount: data.opening_amount,
            status: data.status,
            openedByName: data.opened_by_name
        });
        fetchCashRegisters(true);
    };

    const closeCashRegister = async (physicsAmount: number) => {
        if (!activeCashRegister || !currentUser) return;

        // 1. Get expected amount from the view or direct calculation
        const { data: summary } = await supabase
            .from('resumen_caja_actual')
            .select('total_cash_sales, cash_register_id')
            .eq('cash_register_id', activeCashRegister.id)
            .single();

        // Get expenses for this register
        const { data: dbExpenses } = await supabase
            .from('expenses')
            .select('amount')
            .eq('cash_register_id', activeCashRegister.id);

        const totalExpenses = dbExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;

        const totalCashSales = summary?.total_cash_sales || 0;
        const expected = activeCashRegister.openingAmount + totalCashSales - totalExpenses;

        const diff = physicsAmount - expected;

        // 2. Close it
        const { error } = await supabase.from('cash_registers').update({
            status: 'closed',
            closing_amount: physicsAmount,
            expected_amount: expected,
            difference: diff,
            closed_at: new Date().toISOString(),
            closed_by_name: currentUser.name || currentUser.email
        }).eq('id', activeCashRegister.id);

        if (error) throw error;

        // 3. Proactive Local Update
        setActiveCashRegister(null);
        fetchCashRegisters(true);
    };

    // ===== DATA RETENTION & CLEANUP =====

    // Helper: Auto-generate the monthly summary for a given month if it doesn't exist.
    // This ensures we never lose revenue data before cleaning up raw order details.
    const ensureMonthlySummaryExists = async (year: number, month: number, branchId: string): Promise<boolean> => {
        try {
            // Check if summary already exists
            const { data: existing } = await supabase
                .from('monthly_summaries')
                .select('id')
                .eq('branch_id', branchId)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();

            if (existing?.id) return true; // Already exists, safe to clean

            // Summary doesn't exist — generate it from raw orders
            console.log(`📊 Auto-generating summary for ${year}/${month} branch ${branchId}...`);

            const monthStart = new Date(year, month, 1).toISOString();
            const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();

            const { data: monthOrders } = await supabase
                .from('orders')
                .select('total_amount, delivery_fee, payment_method, cash_paid, qr_paid, created_at, status')
                .eq('branch_id', branchId)
                .gte('created_at', monthStart)
                .lte('created_at', monthEnd)
                .neq('status', 'Cancelled')
                .neq('status', 'AwaitingApproval');

            if (!monthOrders || monthOrders.length === 0) return true; // No orders to summarize

            // Aggregate totals
            const totalSales = monthOrders.reduce((sum, o) => sum + ((o.total_amount || 0) - (o.delivery_fee || 0)), 0);
            const averageTicket = totalSales / monthOrders.length;

            // Build daily breakdown
            const dailyMap: Record<string, { revenue: number; orders: number }> = {};
            monthOrders.forEach(o => {
                const dateKey = new Date(o.created_at).toLocaleDateString('en-CA');
                if (!dailyMap[dateKey]) dailyMap[dateKey] = { revenue: 0, orders: 0 };
                dailyMap[dateKey].revenue += (o.total_amount || 0) - (o.delivery_fee || 0);
                dailyMap[dateKey].orders += 1;
            });
            const dailyDataJson = Object.entries(dailyMap).map(([date, d]) => ({
                date,
                dateISO: date,
                revenue: d.revenue,
                orders: d.orders
            }));

            const operatingDays = Object.keys(dailyMap).length;

            // Get restaurant_id from the branch
            const { data: branchData } = await supabase
                .from('branches')
                .select('restaurant_id')
                .eq('id', branchId)
                .maybeSingle();

            const { error: insertError } = await supabase
                .from('monthly_summaries')
                .insert({
                    branch_id: branchId,
                    restaurant_id: branchData?.restaurant_id,
                    year,
                    month,
                    total_sales: totalSales,
                    average_ticket: averageTicket,
                    operating_days: operatingDays,
                    daily_data_json: dailyDataJson
                });

            if (insertError) {
                console.error('❌ Failed to auto-generate summary:', insertError);
                return false; // Don't clean if summary failed
            }

            console.log(`✅ Auto-generated summary for ${year}/${month}: ${totalSales} in ${operatingDays} days.`);
            return true;
        } catch (err) {
            console.error('ensureMonthlySummaryExists error:', err);
            return false;
        }
    };

    // Background cleanup of order details to save space
    useEffect(() => {
        const cleanupOldDetails = async () => {
            if (!activeBranchId) return;
            try {
                const FORTY_EIGHT_HOURS_AGO = new Date(Date.now() - 48 * 60 * 60 * 1000);
                const cutoffISO = FORTY_EIGHT_HOURS_AGO.toISOString();

                // Find which months have orders older than 48h (that we might clean)
                // We need to verify their monthly summary exists FIRST.
                const { data: oldOrders } = await supabase
                    .from('orders')
                    .select('created_at')
                    .eq('branch_id', activeBranchId)
                    .lt('created_at', cutoffISO)
                    .not('customer_name', 'eq', 'Anónimo') // Only uncleaned orders
                    .limit(50);

                if (!oldOrders || oldOrders.length === 0) {
                    console.log('🧹 Cleanup: No old orders to process.');
                    return;
                }

                // Find unique year/month combos that need cleanup
                const monthsToCheck = new Set<string>();
                oldOrders.forEach(o => {
                    const d = new Date(o.created_at);
                    monthsToCheck.add(`${d.getFullYear()}-${d.getMonth()}`);
                });

                // Ensure summary exists for EACH month before cleaning
                let allSummariesReady = true;
                for (const key of monthsToCheck) {
                    const [yr, mo] = key.split('-').map(Number);
                    const ready = await ensureMonthlySummaryExists(yr, mo, activeBranchId);
                    if (!ready) {
                        allSummariesReady = false;
                        console.warn(`⚠️ Skipping cleanup for ${yr}/${mo} — summary could not be generated.`);
                    }
                }

                if (!allSummariesReady) {
                    console.warn('⚠️ Cleanup partially skipped — some summaries missing.');
                    return;
                }

                // All summaries confirmed — safe to clean
                // 1. Delete order_item_extras
                await supabase
                    .from('order_item_extras')
                    .delete()
                    .lt('created_at', cutoffISO);

                // 2. Delete order_items
                await supabase
                    .from('order_items')
                    .delete()
                    .lt('created_at', cutoffISO);

                // 3. Sanitize PII — keep financial skeleton only
                const { error: sanitizeError } = await supabase
                    .from('orders')
                    .update({
                        customer_name: 'Anónimo',
                        customer_phone: null,
                        notes: null,
                        shipping_reference: null
                    })
                    .lt('created_at', cutoffISO)
                    .not('customer_name', 'eq', 'Anónimo');

                if (!sanitizeError) {
                    console.log('🧹 Data Lifecycle: Order details and PII cleaned after 48h (summaries verified).');
                }

            } catch (err) {
                console.error('Auto-cleanup error:', err);
            }
        };

        if (activeBranchId && currentUser?.role === 'SuperAdmin') {
            const timer = setTimeout(cleanupOldDetails, 10000); // 10s delay to let core data load first
            return () => clearTimeout(timer);
        }
    }, [activeBranchId, currentUser]);

    // ===== CREAR ORDEN =====

    const addOrder = async (
        orderData: Omit<Order, 'id' | 'timestamp' | 'dailyTicketNumber'>,
        targetBranchId?: string
    ) => {
        const branch = targetBranchId || activeBranchId;
        if (!branch) throw new Error("No branch selected");

        // CHECK CASH REGISTER
        // Note: For customers (public), activeCashRegister will be null because they lack permissions 
        // to read the cash_registers table. The DB trigger 'link_order_to_cash_register' handles 
        // the linking automatically on the server side if a box is open.
        if (!activeCashRegister && currentUser) {
            console.warn("Placing order without a local active cash register. Trying server-side link...");
        }

        const newOrderParams = {
            branch_id: branch,
            restaurant_id: currentUser?.restaurantId,
            table_id: orderData.tableId,
            status: orderData.status,
            order_type: orderData.orderType,
            payment_method: orderData.paymentMethod,
            total_amount: orderData.totalAmount,
            discount: orderData.discount || 0,
            waiter_name: orderData.waiterName,
            customer_name: orderData.customerName,
            notes: orderData.notes || '',
            cash_paid: orderData.cashPaid || 0,
            qr_paid: orderData.qrPaid || 0,
            payment_receipt_url: (orderData as any).paymentReceiptImage || null,
            source: orderData.source || 'pos',
            customer_nit_ci: orderData.customerNitCI || '',
            customer_complement: orderData.customerComplement || '',
            customer_doc_type: orderData.customerDocType || 1,
            fiscal_number: orderData.fiscalNumber || null,
            fiscal_control_code: orderData.fiscalControlCode || '',
            fiscal_base_amount: orderData.fiscalBaseAmount || orderData.totalAmount || 0,
            fiscal_debit_fiscal: orderData.fiscalDebitFiscal || ((orderData.totalAmount || 0) * 0.13),
            shipping_lat: orderData.shippingLat || null,
            shipping_lng: orderData.shippingLng || null,
            shipping_reference: orderData.shippingReference || '',
            customer_phone: orderData.customerPhone || '',
            delivery_fee: orderData.deliveryFee || 0
        };

        const itemsParams = orderData.items.map(item => ({
            menu_item_id: item.menuItem.id && item.menuItem.id.length > 20 ? item.menuItem.id : null,
            variation_id: item.variation?.id && item.variation.id.length > 20 ? item.variation.id : null,
            quantity: item.quantity,
            unit_price: item.variation ? (item.variation.price || item.menuItem.price) : item.menuItem.price,
            name_snapshot: item.menuItem.name,
            extras: item.selectedExtras || []
        }));

        // Usar RPC para inserción atómica y segura (evita problemas de RLS y desincronización)
        const { data: rpcData, error: rpcError } = await supabase.rpc('place_order_secure', {
            p_order: newOrderParams,
            p_items: itemsParams
        });

        if (rpcError) {
            console.error("Error in place_order_secure:", rpcError);
            throw new Error(`Database error: ${rpcError.message || 'Unknown error'} `);
        }

        if (!rpcData) {
            console.error("RPC returned no data");
            throw new Error("No se pudo crear el pedido. Por favor, intenta de nuevo.");
        }

        if (rpcData && !rpcData.success) {
            console.error("RPC Error:", rpcData.error);
            throw new Error(rpcData.error || "Error desconocido al crear el pedido");
        }

        const insertedOrder = rpcData;

        // Validate inserted order has required fields
        if (!insertedOrder.id || !insertedOrder.daily_ticket_number) {
            console.error("Invalid order response:", insertedOrder);
            throw new Error("Respuesta inválida del servidor. Por favor, verifica el pedido en la lista de órdenes.");
        }

        // TRIGGER RELOAD: Touch the order so 'orders' subscription fires again for Kitchen Displays
        try {
            await supabase
                .from('orders')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', insertedOrder.id);
        } catch (updateErr) {
            console.warn("Could not trigger order update (non-critical):", updateErr);
        }

        const newFullOrder = {
            ...orderData,
            id: insertedOrder.id,
            dailyTicketNumber: insertedOrder.daily_ticket_number,
            timestamp: new Date(insertedOrder.created_at)
        };

        // OPTIMISTIC UPDATE FOR ORDERS
        setOrderState(prev => {
            const currentOrders = prev.allOrders[branch] || [];
            return {
                ...prev,
                allOrders: {
                    ...prev.allOrders,
                    [branch]: [...currentOrders, newFullOrder]
                }
            };
        });

        // OPTIMISTIC UPDATE FOR STOCK
        const branchItems = allMenuItems[branch] || [];
        const stockUpdates = [...branchItems];
        let stockChanged = false;

        orderData.items.forEach(orderItem => {
            const itemId = orderItem.menuItem.id;
            const variationId = orderItem.variation?.id;
            const quantity = orderItem.quantity;

            const itemIndex = stockUpdates.findIndex(i => i.id === itemId);
            if (itemIndex !== -1) {
                const updatedItem = { ...stockUpdates[itemIndex] };
                
                if (variationId) {
                    if (updatedItem.variations) {
                        updatedItem.variations = updatedItem.variations.map(v =>
                            (v.id === variationId && v.stock !== undefined && v.stock !== null)
                                ? { ...v, stock: v.stock - quantity } 
                                : v
                        );
                        stockChanged = true;
                    }
                } else {
                    if (updatedItem.stock !== undefined && updatedItem.stock !== null) {
                        updatedItem.stock = updatedItem.stock - quantity;
                        stockChanged = true;
                    }
                }
                stockUpdates[itemIndex] = updatedItem;
            }
        });

        if (stockChanged) {
            updateMenuItemStock(branch, stockUpdates);
        }

        // STOCK DEDUCTION handled by DB Trigger (tr_deduct_stock)

        return { order: newFullOrder };
    };

    // ===== ACTUALIZAR ESTADO DE ORDEN =====

    const updateOrderStatus = async (id: string, status: OrderStatus, branchId?: string) => {
        const targetBranch = branchId || activeBranchId;

        // Usar RPC seguro para saltar limitaciones de RLS en actualizaciones complejas
        const { data: rpcData, error: rpcError } = await supabase.rpc('update_order_status_secure', {
            p_order_id: id,
            p_status: status,
            p_token: (currentUser as any)?.sessionToken || null
        });

        if (rpcError) {
            console.error("❌ OrderContext: Error in update_order_status_secure:", rpcError);
            alert(`Error de permisos: No se pudo actualizar el estado. (Code: ${rpcError.code})`);
            throw rpcError;
        }

        if (rpcData && !rpcData.success) {
            console.warn("⚠️ OrderContext: RPC returned failure:", rpcData.error);
            alert(`⚠️ ${rpcData.error} `);
            throw new Error(rpcData.error);
        }

        // Si llegamos aquí, la actualización en DB fue exitosa
        console.log(`✅ OrderContext: Order ${id} updated to ${status} via RPC`);

        // STOCK LOGIC: Handled by DB Triggers (tr_deduct_stock for new orders, tr_restore_stock for cancellations)

        setOrderState(prev => {
            const currentBranchOrders = prev.allOrders[targetBranch || ''] || [];
            const updatedOrders = currentBranchOrders.map(o => {
                if (o.id === id) {
                    const updatedOrder = { ...o, status: status };
                    if (status === OrderStatus.Ready) {
                        updatedOrder.readyTime = new Date();
                        if (updatedOrder.timestamp) {
                            updatedOrder.completionTime = Math.floor((updatedOrder.readyTime.getTime() - (updatedOrder.timestamp instanceof Date ? updatedOrder.timestamp.getTime() : new Date(updatedOrder.timestamp).getTime())) / 60000);
                        }
                    }
                    if (status === OrderStatus.Delivered) {
                        updatedOrder.deliveredTime = new Date();
                        // Only set completionTime if not already set by Ready status
                        if (!updatedOrder.completionTime && updatedOrder.timestamp) {
                            updatedOrder.completionTime = Math.floor((updatedOrder.deliveredTime.getTime() - (updatedOrder.timestamp instanceof Date ? updatedOrder.timestamp.getTime() : new Date(updatedOrder.timestamp).getTime())) / 60000);
                        }
                    }
                    return updatedOrder;
                }
                return o;
            });

            return {
                ...prev,
                allOrders: {
                    ...prev.allOrders,
                    [targetBranch || '']: updatedOrders
                }
            };
        });
    }

    const shareOrderWithDrivers = async (id: string) => {
        // Primero obtenemos la ciudad/país del restaurante para copiarlos en la orden
        // Esto permite que el filtrado geográfico del repartidor funcione correctamente
        let restaurantCity: string | null = null;
        let restaurantCountry: string | null = null;

        try {
            const { data: orderData } = await supabase
                .from('orders')
                .select('branch_id, branches(restaurants(city, country))')
                .eq('id', id)
                .single();

            if (orderData?.branches) {
                const restaurant = (orderData.branches as any)?.restaurants;
                restaurantCity = restaurant?.city || null;
                restaurantCountry = restaurant?.country || null;
            }
        } catch (e) {
            console.warn("No se pudo obtener ciudad/país del restaurante al compartir:", e);
        }

        const updatePayload: Record<string, any> = { 
            is_shared_with_drivers: true,
            updated_at: new Date().toISOString()
        };

        // Solo actualizar city/country si los tenemos disponibles (para no sobreescribir un valor existente con null)
        if (restaurantCity) updatePayload.city = restaurantCity;
        if (restaurantCountry) updatePayload.country = restaurantCountry;

        const { error } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', id);

        if (error) {
            console.error("Error sharing order with drivers:", error);
            throw error;
        }

        // Optimistic update
        setOrderState(prev => {
            const newAllOrders = { ...prev.allOrders };
            Object.keys(newAllOrders).forEach(branchId => {
                newAllOrders[branchId] = newAllOrders[branchId].map(o =>
                    o.id === id ? { ...o, isSharedWithDrivers: true } : o
                );
            });
            return { ...prev, allOrders: newAllOrders };
        });
    };

    // ===== AGREGAR STOCK MANUALMENTE =====

    const addInventoryStock = async (itemId: string, variationId: string | undefined, quantity: number, type: 'Restock' | 'Sale' | 'Return' = 'Restock') => {
        if (!activeBranchId || !currentUser) return;

        // 1. OPTIMISTIC UPDATE: Update MenuContext immediately
        const branchItems = allMenuItems[activeBranchId] || [];
        const newMenuItems = branchItems.map(item => {
            if (item.id === itemId) {
                const updatedItem = { ...item };
                if (variationId) {
                    if (updatedItem.variations) {
                        updatedItem.variations = updatedItem.variations.map(v =>
                            v.id === variationId ? { ...v, stock: (v.stock || 0) + quantity } : v
                        );
                    }
                } else {
                    updatedItem.stock = (updatedItem.stock || 0) + quantity;
                }
                return updatedItem;
            }
            return item;
        });

        // Push update to local state
        updateMenuItemStock(activeBranchId, newMenuItems);

        // 2. DATABASE UDPATE VIA RPC (Atomic)
        const { data: rpcData, error: rpcError } = await supabase.rpc('update_inventory_stock_secure', {
            p_item_id: itemId,
            p_variation_id: variationId || null,
            p_quantity_change: quantity,
            p_branch_id: activeBranchId,
            p_user_id: currentUser.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id) ? currentUser.id : null,
            p_type: type
        });

        if (rpcError) {
            console.error("Error in update_inventory_stock_secure:", rpcError);
        }

        if (rpcData && !rpcData.success) {
            console.error("RPC Error updating stock:", rpcData.error);
        }

        // 3. Proactive Local Update for Reports/Analytics (Añadidos column, Inventory logs)
        // Optimistic update for transactions so DailySales re-renders immediately with the added amount
        const newTx = {
            id: 'temp-' + Date.now(),
            branchId: activeBranchId,
            menuItemId: itemId,
            variationId: variationId || null,
            itemName: newMenuItems.find(m => m.id === itemId)?.name + (variationId ? ' (Variation)' : ''),
            quantity: quantity,
            timestamp: new Date(),
            userId: currentUser.id,
            userName: currentUser.full_name || 'Usuario',
            type: type
        };

        setOrderState(prev => {
            const currentBranchTxs = prev.allInventoryTransactions[activeBranchId] || [];
            return {
                ...prev,
                allInventoryTransactions: {
                    ...prev.allInventoryTransactions,
                    [activeBranchId]: [newTx, ...currentBranchTxs]
                }
            };
        });

        await fetchTransactions();
    };

    const setInventoryStock = async (itemId: string, variationId: string | undefined, newStock: number | null) => {
        if (!activeBranchId || !currentUser) return;

        // 1. OPTIMISTIC UPDATE
        const branchItems = allMenuItems[activeBranchId] || [];
        
        // Find current stock to calculate delta for the transaction log
        let currentStock = 0;
        const targetItem = branchItems.find(i => i.id === itemId);
        if (targetItem) {
            if (variationId) {
                currentStock = targetItem.variations?.find(v => v.id === variationId)?.stock || 0;
            } else {
                currentStock = targetItem.stock || 0;
            }
        }

        const newMenuItems = branchItems.map(item => {
            if (item.id === itemId) {
                const updatedItem = { ...item };
                if (variationId) {
                    if (updatedItem.variations) {
                        updatedItem.variations = updatedItem.variations.map(v =>
                            v.id === variationId ? { ...v, stock: newStock } : v
                        );
                    }
                } else {
                    updatedItem.stock = newStock;
                }
                return updatedItem;
            }
            return item;
        });
        updateMenuItemStock(activeBranchId, newMenuItems);

        // 2. DATABASE UDPATE VIA RPC (Atomic & Solves Zero-Delta Bug)
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('set_inventory_stock_secure', {
                p_item_id: itemId,
                p_variation_id: variationId || null,
                p_new_stock: newStock,
                p_branch_id: activeBranchId,
                p_user_id: currentUser.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id) ? currentUser.id : null
            });

            if (rpcError) {
                console.error("Error setting stock securely:", rpcError);
            }
            if (rpcData && !rpcData.success) {
                console.error("RPC Error setting stock:", rpcData.error);
            }
        } catch (error) {
            console.error("Unknown Execution Error setting stock:", error);
        }

        // 3. Proactive Local Update
        const quantityChange = (newStock || 0) - currentStock;
        const newTx = {
            id: 'temp-' + Date.now(),
            branchId: activeBranchId,
            menuItemId: itemId,
            variationId: variationId || null,
            itemName: newMenuItems.find(m => m.id === itemId)?.name + (variationId ? ' (Variation)' : ''),
            quantity: quantityChange, // Difference!
            timestamp: new Date(),
            userId: currentUser.id,
            userName: currentUser.full_name || 'Usuario',
            type: 'Adjustment'
        };

        setOrderState(prev => {
            const currentBranchTxs = prev.allInventoryTransactions[activeBranchId] || [];
            return {
                ...prev,
                allInventoryTransactions: {
                    ...prev.allInventoryTransactions,
                    [activeBranchId]: [newTx, ...currentBranchTxs]
                }
            };
        });

        await fetchTransactions();
    };

    const updateInventoryTransaction = (id: string, quantity: number) => {
    };

    const addExpense = async (amount: number, description: string) => {
        if (!activeBranchId || !currentUser) return;

        const expenseData = {
            branch_id: activeBranchId,
            restaurant_id: currentUser.restaurantId,
            cash_register_id: activeCashRegister?.id || null,
            amount: amount,
            description: description,
            created_by: currentUser.name || currentUser.email
        };

        const { error } = await supabase.from('expenses').insert(expenseData);

        if (error) {
            console.error("Error adding expense:", error);
            throw error;
        }

        // Realtime handles update
    };

    // ===== MANTENIMIENTO Y ARCHIVADO =====

    const cleanupOldReceipts = async (days: number = 3) => {
        if (!activeBranchId) return;

        try {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - days);

            const { data: oldOrders, error } = await supabase
                .from('orders')
                .select('id, payment_receipt_url')
                .eq('branch_id', activeBranchId)
                .lt('created_at', threeDaysAgo.toISOString())
                .not('payment_receipt_url', 'is', null);

            if (error) {
                console.error("Error fetching old orders for cleanup:", error);
                return;
            }

            if (oldOrders && oldOrders.length > 0) {
                console.log(`🧹 Iniciando limpieza de ${oldOrders.length} comprobantes antiguos...`);
                for (const order of oldOrders) {
                    if (order.payment_receipt_url) {
                        try {
                            const urlParts = order.payment_receipt_url.split('/');
                            const fileName = urlParts[urlParts.length - 1];
                            if (fileName) {
                                await supabase.storage.from('receipts').remove([fileName]);
                            }
                            await supabase.from('orders').update({ payment_receipt_url: null }).eq('id', order.id);
                        } catch (err) {
                            console.error("Error cleaning up receipt:", err);
                        }
                    }
                }
                console.log("✅ Limpieza completada.");
            }
        } catch (e) {
            console.error("Cleanup exception:", e);
        }
    };

    const archiveMonth = async (year: number, month: number, settings: any) => {
        if (!activeBranchId) return;
        try {
            const branchOrders = orderState.allOrders[activeBranchId] || [];
            const branchExpenses = orderState.allExpenses[activeBranchId] || [];
            const summaryData = generateMonthlyReportData(branchOrders, branchExpenses, settings, year, month);

            const dailyData = summaryData.dailyData.map(d => ({
                date: d.date,
                ticketsIssued: d.ticketsIssued,
                qrPayments: d.qrPayments,
                cashPayments: d.cashPayments,
                cancellations: d.cancellations,
                totalSales: d.totalSales
            }));

            // Calculate Ziroo Snapshot Counters
            const startOfMonth = new Date(year, month, 1).toISOString();
            const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
            
            // Only orders that truly belong to that exact month scope from the current local cache
            const monthOrders = branchOrders.filter(o => 
                o.timestamp && o.timestamp >= new Date(startOfMonth) && o.timestamp <= new Date(endOfMonth)
            );
            
            const onlineOrdersCount = monthOrders.filter(o =>
                (o.source === 'online' || o.waiterName === 'Customer App' || o.source === 'CustomerMenu') && 
                o.status !== 'Cancelled'
            ).length;

            // Fetch snapshot configuration for the restaurant directly from DB
            let subSnapshot = 0;
            let feeSnapshot = 0.20; // Default fallback

            try {
                // 1. Get global settings
                const { data: sysData } = await supabase.from('system_settings').select('settings').single();
                let gSubBasic = 30, gSubComplete = 50, gSubPro = 80, gSubPremium = 120, gOnlineFee = 0.20;
                
                if (sysData && sysData.settings && sysData.settings.costs) {
                    const c = sysData.settings.costs;
                    gSubBasic = c.basic || gSubBasic;
                    gSubComplete = c.complete || gSubComplete;
                    gSubPro = c.pro || gSubPro;
                    gSubPremium = c.premium || gSubPremium;
                    gOnlineFee = c.onlineOrderFee || gOnlineFee;
                }

                // 2. Get restaurant specific settings
                const { data: restData } = await supabase
                    .from('branches')
                    .select('restaurants(id, type, custom_plan_price, custom_online_fee)')
                    .eq('id', activeBranchId)
                    .maybeSingle();

                if (restData && restData.restaurants) {
                    const p = restData.restaurants as any;
                    const rType = (p.type || 'basic').toLowerCase();
                    
                    if (p.custom_plan_price !== null && p.custom_plan_price !== undefined) {
                        subSnapshot = Number(p.custom_plan_price);
                    } else {
                        if (rType === 'basic') subSnapshot = gSubBasic;
                        else if (rType === 'complete') subSnapshot = gSubComplete;
                        else if (rType === 'pro') subSnapshot = gSubPro;
                        else if (rType === 'premium') subSnapshot = gSubPremium;
                        else subSnapshot = gSubBasic;
                    }

                    if (p.custom_online_fee !== null && p.custom_online_fee !== undefined) {
                        feeSnapshot = Number(p.custom_online_fee);
                    } else {
                        feeSnapshot = gOnlineFee;
                    }
                }
            } catch (pricingErr) {
                console.warn("⚠️ Failed to snapshot pricing, using defaults:", pricingErr);
            }

            // Build upsert object dynamically to handle missing columns if necessary
            const upsertData: any = {
                branch_id: activeBranchId,
                year,
                month,
                operating_days: summaryData.operatingDays,
                total_sales: summaryData.totalSales,
                daily_data_json: dailyData,
                ziroo_online_orders_count: onlineOrdersCount,
                ziroo_subscription_snapshot: subSnapshot,
                ziroo_online_fee_snapshot: feeSnapshot
            };

            // Only add average_ticket if it exists in the schema or we are sure it's valid
            // we use summaryData.averageTicket but we surround with safety
            if (summaryData.averageTicket !== undefined) {
                upsertData.average_ticket = summaryData.averageTicket;
            }

            const { error: saveError } = await supabase
                .from('monthly_summaries')
                .upsert(upsertData, { onConflict: 'branch_id,year,month' });

            if (saveError) {
                console.error("❌ archiveMonth: Database error during upsert:", saveError);
                // Return false to indicate failure but don't crash
                return false;
            }

            await supabase
                .from('orders')
                .delete()
                .eq('branch_id', activeBranchId)
                .gte('created_at', startOfMonth)
                .lte('created_at', endOfMonth);

            console.log(`📦 Mes ${month + 1}/${year} archivado.`);
            return true;
        } catch (e) {
            console.error("Archiving exception (non-fatal):", e);
            return false;
        }
    };

    // Auto cleanup and auto archive (SECURITY PATCHED: No more loops)
    const [lastArchiveAttemptAt, setLastArchiveAttemptAt] = useState<number>(0);

    useEffect(() => {
        // Only Admins trigger background archiving to save Egress
        if (!activeBranchId || !currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'SuperAdmin')) return;
        
        // Anti-loop safety: Don't try to archive more than once every 10 minutes in the same session
        const TEN_MINUTES_MS = 10 * 60 * 1000;
        if (Date.now() - lastArchiveAttemptAt < TEN_MINUTES_MS) {
            console.log("🛡️ Archivo automático pausado (prevención de bucle). Próximo intento en 10 min.");
            return;
        }

        const checkAndAutoArchive = async () => {
            setLastArchiveAttemptAt(Date.now()); // Mark attempt immediately
            
            console.log("🔍 Verificando estado de archivado de mes previo...");
            
            const now = new Date();
            let lastMonth = now.getMonth() - 1;
            let lastYear = now.getFullYear();

            if (lastMonth < 0) {
                lastMonth = 11;
                lastYear--;
            }

            // Check if already archived — query DB directly to avoid depending on state (prevents loops)
            const { data: existingSummary } = await supabase
                .from('monthly_summaries')
                .select('id')
                .eq('branch_id', activeBranchId)
                .eq('year', lastYear)
                .eq('month', lastMonth)
                .maybeSingle();
            const isArchived = !!existingSummary;

            if (!isArchived) {
                console.log(`🤖 Auto-archivado: Detectado mes ${lastMonth + 1}/${lastYear} sin resumen...`);

                const { data: settingsData } = await supabase
                    .from('branches')
                    .select('name, settings')
                    .eq('id', activeBranchId)
                    .single();

                if (settingsData) {
                    const settings = {
                        restaurantName: settingsData.name,
                        taxId: settingsData.settings?.tax_id || '',
                        address: settingsData.settings?.address || '',
                        currency: settingsData.settings?.currency || ''
                    };

                    try {
                        const success = await archiveMonth(lastYear, lastMonth, settings);
                        if (success) {
                            console.log(`✅ Auto-archivado exitoso.`);
                        } else {
                            console.warn("⚠️ Falló el archivado automático. Se reintentará en la próxima sesión o en 10 minutos.");
                        }
                    } catch (err) {
                        console.error("Error in auto-archive execution:", err);
                    }
                }
            }
        };

        // Delay a bit to ensure orders/summaries are loaded properly first
        const timer = setTimeout(checkAndAutoArchive, 10000); // 10s wait
        return () => clearTimeout(timer);
    // 🔑 KEY FIX: No longer depends on orderState.allMonthlySummaries (changing array length → bucle).
    // Instead, the archive check queries DB directly for idempotent verification.
    }, [activeBranchId, currentUser?.role]);

    // ===== LIMPIEZA SELECTIVA: Borra detalles de pedidos >48h ya totalizados =====
    // Solo corre UNA vez al montar por usr Admin/SuperAdmin. Reduce egress futuro.
    const cleanupDetailsDoneRef = useRef(false);
    useEffect(() => {
        if (!activeBranchId || !currentUser) return;
        if (currentUser.role !== 'Admin' && currentUser.role !== 'SuperAdmin') return;
        if (cleanupDetailsDoneRef.current) return;
        cleanupDetailsDoneRef.current = true;

        const runSelectiveCleanup = async () => {
            // Only delete details that are >48 hours old (safe window for operations)
            const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

            try {
                // Step 1: Delete order_item_extras linked to old orders (child table first)
                const { error: extrasErr } = await supabase
                    .from('order_item_extras')
                    .delete()
                    .lt('created_at', fortyEightHoursAgo);

                // Step 2: Delete order_items rows older than 48h
                const { error: itemsErr } = await supabase
                    .from('order_items')
                    .delete()
                    .lt('created_at', fortyEightHoursAgo);

                if (!extrasErr && !itemsErr) {
                    console.log("🧹 Limpieza selectiva: detalles de pedidos >48h eliminados. Egress futuro reducido.");
                } else {
                    if (extrasErr) console.warn("⚠️ Cleanup extras error (non-fatal):", extrasErr.message);
                    if (itemsErr) console.warn("⚠️ Cleanup items error (non-fatal):", itemsErr.message);
                }
            } catch (err) {
                console.warn("⚠️ Selective cleanup exception (non-fatal):", err);
            }
        };

        // Run with a delay to not compete with initial data load
        const timer = setTimeout(runSelectiveCleanup, 15000);
        return () => clearTimeout(timer);
    }, [activeBranchId, currentUser?.role]);

    const fetchAllSystemOrders = useCallback(async () => {
        await fetchOrders(true);
    }, [fetchOrders]);

    const fetchAllGlobalSummaries = useCallback(async () => {
        await fetchSummaries(true);
    }, [fetchSummaries]);

    const fetchAllInventoryTransactions = useCallback(async () => {
        await fetchTransactions(true);
    }, [fetchTransactions]);

    const value: OrderContextProps = useMemo(() => ({
        orders,
        allOrders: orderState.allOrders,
        addOrder: addOrder as any,
        updateOrderStatus: updateOrderStatus as any,
        shareOrderWithDrivers: shareOrderWithDrivers as any,
        allInventoryTransactions: orderState.allInventoryTransactions,
        addInventoryStock: addInventoryStock as any,
        setInventoryStock: setInventoryStock as any,
        updateInventoryTransaction,
        expenses,
        addExpense,
        allDailyCounters: orderState.allDailyCounters,
        activeCashRegister,
        openCashRegister,
        closeCashRegister,
        allCashRegisters,
        loadingRegisters,
        allMonthlySummaries: orderState.allMonthlySummaries,
        archiveMonth,
        cleanupOldReceipts,
        fetchOrders,
        fetchAllSystemOrders,
        fetchAllGlobalSummaries,
        fetchAllInventoryTransactions
    }), [
        orders,
        orderState.allOrders,
        orderState.allInventoryTransactions,
        expenses,
        activeCashRegister,
        allCashRegisters,
        loadingRegisters,
        orderState.allDailyCounters,
        orderState.allMonthlySummaries,
        fetchOrders,
        fetchAllSystemOrders,
        fetchAllGlobalSummaries,
        fetchAllInventoryTransactions
    ]);

    return (
        <OrderContext.Provider value={value}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrder = () => {
    const context = useContext(OrderContext);
    if (context === undefined) {
        throw new Error('useOrder must be used within an OrderProvider');
    }
    return context;
};
