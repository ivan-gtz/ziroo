
import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { UserRole, OrderStatus, Order } from '../types';
import { playSound, triggerVibration } from '../utils/notifications';
import { BellRing, X } from 'lucide-react';
import { supabase } from '../services/supabase';

const NotificationManager: React.FC = () => {
    const { currentUser, orders, t, activeBranchId, systemSettings, allSettings } = useAppContext();
    const settings = activeBranchId ? allSettings[activeBranchId] : null;
    const prevOrderIdsRef = useRef<string[]>([]);
    const lastBranchIdRef = useRef<string | null>(null);
    const prevOrdersRef = useRef<Order[]>([]);
    const [notifState, setNotifState] = React.useState<'blocked' | 'prompt' | 'granted'>('prompt');
    const [audioUnlocked, setAudioUnlocked] = React.useState(() => {
        return localStorage.getItem('guest_audio_unlocked') === 'true';
    });
    const [dismissed, setDismissed] = React.useState(false);

    // Sync notification status
    useEffect(() => {
        if (!('Notification' in window)) return;
        setNotifState(Notification.permission as any);
    }, []);

    const unlockNotifications = async () => {
        setDismissed(true); // Close immediately on interaction
        const permission = await Notification.requestPermission();
        setNotifState(permission as any);

        if (permission === 'granted') {
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                gain.gain.value = 0;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(0);
                osc.stop(0.1);
                setAudioUnlocked(true);
                localStorage.setItem('guest_audio_unlocked', 'true');
                console.log("🔊 Audio Context Unlocked");
                playSound('new_order');
            } catch (e) {
                console.error("Error unlocking audio", e);
            }
        }
    };

    useEffect(() => {
        if (activeBranchId !== lastBranchIdRef.current) {
            prevOrderIdsRef.current = orders.map(o => o.id);
            lastBranchIdRef.current = activeBranchId || null;
        }
    }, [activeBranchId, orders]);

    useEffect(() => {
        if (!currentUser) {
            prevOrderIdsRef.current = orders.map(o => o.id);
            prevOrdersRef.current = [...orders];
            return;
        }

        const currentIds = orders.map(o => o.id);
        if (prevOrderIdsRef.current.length === 0 && currentIds.length > 0) {
            prevOrderIdsRef.current = currentIds;
            prevOrdersRef.current = [...orders];
            return;
        }

        const newOrders = orders.filter(o => !prevOrderIdsRef.current.includes(o.id));
        const icon = systemSettings.pwaIconUrl || '/logo-green.png';

        const sendNotif = async (title: string, body: string, type: 'new_order' | 'kitchen' | 'ready', tag: string) => {
            if (settings?.enableSound !== false) playSound(type);
            if (settings?.enableVibration !== false) triggerVibration(type);

            if ('serviceWorker' in navigator && Notification.permission === 'granted') {
                try {
                    const registration = await navigator.serviceWorker.ready;

                    // Send message to Service Worker
                    if (registration.active) {
                        registration.active.postMessage({
                            type: 'SHOW_NOTIFICATION',
                            title,
                            body,
                            icon,
                            tag
                        });
                    }

                    // Also show directly
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const notifOptions: any = { body, icon, tag, badge: icon, vibrate: [500, 200, 500, 200, 500], requireInteraction: true, renotify: true };
                    registration.showNotification(title, notifOptions);
                } catch (error) {
                    console.error('Error showing notification:', error);
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(title, { body, icon, tag, requireInteraction: true });
                    }
                }
            } else if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body, icon, tag, requireInteraction: true });
            }
        };

        // 1. Logged-in Role logic
        if (currentUser && newOrders.length > 0) {
            if (currentUser.role === UserRole.Cashier || currentUser.role === UserRole.Admin) {
                const onlineOrders = newOrders.filter(o => (o.source === 'online' || o.waiterName === 'Customer App' || o.source === 'CustomerMenu'));
                if (onlineOrders.length > 0) {
                    const latest = onlineOrders[0];
                    sendNotif(`🎫 ¡NUEVO PEDIDO ONLINE!`, `#${latest.dailyTicketNumber} - ${latest.customerName || 'Cliente'} (${latest.totalAmount} Bs)`, 'new_order', `new-order-${latest.id}`);
                }
            }

            // Delivery Driver: Notification for assigned orders (status change is below, this is for NEWly assigned ones appearing)
            if (currentUser.role === UserRole.DeliveryDriver) {
                const assignedToMe = newOrders.filter(o => o.assignedDriverId === currentUser.id);
                if (assignedToMe.length > 0) {
                    const latest = assignedToMe[0];
                    sendNotif(`🚚 ¡PEDIDO ASIGNADO!`, `#${latest.dailyTicketNumber} - ${latest.customerName || 'Cliente'}`, 'new_order' as any, `assigned-order-${latest.id}`);
                }
            }
            if (currentUser.role === UserRole.Cook) {
                const kitchenOrders = newOrders.filter(o => o.status === OrderStatus.Pending || o.status === OrderStatus.Preparing);
                if (kitchenOrders.length > 0) {
                    const latest = kitchenOrders[0];
                    sendNotif(`👨‍🍳 ¡NUEVA COMANDA!`, `#${latest.dailyTicketNumber} - ${latest.orderType === 'takeaway' ? 'Para Llevar' : 'Mesa ' + latest.tableId}`, 'kitchen', `kitchen-order-${latest.id}`);
                }
            }
        }

        // 2. Status change logic (Waiters & Customers)
        orders.forEach(order => {
            const prevOrder = prevOrdersRef.current.find(po => po.id === order.id);
            if (!prevOrder) return;

            // Waiter / Admin / Cashier notification
            if (currentUser?.role === UserRole.Waiter || currentUser?.role === UserRole.Admin || currentUser?.role === UserRole.Cashier) {
                if (order.status === OrderStatus.Ready && prevOrder.status !== OrderStatus.Ready) {
                    sendNotif(`✅ ${t('notifications.order_ready') || 'PEDIDO LISTO'}`, `#${order.dailyTicketNumber} - ${order.orderType === 'takeaway' ? 'Para Llevar' : (order.orderType === 'delivery' ? 'DELIVERY' : 'Mesa ' + order.tableId)}`, 'ready' as any, `ready-order-${order.id}`);
                }
            }

            // CUSTOMER NOTIFICATION (Guest) - Enhanced
            if (activeBranchId) {
                const key = `trackedTickets_v2_${activeBranchId}`;
                const stored = localStorage.getItem(key);
                if (stored) {
                    try {
                        const tracked = JSON.parse(stored) as { id: string }[];
                        const isTracked = tracked.some(t => t.id === order.dailyTicketNumber.toString());
                        if (isTracked && order.status === OrderStatus.Ready && prevOrder.status !== OrderStatus.Ready) {
                            console.log('🔔 Customer order ready!', order.dailyTicketNumber);
                            sendNotif(
                                t('monitor.your_order_is_ready') || "✅ TU PEDIDO ESTÁ LISTO",
                                `#${order.dailyTicketNumber} - ${t('monitor.is_ready_pickup') || 'Puedes pasar a recogerlo'}`,
                                'ready' as any,
                                `guest-ready-${order.id}`
                            );
                        }
                    } catch (e) {
                        console.error("Error parsing tracked tickets", e);
                    }
                }
            }
        });

        prevOrderIdsRef.current = currentIds;
        prevOrdersRef.current = [...orders];
    }, [orders, currentUser, t, systemSettings.pwaIconUrl, audioUnlocked, activeBranchId, settings]);

    useEffect(() => {
        if (!currentUser || currentUser.role !== UserRole.DeliveryDriver || !audioUnlocked || notifState !== 'granted') return;

        let isMounted = true;
        console.log("🚚 Setting up Marketplace Listener for Driver Notifications");

        const driverCity = ((currentUser as any).city || '').trim().toLowerCase();
        const driverCountry = ((currentUser as any).country || '').trim().toLowerCase();

        if (!driverCity || !driverCountry) {
            console.log("🚫 Driver sin ciudad/país configurado. No se configurarán notificaciones del mercado.");
            return;
        }

        const setupSubscription = () => {
            console.log(`🔌 NotificationManager: Iniciando Marketplace Listener para driver ${currentUser.id}`);
            
            const channel = supabase.channel(`driver-market-notifs-${currentUser.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `is_shared_with_drivers=eq.true`
                }, async (payload) => {
                    if (!isMounted) return;
                    
                    const order = payload.new;
                    if (
                        order &&
                        order.is_shared_with_drivers &&
                        !order.assigned_driver_id &&
                        order.status !== 'Cancelled' &&
                        order.driver_flow_status !== 'delivered'
                    ) {
                        const tag = `market-order-${order.id}`;

                        const { data: fullOrder } = await supabase
                            .from('orders')
                            .select('daily_ticket_number, total_amount, city, country, branches(name, restaurants(city, country))')
                            .eq('id', order.id)
                            .single();

                        if (!fullOrder || !isMounted) return;

                        const rawOrderCity = (fullOrder.branches as any)?.restaurants?.city || fullOrder.city;
                        const rawOrderCountry = (fullOrder.branches as any)?.restaurants?.country || fullOrder.country;

                        if (!rawOrderCity || !rawOrderCountry) return;

                        const orderCity = rawOrderCity.trim().toLowerCase();
                        const orderCountry = rawOrderCountry.trim().toLowerCase();

                        if (driverCity !== orderCity || driverCountry !== orderCountry) return;

                        console.log(`✅ Notif Mercado: Coincidencia geográfica (${driverCity}, ${driverCountry}). Enviando.`);

                        const icon = systemSettings.pwaIconUrl || '/logo-green.png';
                        if (settings?.enableSound !== false) playSound('new_order');
                        if (settings?.enableVibration !== false) triggerVibration('new_order');

                        if ('serviceWorker' in navigator) {
                            const reg = await navigator.serviceWorker.ready;
                            if (!isMounted) return;
                            const driverCurrency = (currentUser as any).currency_symbol || 'Bs';
                            reg.showNotification(`🔔 ¡NUEVO PEDIDO DISPONIBLE!`, {
                                body: `#${fullOrder.daily_ticket_number} - ${(fullOrder.branches as any)?.name || 'Restaurante'}\nTotal: ${fullOrder.total_amount} ${driverCurrency}`,
                                icon,
                                tag,
                                vibrate: [500, 200, 500, 200, 500],
                                renotify: true,
                                requireInteraction: true
                            });
                        }
                    }
                });

            channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ NotificationManager: Subscribed successfully to marketplace for driver ${currentUser.id}`);
                }
                if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.warn(`⚠️ NotificationManager: Subscription status: ${status}`);
                }
            });

            return channel;
        };

        const channel = setupSubscription();

        return () => {
            isMounted = false;
            if (channel) {
                console.log(`🔌 NotificationManager cleanup: Removing channel for driver ${currentUser.id}`);
                supabase.removeChannel(channel);
            }
        };
    }, [currentUser, audioUnlocked, notifState, systemSettings.pwaIconUrl, settings, t]);

    // Setup Service Worker message listener
    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleSWMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'BACKGROUND_ORDER_CHECK') {
                console.log('[NotificationManager] Background check requested');
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    }, []);

    // Periodic check for tracked tickets (every 30 seconds)
    useEffect(() => {
        if (!activeBranchId) return;

        const key = `trackedTickets_v2_${activeBranchId}`;
        const stored = localStorage.getItem(key);

        if (!stored) return;

        try {
            const tracked = JSON.parse(stored) as { id: string }[];
            if (tracked.length === 0) return;

            console.log('🔄 Periodic check enabled for', tracked.length, 'tickets');

            const interval = setInterval(() => {
                console.log('⏰ Checking tracked orders...');
            }, 30000);

            return () => clearInterval(interval);
        } catch (e) {
            console.error('Error setting up periodic check:', e);
        }
    }, [activeBranchId, orders]);

    // For guests, show prompt if they have tracked tickets
    const hasTrackedTickets = React.useMemo(() => {
        if (!activeBranchId) return false;
        const key = `trackedTickets_v2_${activeBranchId}`;
        const stored = localStorage.getItem(key);
        if (!stored) return false;
        try {
            return JSON.parse(stored).length > 0;
        } catch { return false; }
    }, [activeBranchId, orders]);

    const showPrompt = !dismissed && ((!currentUser && hasTrackedTickets && !audioUnlocked) || (currentUser && [UserRole.Cashier, UserRole.Cook, UserRole.Waiter, UserRole.DeliveryDriver, UserRole.Admin].includes(currentUser.role as any) && (!audioUnlocked || notifState !== 'granted')));

    // Auto-hide after 60 seconds if not interacted with
    useEffect(() => {
        if (showPrompt) {
            const timer = setTimeout(() => {
                setDismissed(true);
            }, 60000); // 1 minute
            return () => clearTimeout(timer);
        }
    }, [showPrompt]);

    if (!showPrompt && audioUnlocked && (notifState === 'granted' || !currentUser)) return null;

    return (
        <div className={`fixed bottom-4 right-4 z-[100] transition-all duration-500 transform ${(!showPrompt) ? 'translate-y-24 opacity-0' : 'translate-y-0 opacity-100'}`}>
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border-2 border-primary-500 p-5 max-w-sm flex items-center gap-4 animate-bounce hover:animate-none group relative">
                {/* Close Button */}
                <button 
                    onClick={() => setDismissed(true)}
                    className="absolute -top-2 -right-2 bg-white dark:bg-gray-800 border-2 border-primary-500 rounded-full p-1 text-primary-500 hover:text-primary-700 transition-colors shadow-lg z-10"
                >
                    <X size={16} strokeWidth={3} />
                </button>

                <div className="bg-primary-100 dark:bg-primary-900/30 p-3 rounded-2xl ring-4 ring-primary-500/10 group-hover:scale-110 transition-transform">
                    <BellRing className="text-primary-600" size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white leading-tight uppercase tracking-tight">
                        {currentUser ? 'Activar Sistema' : '🔔 ¡Avisame!'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight font-medium mt-1">
                        {currentUser
                            ? 'Recibe alertas de nuevos pedidos con sonido.'
                            : 'Se te avisará con sonido y vibración cuando tu pedido esté listo.'}
                    </p>
                </div>
                <button
                    onClick={unlockNotifications}
                    className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-black px-5 py-3 rounded-2xl transition-all active:scale-90 shadow-xl shadow-primary-500/30 uppercase tracking-widest"
                >
                    {t('settings.activate') || 'ACTIVAR'}
                </button>
            </div>
        </div>
    );
};

export default NotificationManager;
