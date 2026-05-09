
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { OrderStatus } from '../types';
import {
    MapPin,
    Phone,
    CheckCircle,
    Clock,
    ExternalLink,
    Power,
    Coins,
    Navigation,
    ChevronRight,
    Info,
    Package,
    Store,
    Map as MapIcon,
    AlertCircle,
    Edit2,
    Check,
    X,
    MessageCircle,
    Truck,
    Star,
    Save,
    Globe
} from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

// Helper for distance calculation (Haversine Formula) in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
};

// Leaflet markers fix
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DeliveryDriverPage: React.FC = () => {
    const context = useAppContext();
    const formatCurrency = context?.formatCurrency || ((val: number) => `$ ${val.toFixed(2)}`);
    const { currentUser, updateCurrentUser } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [orderToTake, setOrderToTake] = useState<string | null>(null);
    const [isTakingOrder, setIsTakingOrder] = useState(false);
    const [stats, setStats] = useState({ totalOrders: 0, totalEarnings: 0 });
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
    const [editingCostId, setEditingCostId] = useState<string | null>(null);
    const [editingCostValue, setEditingCostValue] = useState<string>('');
    const ordersRef = useRef<any[]>([]);
    const finishedOrdersRef = useRef<Set<string>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);
    // Ref para acceder a la ubicación en callbacks sin recrearlos
    const driverLocationRef = useRef<{lat: number, lng: number} | null>(null);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setDriverLocation(loc);
                    driverLocationRef.current = loc;
                },
                (error) => console.log("DeliveryDriver: Geolocation permission denied or unavailable", error),
                { enableHighAccuracy: true }
            );
        }
    }, []);

    useEffect(() => {
        ordersRef.current = orders;
    }, [orders]);

    useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    }, []);

    const playNewOrderSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log("Audio play blocked, needs user interaction first", e));
        }
    }, []);

    // SYNC DRIVER STATS (Independent Database columns)
    const syncDriverProfile = useCallback(async () => {
        if (!currentUser) return;
        const { data, error } = await supabase
            .from('delivery_drivers')
            .select('credits, total_earnings, orders_completed, is_available, city, country, currency_symbol')
            .eq('id', currentUser.id)
            .single();

        if (!error && data) {
            updateCurrentUser({
                credits: data.credits,
                isAvailable: data.is_available,
                city: data.city,
                country: data.country,
                currency_symbol: data.currency_symbol || 'Bs'
            });
            setStats({
                totalOrders: data.orders_completed || 0,
                totalEarnings: Number(data.total_earnings) || 0
            });
        }
    }, [currentUser, updateCurrentUser]);

    // FETCH ORDERS (Separate Logic for Market vs Active)
    const fetchOrders = useCallback(async () => {
        if (!currentUser) return;

        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        try {
            const driverCity = ((currentUser as any).city || '').trim().toLowerCase();
            const driverCountry = ((currentUser as any).country || '').trim().toLowerCase();

            // ESTRATEGIA: Traer dos grupos de órdenes:
            // 1. Pedidos en el mercado (is_shared_with_drivers=true, sin asignar)
            // 2. Mis pedidos asignados (assigned_driver_id = yo)
            // El filtrado geográfico se hace en el CLIENTE para evitar problemas
            // de case-sensitivity en el servidor (ej: "Bolivia" vs "BOLIVIA").
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    branches (
                        id, 
                        name, 
                        settings, 
                        restaurant_id, 
                        restaurants (id, city, country)
                    ),
                    order_items (
                        *,
                        menu_item:menu_items(name, price),
                        variation:menu_item_variations(name)
                    )
                `)
                .gte('created_at', yesterday.toISOString())
                .or(`and(is_shared_with_drivers.eq.true,assigned_driver_id.is.null,status.neq.Cancelled,driver_flow_status.neq.delivered),and(assigned_driver_id.eq.${currentUser.id},driver_flow_status.neq.delivered,status.neq.Cancelled)`)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            const mapped = (data || [])
                .filter(o => {
                    // Ignorar pedidos que ya marcamos como entregados localmente
                    if (finishedOrdersRef.current.has(o.id)) return false;

                    // Si el pedido es mío: mostrar si NO está entregado AND NO está cancelado
                    if (o.assigned_driver_id === currentUser.id) {
                        if (o.status === 'Cancelled') return false;
                        return (o.driver_flow_status !== 'delivered');
                    }
                    // Si es del market: solo si está buscando repartidor (sin asignar)
                    return (o.is_shared_with_drivers === true && o.assigned_driver_id === null && o.status !== 'Cancelled' && o.driver_flow_status !== 'delivered');
                })
                .map(o => {
                    let branchDeliveryCost = 0;
                    let ps: any = null;
                    try {
                        const bs = o.branches?.settings;
                        ps = typeof bs === 'string' ? JSON.parse(bs) : bs;
                        branchDeliveryCost = ps?.deliveryCost || 0;
                    } catch (_) { }

                    const items = (o.order_items || []).map((i: any) => ({
                        menuItemName: i.menu_item?.name || i.name_snapshot || 'Producto',
                        variationName: i.variation?.name || null,
                        quantity: Number(i.quantity) || 0,
                        unitPrice: Number(i.unit_price) || 0,
                    }));

                    // Ciudad/país del restaurante: desde la relación branches→restaurants.
                    // Fallback a orders.city/country por si la relación no está disponible.
                    const restoCity = o.branches?.restaurants?.city || o.city;
                    const restoCountry = o.branches?.restaurants?.country || o.country;

                    return {
                        ...o,
                        assignedDriverId: o.assigned_driver_id,
                        dailyTicketNumber: o.daily_ticket_number,
                        totalAmount: Number(o.total_amount) || 0,
                        itemsSubtotal: items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0),
                        deliveryCost: Number(o.delivery_fee) > 0 ? Number(o.delivery_fee) : branchDeliveryCost,
                        shippingLat: Number(o.shipping_lat),
                        shippingLng: Number(o.shipping_lng),
                        shippingReference: o.shipping_reference,
                        customerPhone: o.customer_phone,
                        parsedItems: items,
                        driverFlowStatus: o.driver_flow_status || 'available',
                        restaurantMapsLink: ps?.restaurantMapsLink || null,
                        restaurantLocation: ps?.restaurantLocation || null,
                        restaurantCity: restoCity,
                        restaurantCountry: restoCountry
                    };
                })
                .filter(o => {
                    const isMarketOrder = !o.assignedDriverId;

                    // Pedidos activos asignados a mí: siempre mostrar
                    if (!isMarketOrder) return true;

                    // === VALIDACIÓN GEOGRÁFICA PARA PEDIDOS DEL MERCADO ===
                    // Si el repartidor no tiene ciudad/país configurado → no mostrar mercado
                    if (!driverCountry || !driverCity) {
                        console.log("🚫 Driver sin ciudad/país → mercado oculto");
                        return false;
                    }

                    // Obtener ciudad/país del restaurante (insensible a mayúsculas)
                    const orderCity = (o.restaurantCity || '').trim().toLowerCase();
                    const orderCountry = (o.restaurantCountry || '').trim().toLowerCase();

                    // Si el restaurante no tiene ciudad/país → no mostrar (protección)
                    if (!orderCity || !orderCountry) {
                        console.log("🚫 Pedido sin ciudad/país de restaurante → oculto:", o.id);
                        return false;
                    }

                    // Comparación insensible a mayúsculas (resuelve "Bolivia" vs "BOLIVIA")
                    const cityMatch = driverCity === orderCity;
                    const countryMatch = driverCountry === orderCountry;

                    if (!cityMatch || !countryMatch) {
                        return false;
                    }

                    // Validación de Radio (10km) solo si tenemos coordenadas de ambos
                    // Usamos ref para no depender del estado de GPS en useCallback
                    const loc = driverLocationRef.current;
                    if (loc && o.restaurantLocation) {
                        const dist = calculateDistance(loc.lat, loc.lng, o.restaurantLocation.lat, o.restaurantLocation.lng);
                        if (dist > 10) return false;
                    }

                    return true;
                });

            console.log("🚚 Drivers Fetch:", mapped.length, "orders (market+mine)");
            
            // Actualizar estado y reproducir sonido si hay nuevos pedidos en el mercado
            setOrders(prev => {
                const prevMarket = new Set(prev.filter(o => o.is_shared_with_drivers && !o.assignedDriverId).map(o => o.id));
                const newMarket = mapped.filter(o => o.is_shared_with_drivers && !o.assignedDriverId);
                const hasNewMarket = newMarket.some(o => !prevMarket.has(o.id));
                
                if (hasNewMarket) {
                    playNewOrderSound();
                }
                return mapped;
            });
            
        } catch (error) {
            console.error("Error fetching orders:", error);
        }
        setLoading(false);
    }, [currentUser]);


    useEffect(() => {
        if (!currentUser) return;
        syncDriverProfile();
        fetchOrders();

        let lastOrdersUpdated = '';
        let lastDriverUpdated = '';

        const checkUpdates = async () => {
            if (!currentUser || isTakingOrder || updatingOrderId || document.visibilityState !== 'visible') return;

            try {
                // 1. Check Orders Heartbeat
                const { data: orderData } = await supabase
                    .from('orders')
                    .select('updated_at')
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .single();

                if (orderData && orderData.updated_at) {
                    if (lastOrdersUpdated && orderData.updated_at !== lastOrdersUpdated) {
                        console.log("🔄 Soft-Polling: Cambios detectados en pedidos");
                        fetchOrders();
                    }
                    lastOrdersUpdated = orderData.updated_at;
                }

                // 2. Check Driver Profile Heartbeat
                const { data: driverData } = await supabase
                    .from('delivery_drivers')
                    .select('updated_at')
                    .eq('id', currentUser.id)
                    .single();

                if (driverData && driverData.updated_at) {
                    if (lastDriverUpdated && driverData.updated_at !== lastDriverUpdated) {
                        console.log("🔄 Soft-Polling: Cambios en el perfil del repartidor");
                        syncDriverProfile();
                    }
                    lastDriverUpdated = driverData.updated_at;
                }

            } catch (err) {
                // Silent catch for network drops during polling
            }
        };

        // Latido principal cada 3.5 segundos
        const heartbeat = setInterval(checkUpdates, 3500);

        // Mobile optimizations
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log("📱 App is visible, fetching orders...");
                fetchOrders();
                syncDriverProfile();
            }
        };

        const handleOnline = () => {
            console.log("🌐 Connectivity restored, fetching orders...");
            fetchOrders();
            syncDriverProfile();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);

        return () => {
            console.log(`🔌 DeliveryDriver cleanup: Deteniendo motor de latidos para ${currentUser.id}`);
            clearInterval(heartbeat);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
        };
    }, [currentUser, fetchOrders, syncDriverProfile, updateCurrentUser, playNewOrderSound, isTakingOrder, updatingOrderId]);

    const handleTakeOrder = async (orderId: string) => {
        if (!currentUser || (currentUser.credits || 0) <= 0) {
            alert('Sin créditos.');
            return;
        }

        setIsTakingOrder(true);
        const order = orders.find(o => o.id === orderId);
        const fee = order?.deliveryCost ?? 0;

        // INSTANT UI FEEDBACK: Close modal right away to feel fast
        setOrderToTake(null);

        try {
            const { data, error } = await supabase.rpc('driver_take_order', {
                p_order_id: orderId,
                p_driver_id: currentUser.id,
                p_delivery_fee: fee
            });

            if (error) throw error;
            if (data && !data.success) {
                // If the error is 'already taken', we should just refresh and inform
                if (data.error_message?.toLowerCase().includes('tomado')) {
                    alert('¡Lo sentimos! Otro repartidor tomó este pedido justo ahora.');
                    fetchOrders();
                    return;
                }
                throw new Error(data.error_message);
            }

            // SUCCESS: Now we update locally
            setOrders(prev => prev.map(o => {
                if (o.id === orderId) {
                    return { ...o, assignedDriverId: currentUser.id, driverFlowStatus: 'accepted' };
                }
                return o;
            }));
            
            // Sync profile correctly from server data if available
            if (data.remaining_credits !== undefined) {
                updateCurrentUser({ credits: data.remaining_credits });
            } else {
                syncDriverProfile();
            }
        } catch (err: any) {
            console.error("Error taking order:", err);
            alert('Error: ' + err.message);
            fetchOrders();
            syncDriverProfile();
        } finally {
            setIsTakingOrder(false);
        }
    };

    const handleResetStats = async () => {
        if (!window.confirm("¿Seguro que quieres reiniciar tus ganancias acumuladas y cantidad de entregas?")) return;
        try {
            const { error } = await supabase
                .from('delivery_drivers')
                .update({ total_earnings: 0, orders_completed: 0 })
                .eq('id', currentUser?.id);

            if (error) throw error;
            syncDriverProfile();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const updateStatus = async (orderId: string, status: 'delivered') => {
        if (updatingOrderId) return;

        // Prevent accidental double processing
        if (status === 'delivered' && finishedOrdersRef.current.has(orderId)) return;

        setUpdatingOrderId(orderId);

        // OPTIMISTIC UPDATE: Mark as delivered instantly and permanently
        if (status === 'delivered') {
            finishedOrdersRef.current.add(orderId);
        }

        const order = orders.find(o => o.id === orderId);
        setOrders(prev => prev.filter(o => o.id !== orderId)); // Remove from active view
        if (order) {
            setStats(prev => ({
                totalOrders: prev.totalOrders + 1,
                totalEarnings: prev.totalEarnings + (order.deliveryCost || 0)
            }));
        }

        try {
            const { data, error } = await supabase.rpc('driver_update_order_status', {
                p_order_id: orderId,
                p_driver_id: currentUser?.id,
                p_new_flow_status: status
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error_message);

            // Update delivered_time to calculate proper average time
            if (status === 'delivered') {
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({ delivered_time: new Date().toISOString() })
                    .eq('id', orderId);

                if (updateError) {
                    console.error("Failed to update delivered_time:", updateError);
                }
            } // This closes the previous if (status === 'delivered')

            // Sync profile only (do not call fetchOrders here to avoid stale read replica race conditions)
            syncDriverProfile();
        } catch (err: any) {
            alert('Error: ' + err.message);
            // Rollback optimistic removal
            if (status === 'delivered') finishedOrdersRef.current.delete(orderId);
            if (order) setOrders(prev => [order, ...prev]);
            syncDriverProfile();
        } finally {
            setUpdatingOrderId(null);
        }
    };

    const handleUpdateDeliveryCost = async (orderId: string) => {
        if (!editingCostValue) return;
        const newCost = Number(editingCostValue);
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        // Calculate new total
        const diff = newCost - (order.deliveryCost || 0);
        const newTotal = (order.totalAmount || 0) + diff;

        // Optimistic
        setOrders(prev => prev.map(o => o.id === orderId ? {
            ...o,
            delivery_fee: newCost,
            deliveryCost: newCost,
            totalAmount: newTotal,
            total_amount: newTotal
        } : o));
        setEditingCostId(null);

        try {
            // Using direct update. If this fails due to RLS, an RPC would be needed.
            // But usually drivers can update orders shared with them if RLS is configured.
            const { error } = await supabase
                .from('orders')
                .update({
                    delivery_fee: newCost,
                    total_amount: newTotal
                })
                .eq('id', orderId);

            if (error) throw error;
            console.log("✅ Tarifa actualizada exitosamente en DB");
        } catch (err: any) {
            console.error("❌ Error actualizando tarifa:", err);
            alert('Error actualizando tarifa: ' + err.message);
            fetchOrders();
        }
    };

    const activeOrders = orders.filter(o => o.assignedDriverId === currentUser?.id);
    const availableOrders = orders.filter(o => !o.assignedDriverId);

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 pb-24 dark:text-white">

            {/* KPI Tracker */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 shadow-xl border border-gray-100 dark:border-white/10 relative overflow-hidden">
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl flex items-center justify-center border-2 border-emerald-500 shadow-lg shadow-emerald-500/20">
                            <Navigation className="text-emerald-600" size={32} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white italic tracking-tighter uppercase mb-1">
                                {currentUser?.name || 'Repartidor'}
                            </h1>
                            <div className="flex flex-col gap-1 items-start">
                                <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-black inline-flex">
                                    <Coins size={14} className="mr-1" /> {currentUser?.credits || 0} créditos
                                </div>
                                {((currentUser as any)?.city || (currentUser as any)?.country) && (
                                    <div className="text-gray-500 dark:text-gray-400 text-xs font-bold inline-flex items-center">
                                        <Globe size={12} className="mr-1 opacity-70" />
                                        <span>{(currentUser as any)?.city}{(currentUser as any)?.city && (currentUser as any)?.country ? ', ' : ''}{(currentUser as any)?.country}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            const newStatus = !currentUser?.isAvailable;
                            await supabase.rpc('driver_toggle_availability', { p_driver_id: currentUser?.id, p_status: newStatus });
                            updateCurrentUser({ isAvailable: newStatus });
                        }}
                        className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${currentUser?.isAvailable ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}
                    >
                        <Power size={24} />
                        <span className="text-[8px] font-black mt-1 uppercase leading-none">{currentUser?.isAvailable ? 'ON' : 'OFF'}</span>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100 dark:border-white/10 relative">
                    <div className="text-center">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 leading-none">GANANCIAS</p>
                        <p className="text-2xl font-black text-emerald-600 tabular-nums">
                            {(currentUser as any)?.currency_symbol || 'Bs'} {stats.totalEarnings.toFixed(2)}
                        </p>
                    </div>
                    <div className="text-center border-l dark:border-white/10">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">ENTREGADOS</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalOrders}</p>
                    </div>
                    {/* RESET BUTTON */}
                    <button
                        onClick={handleResetStats}
                        className="absolute bottom-0 right-0 text-[8px] font-black text-gray-300 hover:text-red-400 uppercase transition-colors"
                    >
                        [Reiniciar]
                    </button>
                </div>
            </div>

            {/* Active Orders - BLUE/PURPLE Circle Reference (Full Data) */}
            {activeOrders.length > 0 && (
                <section>
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 italic">Mi Ruta en Proceso</h2>
                    <div className="space-y-4">
                        {activeOrders.map(order => {
                            const isUpdating = updatingOrderId === order.id;

                            return (
                                <div key={order.id} className="rounded-[2.5rem] p-6 text-white shadow-2xl relative overflow-hidden transition-all duration-500 bg-emerald-600">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex gap-2">
                                            <div className="bg-white/20 p-2 rounded-2xl flex items-center justify-center">
                                                <Package size={24} />
                                            </div>
                                            <a
                                                href={`#/monitor/${order.branch_id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Monitor Online del Restaurante"
                                                className="bg-red-500/90 hover:bg-red-500 text-white px-2 py-1 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-1.5 active:scale-95 border border-red-400/30"
                                            >
                                                <ExternalLink size={14} />
                                                <span className="text-[9px] uppercase font-black tracking-tighter leading-[1.1] text-left">
                                                    Monitor<br />Online
                                                </span>
                                            </a>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black opacity-70 tracking-tighter italic uppercase leading-none">ORDEN #{order.dailyTicketNumber}</span>
                                            <div className="flex flex-col items-end">
                                                <div className="text-3xl font-black italic tabular-nums leading-none mt-1 text-emerald-300">{formatCurrency(order.deliveryCost)}</div>
                                                <p className="text-[9px] font-black text-emerald-100 uppercase mt-0.5 tracking-tighter leading-none">Ganancia Envío</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div className="flex items-start">
                                            <Store size={18} className="mr-3 mt-1 opacity-70 flex-shrink-0" />
                                            <div className="truncate w-full pr-2">
                                                <span className="text-[9px] font-bold uppercase opacity-50 tracking-widest leading-none block mb-0.5">Restaurante</span>
                                                <a
                                                    href={
                                                        (order as any).restaurantMapsLink ||
                                                        ((order as any).restaurantLocation ? `https://www.google.com/maps/search/?api=1&query=${(order as any).restaurantLocation.lat},${(order as any).restaurantLocation.lng}` : '#')
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-extrabold text-lg leading-tight truncate uppercase flex items-center hover:underline hover:text-emerald-200 transition-colors w-fit"
                                                >
                                                    <span className="truncate">{(order as any).branches?.name}</span>
                                                    <ExternalLink size={12} className="ml-1.5 opacity-70 flex-shrink-0" />
                                                </a>
                                            </div>
                                        </div>
                                        <div className="flex items-start">
                                            <MapPin size={18} className="mr-3 mt-1 opacity-70 flex-shrink-0" />
                                            <div>
                                                <span className="text-[9px] font-bold uppercase opacity-50 tracking-widest leading-none">Destino del Cliente</span>
                                                <p className="font-bold text-sm leading-tight italic opacity-90 underline decoration-white/30">{order.shippingReference}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Detail - Only visible when assigned */}
                                    <div className="bg-white/10 rounded-3xl p-5 mb-6 border border-white/10 shadow-sm">
                                        <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-3 whitespace-nowrap overflow-hidden italic">Contenido del Pedido</p>
                                        <div className="space-y-2">
                                            {order.parsedItems?.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between text-sm font-bold">
                                                    <span className="opacity-80">{item.quantity}x {item.menuItemName}</span>
                                                    <span className="tabular-nums">{formatCurrency(item.unitPrice * item.quantity)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between text-xs font-bold text-white/60 mt-2">
                                                <span>Subtotal:</span>
                                                <span>{formatCurrency(order.itemsSubtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-bold text-emerald-300">
                                                <span>Pago Repartidor:</span>
                                                <span>{formatCurrency(order.deliveryCost)}</span>
                                            </div>
                                            <div className="border-t border-white/20 mt-3 pt-3 flex justify-between text-lg font-black italic tracking-tight">
                                                <span>Total a Cobrar</span>
                                                <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-3 gap-2">
                                            <a href={order.customerPhone ? `tel:${order.customerPhone}` : '#'} className="h-14 bg-white/20 rounded-2xl flex items-center justify-center transition-all hover:bg-white/30"><Phone size={22} /></a>
                                            <a href={order.customerPhone ? `https://wa.me/${order.customerPhone.replace(/\D/g, '')}` : '#'} target="_blank" className="h-14 bg-white/20 rounded-2xl flex items-center justify-center transition-all hover:bg-white/30"><MessageCircle size={22} /></a>
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${order.shippingLat},${order.shippingLng}`} target="_blank" className="h-14 bg-white text-emerald-950 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase shadow-xl transition-all active:scale-95"><MapIcon size={20} /> MAPS</a>
                                        </div>

                                        <button
                                            onClick={() => updateStatus(order.id, 'delivered')}
                                            disabled={isUpdating}
                                            className="w-full h-16 bg-white text-emerald-950 rounded-[1.5rem] flex items-center justify-center gap-2 font-black text-xs uppercase shadow-2xl active:scale-95 transition-all"
                                        >
                                            {isUpdating ? <Clock className="animate-spin" size={18} /> : <Star size={20} />}
                                            <span className="italic uppercase">Delivery Finalizado</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Marketplace - GREEN Circle Reference (Restricted Data) */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none">Pedidos Disponibles</h2>
                    <div className="flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1.5 rounded-full border border-yellow-200 dark:border-yellow-700/30">
                        <AlertCircle size={14} className="text-yellow-600" />
                        <span className="text-[9px] font-black text-yellow-700 dark:text-yellow-500 uppercase">Cuesta 1 Crédito</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {availableOrders.length === 0 ? (
                        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-[2.5rem] p-12 text-center border-2 border-dashed border-gray-100 dark:border-gray-800">
                            <Info className="mx-auto text-gray-300 mb-2 opacity-30" size={32} />
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest leading-loose">Escaneando nuevos pedidos...</p>
                        </div>
                    ) : availableOrders.map(order => (
                        <div key={order.id} className="bg-white dark:bg-gray-800 rounded-[2.2rem] p-6 border border-gray-100 dark:border-white/5 shadow-md space-y-5 transition-transform active:scale-[0.99]">
                            {/* Header: Tarifa Envío */}
                            <div className="flex items-center justify-between">
                                <div className="w-full bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-900 px-6 py-6 rounded-[2rem] shadow-lg flex flex-col items-center justify-center border-4 border-white/20">
                                    <p className="text-[11px] font-black text-white/80 uppercase tracking-[0.2em] mb-1 leading-none">GANANCIA REPARTIDOR</p>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-5xl font-black text-white tabular-nums leading-none tracking-tighter drop-shadow-md">
                                            {formatCurrency(order.deliveryCost)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Local Reference */}
                            <div className="flex items-start justify-between">
                                <div
                                    onClick={() => {
                                        if (order.restaurantMapsLink) window.open(order.restaurantMapsLink, '_blank');
                                    }}
                                    className={`flex items-center space-x-3 truncate ${order.restaurantMapsLink ? 'cursor-pointer hover:opacity-80' : ''}`}
                                >
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-sm"><Store size={20} /></div>
                                    <div className="truncate">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 leading-none">RESTAURANTE</p>
                                        <h4 className="font-extrabold text-gray-900 dark:text-white leading-tight truncate uppercase">
                                            {(order as any).branches?.name}
                                            {order.restaurantMapsLink && <MapPin size={10} className="inline ml-1 text-emerald-500 animate-bounce" />}
                                        </h4>
                                    </div>
                                </div>
                            </div>

                            {/* Location Reference */}
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${order.shippingLat},${order.shippingLng}`}
                                target="_blank"
                                className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl flex items-center transition-all border border-gray-100 dark:border-white/5 active:scale-95 group cursor-pointer shadow-inner"
                            >
                                <MapPin size={20} className="text-emerald-500 flex-shrink-0 mr-3" />
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate flex-1 underline decoration-emerald-200">{order.shippingReference || 'Ver Ubicación'}</span>
                                <ExternalLink size={16} className="text-gray-300 ml-2" />
                            </a>

                            {/* Map Preview */}
                            {order.shippingLat !== 0 && (
                                <div className="h-32 rounded-[1.5rem] overflow-hidden border border-gray-100 dark:border-white/5 grayscale opacity-80 contrast-125 hover:grayscale-0 transition-all duration-700 shadow-inner">
                                    <MapContainer center={[order.shippingLat, order.shippingLng]} zoom={15} zoomControl={false} dragging={false} scrollWheelZoom={false} className="h-full w-full pointer-events-none">
                                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                                        <Marker position={[order.shippingLat, order.shippingLng]} />
                                    </MapContainer>
                                </div>
                            )}

                            {/* Order Items Info hidden as per user request for available orders */}


                            {/* Action Button */}
                            <button
                                onClick={() => setOrderToTake(order.id)}
                                disabled={isTakingOrder}
                                className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 h-16 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2 text-sm shadow-xl active:scale-95"
                            >
                                TOMAR PEDIDO <ChevronRight size={20} />
                            </button>
                        </div>
                    ))
                    }
                </div >
            </section >

            {/* Confirmation Overlay */}
            {
                orderToTake && (
                    <div className="fixed inset-0 z-[9999] bg-gray-950/90 backdrop-blur-md flex items-center justify-center p-6 text-center">
                        <div className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 max-w-sm w-full shadow-2xl border border-white/5">
                            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-5 text-yellow-600 shadow-xl shadow-yellow-500/10"><AlertCircle size={40} /></div>
                            <h3 className="text-2xl font-black mb-3 dark:text-white uppercase tracking-tighter italic">¿Tomar Pedido?</h3>
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-8 leading-relaxed">Se descontará 1 crédito de tu cuenta personal.</p>
                            <div className="flex gap-4">
                                <button onClick={() => setOrderToTake(null)} className="flex-1 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl font-black uppercase text-[10px] tracking-widest dark:text-gray-300">Cerrar</button>
                                <button onClick={() => handleTakeOrder(orderToTake)} className="flex-1 h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Sí, Aceptar</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DeliveryDriverPage;
