// Enhanced Service Worker with Background Realtime Monitoring
const CACHE_NAME = 'ziroo-v3';
const SUPABASE_URL = 'https://rstfumgexuhhgdyyvnfk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzdGZ1bWdleHVoaGdkeXl2bmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTk0MDcsImV4cCI6MjA4MDk5NTQwN30.KElQ1jB7cD3b9UK7HS09xJg1rXyKVxzAT5HCw-g1fJo';

// Store tracked tickets and branch info
let monitoringState = {
    branchId: null,
    trackedTickets: [],
    lastCheck: Date.now()
};

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo-green.png',
    '/logo-white.png',
    '/index.css'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Installing v3 and caching static assets...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating v3...');
    event.waitUntil(
        Promise.all([
            clients.claim(),
            // Clean old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== 'notifications-cache') {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 0. BLOCK: HEAD requests to Supabase REST API (ghost schema probes from extensions/tools)
    // These waste egress and fail with 400 for non-existent columns like image_url, banner_url
    if (event.request.method === 'HEAD' && url.hostname.includes('supabase.co') && url.pathname.includes('/rest/v1/')) {
        console.log('[SW] Blocked ghost HEAD request:', url.pathname + url.search);
        event.respondWith(new Response(null, { status: 200 }));
        return;
    }

    // 2. IMAGES STRATEGY: Supabase Storage - Cache First (CRITICAL for Egress)
    const isSupabaseStorage = url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/public/');

    if (isSupabaseStorage) {
        event.respondWith(
            caches.open('ziroo-images').then((cache) => {
                return cache.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 3. ASSETS STRATEGY: External Libs (React, Lucide, Recharts, Fonts) - Cache First
    const isLibrary = url.hostname.includes('aistudiocdn.com') || 
                      url.hostname.includes('gstatic.com') || 
                      url.hostname.includes('googleapis.com') ||
                      url.hostname.includes('cdnjs.cloudflare.com');

    if (isLibrary) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) return response;
                
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const cacheCopy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, cacheCopy);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return new Response('Network error', { status: 408, statusText: 'Network error' });
                });
            })
        );
        return;
    }

    // 4. DATA STRATEGY: Supabase API (Network Only)
    if (url.hostname.includes('supabase.co')) {
        return; 
    }

    // 5. UI STRATEGY: Internal Assets & Index - Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cacheCopy);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return null;
            });

            return cachedResponse || fetchPromise || new Response('Offline', { status: 503 });
        }).catch(() => {
            return new Response('Fetch failed', { status: 404 });
        })
    );
});

// Handle Notification Clicks
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Try to focus existing window
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if none exists
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Push Support (for future server-sent push)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body,
        icon: data.icon || '/logo-green.png',
        badge: '/logo-green.png',
        vibrate: [500, 200, 500, 200, 500],
        data: { url: '/' },
        requireInteraction: true,
        renotify: true,
        tag: data.tag || 'order-notification',
        timestamp: Date.now(),
        actions: [
            { action: 'open', title: 'Ver Pedido' }
        ]
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

// Message Handling from Main App
self.addEventListener('message', async (event) => {
    console.log('[SW] Message received:', event.data);

    // Update monitoring state
    if (event.data && event.data.type === 'UPDATE_MONITORING') {
        monitoringState = {
            branchId: event.data.branchId,
            trackedTickets: event.data.trackedTickets || [],
            lastCheck: Date.now()
        };
        console.log('[SW] Updated monitoring state:', monitoringState);
    }

    // Show notification immediately
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, icon, tag } = event.data;

        try {
            await self.registration.showNotification(title, {
                body,
                icon: icon || '/logo-green.png',
                badge: '/logo-green.png',
                vibrate: [500, 200, 500, 200, 500],
                requireInteraction: true,
                renotify: true,
                tag: tag || 'order-notification',
                timestamp: Date.now(),
                data: { url: '/' },
                silent: false // Ensure sound plays
            });
            console.log('[SW] Notification shown:', title);
        } catch (err) {
            console.error('[SW] Failed to show notification:', err);
        }
    }

    // Background check request
    if (event.data && event.data.type === 'CHECK_ORDERS') {
        const { branchId, trackedTickets } = event.data;
        await checkOrdersInBackground(branchId, trackedTickets);
    }
});

// Periodic Background Sync (Chrome/Edge only)
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync triggered:', event.tag);

    if (event.tag === 'check-orders') {
        event.waitUntil(checkOrdersInBackground(
            monitoringState.branchId,
            monitoringState.trackedTickets
        ));
    }
});

// Background Sync (for offline support)
self.addEventListener('sync', (event) => {
    console.log('[SW] Sync event:', event.tag);

    if (event.tag === 'check-orders-sync') {
        event.waitUntil(checkOrdersInBackground(
            monitoringState.branchId,
            monitoringState.trackedTickets
        ));
    }
});

// Core function to check orders in background
async function checkOrdersInBackground(branchId, trackedTickets) {
    if (!branchId || !trackedTickets || trackedTickets.length === 0) {
        console.log('[SW] No branch or tickets to monitor');
        return;
    }

    console.log('[SW] Checking orders for branch:', branchId, 'Tickets:', trackedTickets);

    try {
        // Get Supabase URL from environment or default
        const supabaseUrl = self.location.origin.includes('localhost')
            ? 'https://zirooappid.supabase.co'
            : SUPABASE_URL;

        // Fetch orders from Supabase
        const ticketNumbers = trackedTickets.map(t => typeof t === 'object' ? t.id : t);

        const response = await fetch(`${supabaseUrl}/rest/v1/orders?branch_id=eq.${branchId}&daily_ticket_number=in.(${ticketNumbers.join(',')})&select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const orders = await response.json();
        console.log('[SW] Fetched orders:', orders);

        // Check for ready orders
        for (const order of orders) {
            if (order.status === 'Ready') {
                // Get stored state to avoid duplicate notifications
                const notifiedKey = `notified_${order.id}`;
                const alreadyNotified = await caches.match(notifiedKey);

                if (!alreadyNotified) {
                    // Show notification
                    await self.registration.showNotification('¡Pedido Listo! - Ziroo chef', {
                        body: `Ticket #${order.daily_ticket_number} está listo para recoger`,
                        icon: '/logo-green.png',
                        badge: '/logo-green.png',
                        vibrate: [500, 200, 500, 200, 500],
                        requireInteraction: true,
                        renotify: true,
                        tag: `order-${order.daily_ticket_number}`,
                        timestamp: Date.now(),
                        data: { url: '/', orderId: order.id },
                        silent: false
                    });

                    // Mark as notified (cache for 1 hour)
                    const cache = await caches.open('notifications-cache');
                    await cache.put(notifiedKey, new Response('notified', {
                        headers: { 'Cache-Control': 'max-age=3600' }
                    }));

                    console.log('[SW] Notification sent for order:', order.id);
                }
            }
        }
    } catch (error) {
        console.error('[SW] Error checking orders:', error);
    }
}

// Heartbeat to keep SW alive (for debugging)
setInterval(() => {
    console.log('[SW] Heartbeat - Monitoring:', monitoringState);
}, 60000); // Every minute
