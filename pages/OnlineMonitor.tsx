import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import useLocalStorage from '../hooks/useLocalStorage';
import { Order, OrderStatus, PagerStatus, Language } from '../types';
import { X, BellRing, Facebook, Instagram, Youtube, LayoutDashboard, AlertCircle, Globe } from 'lucide-react';
import WelcomeScreen from '../components/WelcomeScreen';
import { playSound, triggerVibration } from '../utils/notifications';

interface TrackedTicket {
    id: string;
    timestamp: number;
    dateStr: string;
}

const SocialFooter: React.FC<{ branchId: string }> = ({ branchId }) => {
    const { allSettings, t } = useAppContext();
    const settings = useMemo(() => (allSettings[branchId] || { socialLinks: {}, websiteUrl: '' }), [allSettings, branchId]);
    const socialLinks = settings.socialLinks;
    const websiteUrl = settings.websiteUrl;

    const hasLinks = (socialLinks && Object.values(socialLinks).some(link => link)) || websiteUrl;

    if (!hasLinks) {
        return null;
    }

    return (
        <footer className="w-full py-8 mt-auto border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 relative z-30">
            <div className="container mx-auto px-4">
                <h4 className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 uppercase tracking-wider">{t('social.follow_us')}</h4>
                <div className="flex justify-center items-center gap-8">
                    {websiteUrl && (
                        <a
                            href={websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-transform hover:scale-110 duration-200 p-2 touch-manipulation"
                            aria-label="Website"
                        >
                            <Globe size={28} className="pointer-events-none" />
                        </a>
                    )}
                    {socialLinks.facebook && (
                        <a
                            href={socialLinks.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[#1877F2] transition-transform hover:scale-110 duration-200 p-2 touch-manipulation"
                            aria-label="Facebook"
                        >
                            <Facebook size={28} className="pointer-events-none" />
                        </a>
                    )}
                    {socialLinks.instagram && (
                        <a
                            href={socialLinks.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[#E4405F] transition-transform hover:scale-110 duration-200 p-2 touch-manipulation"
                            aria-label="Instagram"
                        >
                            <Instagram size={28} className="pointer-events-none" />
                        </a>
                    )}
                    {socialLinks.tiktok && (
                        <a
                            href={socialLinks.tiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-black dark:hover:text-white transition-transform hover:scale-110 duration-200 p-2 touch-manipulation"
                            aria-label="TikTok"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" viewBox="0 0 16 16" className="pointer-events-none"><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3V0Z" /></svg>
                        </a>
                    )}
                    {socialLinks.youtube && (
                        <a
                            href={socialLinks.youtube}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[#FF0000] transition-transform hover:scale-110 duration-200 p-2 touch-manipulation"
                            aria-label="YouTube"
                        >
                            <Youtube size={28} className="pointer-events-none" />
                        </a>
                    )}
                </div>
            </div>
        </footer>
    );

}

const OnlineMonitor: React.FC = () => {
    const { t, allOrders, allSettings, currentUser, pagerStatuses, managedRestaurants, branches, language, setLanguage, setActiveBranchId } = useAppContext();
    const { branchId } = useParams<{ branchId: string }>();

    const [showWelcome, setShowWelcome] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    // Sync active branch for realtime subscriptions
    useEffect(() => {
        if (branchId) {
            console.log("📡 OnlineMonitor: Activating branch for realtime:", branchId);
            setActiveBranchId(branchId);
        }
    }, [branchId, setActiveBranchId]);

    const orders = useMemo(() => allOrders[branchId!] || [], [allOrders, branchId]);
    const { restaurantName, logoImage } = useMemo(() => (allSettings[branchId!] || { restaurantName: 'Restaurant', logoImage: '' }), [allSettings, branchId]);

    // Use TrackedTicket array instead of string array - using v2 key to avoid conflicts
    const [trackedTickets, setTrackedTickets] = useLocalStorage<TrackedTicket[]>(`trackedTickets_v2_${branchId}`, []);
    const [newTicket, setNewTicket] = useState('');
    const [notifiedTicket, setNotifiedTicket] = useState<{ dailyTicketNumber: number } | null>(null);
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [hasAttemptedActivation, setHasAttemptedActivation] = useLocalStorage(`monitor_notif_activated_${branchId}`, false);

    const prevTrackedOrdersRef = useRef<Order[]>([]);
    const prevPagerStatusesRef = useRef<Record<number, PagerStatus>>({});

    // Determine if Basic Restaurant
    const isBasicRestaurant = useMemo(() => {
        const branch = branches.find(b => b.id === branchId);
        if (branch && branch.restaurantId) {
            const restaurant = managedRestaurants.find(r => r.id === branch.restaurantId);
            return restaurant?.type === 'Basic';
        }
        if (currentUser && 'restaurantId' in currentUser && currentUser.restaurantId) {
            const restaurant = managedRestaurants.find(r => r.id === currentUser.restaurantId);
            return restaurant?.type === 'Basic';
        }
        return false;
    }, [branchId, branches, managedRestaurants, currentUser]);

    // CLEANUP EFFECT: Remove tickets older than 2 hours OR from a different day
    useEffect(() => {
        const cleanupTickets = () => {
            setTrackedTickets(current => {
                if (!Array.isArray(current)) return [];

                const now = Date.now();
                const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
                const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

                return current.filter(ticket => {
                    // Filter out non-objects (legacy data safety)
                    if (typeof ticket !== 'object' || !ticket.timestamp || !ticket.dateStr) return false;

                    // Condition 1: Check if same day
                    if (ticket.dateStr !== todayStr) return false;

                    // Condition 2: Check if < 2 hours old
                    if (now - ticket.timestamp > TWO_HOURS_MS) return false;

                    return true;
                });
            });
        };

        // Run on mount
        cleanupTickets();

        // Run every minute to check for expired tickets
        const interval = setInterval(cleanupTickets, 60 * 1000);
        return () => clearInterval(interval);
    }, [setTrackedTickets]);


    // Combine standard orders AND manual pagers for public display
    const publicOrders = useMemo(() => {
        // 1. Get standard active orders
        const activeOrders = orders
            .filter(o => {
                if ((o as any).driverFlowStatus === 'delivered' || o.status === OrderStatus.Delivered) return false;
                return o.status === OrderStatus.Preparing || o.status === OrderStatus.Pending || o.status === OrderStatus.Ready;
            })
            .map(o => ({
                id: o.id,
                ticketNumber: o.dailyTicketNumber,
                status: o.status,
                timestamp: new Date(o.timestamp).getTime(),
                type: 'order'
            }));

        // 2. Get active manual pagers
        const activePagers = (Object.values(pagerStatuses) as PagerStatus[])
            .filter(p => p.state !== 'inactive')
            .map(p => ({
                id: `pager-${p.id}`,
                ticketNumber: p.id,
                status: p.state === 'ready' ? OrderStatus.Ready : OrderStatus.Preparing,
                timestamp: new Date(p.timestamp).getTime(),
                type: 'pager'
            }));

        // 3. Merge and SORT: SEQUENTIAL (By Ticket Number / Timestamp)
        return [...activeOrders, ...activePagers]
            .sort((a, b) => {
                return a.ticketNumber - b.ticketNumber;
            })
            .slice(0, 12); // Show max 12 items
    }, [orders, pagerStatuses]);

    const trackedOrdersWithStatus = useMemo(() => {
        return trackedTickets.map(ticket => {
            const ticketIdStr = ticket.id;
            const order = orders.find(o => o.dailyTicketNumber.toString() === ticketIdStr);
            if (order) {
                if ((order as any).driverFlowStatus === 'delivered' || order.status === OrderStatus.Delivered) {
                    return null; // Don't show if delivered
                }
                return { ticketId: ticketIdStr, status: order.status };
            }

            const ticketIdNum = parseInt(ticketIdStr, 10);
            const pager = pagerStatuses[ticketIdNum];
            if (pager && pager.state !== 'inactive') {
                return { ticketId: ticketIdStr, status: pager.state === 'ready' ? OrderStatus.Ready : OrderStatus.Preparing };
            }
            return { ticketId: ticketIdStr, status: undefined };
        }).filter(Boolean); // Remove nulls
    }, [trackedTickets, orders, pagerStatuses]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowWelcome(false);
            if ('Notification' in window && Notification.permission === 'default' && !hasAttemptedActivation) {
                setTimeout(() => setIsNotificationModalOpen(true), 1000);
            }
        }, 1500); // Faster welcome
        return () => clearTimeout(timer);
    }, [hasAttemptedActivation]);

    // Auto-close notification modal after some time
    useEffect(() => {
        if (isNotificationModalOpen) {
            const timer = setTimeout(() => {
                setIsNotificationModalOpen(false);
                setHasAttemptedActivation(true);
            }, 10000); // 10 seconds
            return () => clearTimeout(timer);
        }
    }, [isNotificationModalOpen, setHasAttemptedActivation]);

    const handlePlayReadyAlert = () => {
        // CRITICAL FIX FOR XIAOMI:
        // Defer audio and vibration to allow the browser to PAINT the UI first.
        // Synchronous audio/vibrate calls can freeze the renderer on weak GPUs.
        requestAnimationFrame(() => {
            setTimeout(() => {
                console.log("🔊 Playing alert sound (Deferred)");
                playSound('ready', 10);

                if ('vibrate' in navigator) {
                    // Simpler vibration pattern to avoid driver lockup
                    navigator.vibrate([500, 300, 500]);
                }
                triggerVibration('ready', 10);
            }, 300); // 300ms delay ensures the modal is visible BEFORE sound starts
        });
    };

    const requestNotifications = () => {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                setHasAttemptedActivation(true);
                setIsNotificationModalOpen(false);
                if (permission === 'granted') {
                    handlePlayReadyAlert();
                    new Notification(restaurantName, {
                        body: language === Language.ES
                            ? "✅ Notificaciones activadas"
                            : "✅ Notifications enabled",
                        icon: logoImage || '/vite.svg',
                        tag: 'test-notif'
                    });

                    // Register background sync if available
                    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
                        navigator.serviceWorker.ready.then(registration => {
                            return (registration as any).sync.register('check-orders-sync');
                        }).catch(err => console.warn('Background sync registration failed:', err));
                    }

                    // Register periodic sync if available (Chrome/Edge only)
                    if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
                        navigator.serviceWorker.ready.then(async registration => {
                            try {
                                await (registration as any).periodicSync.register('check-orders', {
                                    minInterval: 60 * 1000 // Check every minute
                                });
                                console.log('✅ Periodic background sync registered');
                            } catch (err) {
                                console.warn('Periodic sync registration failed:', err);
                            }
                        });
                    }
                }
            });
        } else {
            setHasAttemptedActivation(true);
            setIsNotificationModalOpen(false);
            handlePlayReadyAlert();
        }
    };

    // NEW: Update Service Worker with monitoring state
    useEffect(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller && branchId) {
            // Send monitoring state to SW
            navigator.serviceWorker.controller.postMessage({
                type: 'UPDATE_MONITORING',
                branchId: branchId,
                trackedTickets: trackedTickets
            });
            console.log('📡 Sent monitoring state to SW:', { branchId, trackedTickets });
        }
    }, [trackedTickets, branchId]);

    useEffect(() => {
        // ORDER NOTIFICATIONS
        const trackedIds = trackedTickets.map(t => t.id);
        const currentTrackedOrders = orders.filter(o => trackedIds.includes(o.dailyTicketNumber.toString()));
        const prevTrackedOrders = prevTrackedOrdersRef.current;

        currentTrackedOrders.forEach(currentOrder => {
            const prevOrder = prevTrackedOrders.find(po => po.id === currentOrder.id);
            // Trigger on Ready
            if (currentOrder.status === OrderStatus.Ready && prevOrder?.status !== OrderStatus.Ready) {
                // 1. Set Visual State FIRST
                setNotifiedTicket({ dailyTicketNumber: currentOrder.dailyTicketNumber });

                // 2. Play Sound/Vibrate (delayed inside function)
                handlePlayReadyAlert();

                // 3. Send System Notification (Background)
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        title: t('monitor.your_order_is_ready'),
                        body: `${t('monitor.ticket')} #${currentOrder.dailyTicketNumber} ${t('monitor.is_ready_pickup')}`,
                        icon: logoImage || '/logo-green.png',
                        tag: `order-${currentOrder.dailyTicketNumber}`
                    });
                }
            }
        });

        // PAGER NOTIFICATIONS logic...
        const currentPagers = pagerStatuses;
        const prevPagers = prevPagerStatusesRef.current;

        (Object.values(currentPagers) as PagerStatus[]).forEach(pager => {
            const prevPager = prevPagers[pager.id];
            if (pager.state === 'ready' && prevPager?.state !== 'ready' && trackedIds.includes(pager.id.toString())) {
                setNotifiedTicket({ dailyTicketNumber: pager.id });
                handlePlayReadyAlert();

                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        title: t('monitor.your_order_is_ready'),
                        body: `${t('monitor.ticket')} #${pager.id} ${t('monitor.is_ready_pickup')}`,
                        icon: logoImage || '/logo-green.png',
                        tag: `pager-${pager.id}`
                    });
                }
            }
        });

        prevTrackedOrdersRef.current = currentTrackedOrders;
        prevPagerStatusesRef.current = currentPagers;
    }, [orders, trackedTickets, t, setTrackedTickets, pagerStatuses, logoImage]);

    const handleAddTicket = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        const ticketIdStr = newTicket.trim();
        if (!ticketIdStr) return;

        if (trackedTickets.some(t => t.id === ticketIdStr)) {
            setNewTicket('');
            return;
        }

        const orderExists = orders.some(o => o.dailyTicketNumber.toString() === ticketIdStr && o.status !== OrderStatus.Delivered);
        const ticketIdNum = parseInt(ticketIdStr, 10);
        const pagerExists = !isNaN(ticketIdNum) && pagerStatuses[ticketIdNum] && pagerStatuses[ticketIdNum].state !== 'inactive';

        if (orderExists || pagerExists) {
            const newTrackedTicket: TrackedTicket = {
                id: ticketIdStr,
                timestamp: Date.now(),
                dateStr: new Date().toLocaleDateString('en-CA')
            };
            setTrackedTickets(prev => [...prev, newTrackedTicket]);
            setNewTicket('');

            if ('Notification' in window && Notification.permission === "default") {
                Notification.requestPermission();
            }
        } else {
            setErrorMsg(t('monitor.ticket_not_found', { ticketId: ticketIdStr }));
        }
    };

    const handleRemoveTicket = (ticketId: string) => {
        setTrackedTickets(prev => prev.filter(t => t.id !== ticketId));
    };

    if (showWelcome) return <WelcomeScreen branchId={branchId} />;

    return (
        <div className="relative min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            {/* Language Switcher */}
            <div className="fixed top-4 left-4 z-50 flex items-center space-x-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full p-1 shadow-lg border border-gray-200 dark:border-gray-700">
                <button onClick={() => setLanguage(Language.EN)} className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === Language.EN ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>EN</button>
                <button onClick={() => setLanguage(Language.ES)} className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${language === Language.ES ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>ES</button>
            </div>

            <main className="container mx-auto text-center flex-grow p-4 sm:p-8">
                <div className="flex justify-center items-center gap-4 mb-8">
                    {logoImage && (
                        <img src={logoImage} alt="Logo" className="h-16 w-16 rounded-full object-cover shadow-md" />
                    )}
                    <h1 className="text-4xl md:text-5xl font-extrabold text-primary-600 dark:text-primary-400">
                        {restaurantName}
                    </h1>
                </div>

                {/* Tracking Section - ALWAYS VISIBLE */}
                <div className="max-w-xl mx-auto my-8 space-y-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                        <BellRing size={32} className="mx-auto text-primary-500 mb-2" />
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('monitor.track_prompt')}</h3>
                        <form onSubmit={handleAddTicket} className="flex flex-col items-center mt-4 max-w-sm mx-auto">
                            <div className="flex w-full gap-2">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={newTicket}
                                    onChange={(e) => { setNewTicket(e.target.value); setErrorMsg(''); }}
                                    placeholder={t('monitor.enter_ticket_placeholder')}
                                    className={`w-full px-4 py-3 text-lg border-2 rounded-full focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 ${errorMsg ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                                />
                                <button type="submit" className="bg-primary-600 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-primary-700 transition-colors text-lg">
                                    {t('monitor.track_button')}
                                </button>
                            </div>
                            {errorMsg && (
                                <div className="flex items-center mt-2 text-red-500 text-sm font-medium animate-fade-in">
                                    <AlertCircle size={16} className="mr-1" />
                                    {errorMsg}
                                </div>
                            )}
                        </form>
                        {trackedTickets.length === 0 && !errorMsg && (
                            <p className="text-gray-500 dark:text-gray-400 mt-4 text-sm">{t('monitor.add_ticket_prompt')}</p>
                        )}
                    </div>

                    {trackedTickets.length > 0 && (
                        <div className="max-w-3xl mx-auto mb-12">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 relative shadow-sm">
                                <h4 className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-900 px-6 py-2 text-xl font-bold text-gray-700 dark:text-gray-200 shadow-sm rounded-full border border-indigo-100 dark:border-indigo-900">
                                    {t('monitor.tracked_tickets_title')}
                                </h4>
                                <div className="flex flex-wrap justify-center gap-6 mt-4">
                                    {trackedOrdersWithStatus.map((trackedOrder) => {
                                        // trackedOrder could be undefined if our new filter removed it, but filter(Boolean) already took care of that
                                        const { ticketId, status } = trackedOrder as any;
                                        const isReady = status === OrderStatus.Ready;
                                        let statusText = t('monitor.status_preparing');
                                        if (status === OrderStatus.Ready) statusText = t('monitor.status_ready');
                                        else if (status === OrderStatus.Pending || status === OrderStatus.AwaitingApproval) statusText = t('status.Pending');
                                        else if (status === undefined) statusText = t('monitor.checking') || "Checking...";

                                        return (
                                            <div key={ticketId} className={`relative p-4 rounded-xl shadow-lg transition-all duration-300 w-40 text-center transform hover:scale-105 ${isReady ? 'bg-gradient-to-br from-green-400 to-green-600 text-white animate-pulse' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                                }`}>
                                                <button onClick={() => handleRemoveTicket(ticketId)} className={`absolute top-1 right-1 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${isReady ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:text-gray-200 dark:hover:bg-gray-600'}`} aria-label={`Remove ticket ${ticketId}`}>
                                                    <X size={16} />
                                                </button>
                                                <div className="text-xs opacity-90 uppercase tracking-wide mb-2 font-bold">{statusText}</div>
                                                <div className="font-extrabold text-5xl">#{ticketId}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className={isBasicRestaurant ? "mt-8" : "mt-12"}>
                    <h2 className="text-3xl font-bold text-gray-700 dark:text-gray-300 mb-6">{t('monitor.board_title')}</h2>

                    <div className="flex justify-center mb-6">
                        <button
                            onClick={requestNotifications}
                            className="bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-primary-100 dark:hover:bg-primary-900/60 transition-all shadow-md border hover:border-primary-300 dark:border-primary-800 animate-pulse group"
                        >
                            <BellRing size={24} className="text-primary-600 group-hover:rotate-12 transition-transform" />
                            <span className="text-lg">{t('monitor.test_alert')}</span>
                        </button>
                    </div>

                    {publicOrders.length > 0 ? (
                        <div className="grid grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
                            {publicOrders.map(order => {
                                const isReady = order.status === OrderStatus.Ready;
                                const isTrackedAndReady = isReady && trackedTickets.some(t => t.id === order.ticketNumber.toString());
                                return (
                                    <div key={order.id} className={`
                                    relative text-white p-4 rounded-2xl shadow-xl flex flex-col items-center justify-center aspect-square transition-all duration-300
                                    ${isReady
                                            ? `bg-gradient-to-br from-green-500 to-green-600 ${isTrackedAndReady ? 'animate-bell-ring' : ''}`
                                            : 'bg-gradient-to-br from-yellow-500 to-orange-500'}`
                                    }>
                                        {isTrackedAndReady && <BellRing size={24} className="absolute top-3 right-3 text-white/80" />}
                                        <span className="text-5xl sm:text-6xl font-extrabold drop-shadow-md">#{order.ticketNumber}</span>
                                        <span className={`mt-2 text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-black/20`}>
                                            {isReady ? t('monitor.status_ready') : t('monitor.status_preparing')}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-500 mt-10 text-xl">{t('monitor.no_active_orders')}</p>
                    )}
                </div>
            </main>

            {notifiedTicket && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80"
                    onClick={() => setNotifiedTicket(null)}
                    style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none' }} // Anti-lag para Xiaomi
                >
                    <div
                        className="bg-yellow-400 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative animate-[pop-in_0.3s_ease-out] border-4 border-white transform transition-transform"
                        onClick={(e) => e.stopPropagation()} // Evitar cierre accidental al tocar dentro
                    >
                        <button
                            onClick={() => setNotifiedTicket(null)}
                            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 rounded-full p-2 text-yellow-900 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="flex flex-col items-center text-center">
                            <div className="bg-white p-4 rounded-full shadow-lg mb-4">
                                <BellRing size={48} className="text-yellow-500 animate-wiggle" />
                            </div>

                            <h2 className="text-3xl font-black text-white drop-shadow-sm mb-2 uppercase tracking-tight leading-none">
                                {t('monitor.your_order_is_ready')}
                            </h2>

                            <div className="bg-white w-full py-6 rounded-2xl shadow-inner mt-4 mb-6">
                                <span className="text-7xl font-black text-gray-900 block">
                                    #{notifiedTicket.dailyTicketNumber}
                                </span>
                            </div>

                            <button
                                onClick={() => setNotifiedTicket(null)}
                                className="bg-gray-900 text-white font-bold py-3 px-8 rounded-full shadow-lg text-lg animate-pulse active:scale-95 transition-transform"
                            >
                                {t('monitor.got_it') || '¡Lo tengo!'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Activation Modal */}
            {isNotificationModalOpen && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => {
                        setIsNotificationModalOpen(false);
                        setHasAttemptedActivation(true);
                    }}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl transform animate-pop-in border border-gray-100 dark:border-gray-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <BellRing size={48} className="text-primary-600 animate-bounce" />
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">
                            {t('monitor.notification_popup_title')}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 font-bold leading-tight">
                            {t('monitor.notification_popup_desc')}
                        </p>

                        {/* Xiaomi / Android Background Fix Info */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 rounded-2xl p-4 mb-6 text-left">
                            <h4 className="text-[10px] font-black text-yellow-700 dark:text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <AlertCircle size={12} /> {language === Language.ES ? 'IMPORTANTE (XIAOMI/ANDROID)' : 'IMPORTANT (XIAOMI/ANDROID)'}
                            </h4>
                            <p className="text-[10px] text-yellow-800 dark:text-yellow-400 leading-tight font-medium">
                                {language === Language.ES
                                    ? 'Para alertas en SEGUNDO PLANO: Activa "Inicio Automático" y desactiva el "Ahorro de batería" para esta aplicación.'
                                    : 'For BACKGROUND alerts: Enable "Autostart" and set "Battery Saver" to "No restrictions" for this app.'}
                            </p>
                        </div>

                        <button
                            onClick={requestNotifications}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary-500/30 transition-all active:scale-95 text-lg uppercase tracking-tight"
                        >
                            {t('monitor.notification_popup_button')}
                        </button>
                        <button
                            onClick={() => {
                                setIsNotificationModalOpen(false);
                                setHasAttemptedActivation(true);
                            }}
                            className="mt-6 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-black uppercase tracking-widest"
                        >
                            {language === Language.ES ? 'Quizás más tarde' : 'Maybe later'}
                        </button>
                    </div>
                </div>
            )}

            <SocialFooter branchId={branchId!} />
        </div>
    );
};

export default OnlineMonitor;