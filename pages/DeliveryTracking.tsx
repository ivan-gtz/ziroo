import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { OrderStatus, OrderType, Language } from '../types';
import { MapPin, ShoppingBag, Phone, Clock, CheckCircle, Navigation, LayoutDashboard, Globe, MessageSquare } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import Card from '../components/ui/Card';

const DeliveryTracking: React.FC = () => {
    const { branchId } = useParams();
    const { allOrders, allSettings, t, language, setLanguage, setActiveBranchId } = useAppContext();

    // Get ticket from URL search param or similar?
    // Let's use search param: /delivery/:branchId?ticket=123
    const query = new URLSearchParams(window.location.search);
    const ticketNumber = query.get('ticket');

    useEffect(() => {
        if (branchId) {
            setActiveBranchId(branchId);
        }
    }, [branchId, setActiveBranchId]);

    const settings = useMemo(() => allSettings[branchId || ''] || {}, [allSettings, branchId]);
    const order = useMemo(() => {
        if (!ticketNumber || !branchId) return null;
        const branchOrders = allOrders[branchId] || [];
        return branchOrders.find(o => o.dailyTicketNumber.toString() === ticketNumber && o.orderType === OrderType.Delivery);
    }, [allOrders, branchId, ticketNumber]);

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                    <ShoppingBag className="w-10 h-10 text-gray-300" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('delivery.order_not_found') || 'Pedido no encontrado'}</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs">{t('delivery.order_not_found_desc') || 'Verifica el enlace o contacta al restaurante.'}</p>
                <Link to="/" className="text-primary-600 font-bold hover:underline">Volver a Inicio</Link>
            </div>
        );
    }

    const getStatusStep = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.AwaitingApproval: return 1;
            case OrderStatus.Pending: return 2;
            case OrderStatus.Preparing: return 3;
            case OrderStatus.Ready: return 4;
            case OrderStatus.Delivered: return 5;
            default: return 1;
        }
    };

    const currentStep = getStatusStep(order.status);

    const steps = [
        { id: 1, label: t('orders.status_awaiting') || 'Recibido', icon: Clock },
        { id: 2, label: t('orders.status_pending') || 'Confirmado', icon: CheckCircle },
        { id: 3, label: t('orders.status_preparing') || 'En Cocina', icon: ShoppingBag },
        { id: 4, label: t('orders.status_ready') || 'Listo / En Camino', icon: Navigation },
        { id: 5, label: t('orders.status_delivered') || 'Entregado', icon: CheckCircle },
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50">
                <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                            {settings.logoImage ? (
                                <img src={settings.logoImage} className="h-full w-full object-cover" />
                            ) : (
                                <LayoutDashboard size={20} className="text-primary-600" />
                            )}
                        </div>
                        <h1 className="font-extrabold text-gray-900 dark:text-white truncate max-w-[150px]">
                            {settings.restaurantName}
                        </h1>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-full p-1 scale-90">
                        <button onClick={() => setLanguage(Language.EN)} className={`w-8 h-8 rounded-full text-[10px] font-bold ${language === Language.EN ? 'bg-white dark:bg-gray-600 text-primary-600' : 'text-gray-400'}`}>EN</button>
                        <button onClick={() => setLanguage(Language.ES)} className={`w-8 h-8 rounded-full text-[10px] font-bold ${language === Language.ES ? 'bg-white dark:bg-gray-600 text-primary-600' : 'text-gray-400'}`}>ES</button>
                    </div>
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 mt-6">
                {/* Status Card */}
                <Card className="p-6 mb-6 shadow-xl border-primary-100 dark:border-primary-900/30 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ShoppingBag size={80} />
                    </div>

                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('monitor.ticket')}</p>
                            <h2 className="text-4xl font-black text-gray-900 dark:text-white">#{order.dailyTicketNumber}</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">{t('orders.status')}</p>
                            <div className="px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-bold border border-primary-100">
                                {steps.find(s => s.id === currentStep)?.label}
                            </div>
                        </div>
                    </div>

                    {/* Progress Steps */}
                    <div className="relative flex justify-between">
                        {/* Line */}
                        <div className="absolute top-5 left-0 w-full h-1 bg-gray-100 dark:bg-gray-800 -z-10"></div>
                        <div
                            className="absolute top-5 left-0 h-1 bg-primary-500 -z-10 transition-all duration-1000"
                            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                        ></div>

                        {steps.map((step) => {
                            const Icon = step.icon;
                            const isCompleted = step.id < currentStep;
                            const isCurrent = step.id === currentStep;

                            return (
                                <div key={step.id} className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isCompleted ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/30' : isCurrent ? 'bg-white dark:bg-gray-800 border-primary-600 text-primary-600 scale-125 shadow-xl' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                                        <Icon size={18} />
                                    </div>
                                    <span className={`text-[9px] font-bold mt-2 uppercase tracking-tight text-center max-w-[60px] ${isCurrent ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Map Section */}
                {order.shippingLat && order.shippingLng && (
                    <div className="mb-6 rounded-3xl overflow-hidden shadow-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800">
                        <div className="p-4 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <MapPin size={18} className="text-primary-600" />
                                {t('delivery.view_map')}
                            </h3>
                            <a
                                href={`https://www.google.com/maps?q=${order.shippingLat},${order.shippingLng}`}
                                target="_blank"
                                className="text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-3 py-1.5 rounded-full"
                            >
                                GOOGLE MAPS
                            </a>
                        </div>
                        <div className="h-48 w-full z-10">
                            <MapContainer
                                center={[order.shippingLat, order.shippingLng]}
                                zoom={16}
                                scrollWheelZoom={false}
                                className="h-full w-full"
                                zoomControl={false}
                                dragging={false}
                                touchZoom={false}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <Marker position={[order.shippingLat, order.shippingLng]}>
                                    <Popup>{t('delivery.mark_location')}</Popup>
                                </Marker>
                            </MapContainer>
                        </div>
                        {order.shippingReference && (
                            <div className="p-4 bg-primary-5/50 dark:bg-primary-900/10 italic text-sm text-gray-600 dark:text-gray-400 border-t border-gray-50 dark:border-gray-700">
                                <p className="font-bold text-[10px] uppercase not-italic text-gray-400 mb-1">{t('delivery.reference_label')}</p>
                                "{order.shippingReference}"
                            </div>
                        )}
                    </div>
                )}

                {/* Order Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <ShoppingBag size={18} className="text-primary-600" />
                        {t('orders.order_summary') || 'Resumen del Pedido'}
                    </h3>
                    <div className="space-y-3">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-sm">
                                <span className="text-gray-500 font-bold shrink-0">{item.quantity}x</span>
                                <div className="flex-1 px-3">
                                    <p className="font-bold text-gray-900 dark:text-white leading-tight">
                                        {item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name}
                                    </p>
                                    {item.selectedExtras && item.selectedExtras.length > 0 && (
                                        <p className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">
                                            {item.selectedExtras.map(e => e.name).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <span className="font-bold text-gray-900 dark:text-white">
                                    {settings.currency || '$'} {((item.variation?.price || item.menuItem.price || 0) + (item.selectedExtras?.reduce((acc, e) => acc + e.price, 0) || 0) * item.quantity).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-lg">
                        <span className="font-black text-gray-900 dark:text-white">{t('orders.total')}</span>
                        <span className="font-black text-primary-600 dark:text-primary-400">{settings.currency || '$'} {order.totalAmount.toFixed(2)}</span>
                    </div>
                </div>

                {/* Contact Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <a
                        href={`tel:${settings.phone}`}
                        className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-500 transition-all font-bold"
                    >
                        <Phone size={24} className="mb-2 text-primary-600" />
                        <span className="text-xs uppercase tracking-tight">{t('common.call') || 'Llamar'}</span>
                    </a>
                    <a
                        href={`https://wa.me/${settings.phone}?text=Hola, estoy consultando por mi pedido #${order.dailyTicketNumber}`}
                        target="_blank"
                        className="flex flex-col items-center justify-center p-4 bg-[#25D366] text-white rounded-2xl shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all font-bold"
                    >
                        <MessageSquare size={24} className="mb-2" />
                        <span className="text-xs uppercase tracking-tight">WhatsApp</span>
                    </a>
                </div>

                <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-12 mb-4">
                    Powered by Ziroo chef Restaurant OS
                </p>
            </main>
        </div>
    );
};

export default DeliveryTracking;
