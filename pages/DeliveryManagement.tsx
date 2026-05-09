import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Order, OrderStatus, OrderType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { MapPin, Phone, MessageSquare, Navigation, CheckCircle, Clock, Search, ShoppingBag, Printer, Smartphone } from 'lucide-react';
import { useReceiptActions } from '../components/PrintingProvider';
import KitchenReceipt from '../components/receipt/KitchenReceipt';
import Receipt from '../components/receipt/Receipt';

const DeliveryManagement: React.FC = () => {
    const { t, orders, updateOrderStatus, shareOrderWithDrivers, formatCurrency, activeBranchId, allSettings } = useAppContext();
    const { printReceipt, printKitchenRawBt } = useReceiptActions();

    const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'All' | 'Completed'>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
    const [previewType, setPreviewType] = useState<'receipt' | 'kitchen'>('kitchen');

    const settings = useMemo(() => allSettings[activeBranchId || ''] || {}, [allSettings, activeBranchId]);

    const deliveryOrders = useMemo(() => {
        return orders
            .filter(o => o.orderType === OrderType.Delivery)
            .filter(o => {
                if (selectedStatus === 'All') return (o as any).driverFlowStatus !== 'delivered';
                if (selectedStatus === 'Completed') return (o as any).driverFlowStatus === 'delivered';
                return o.status === selectedStatus;
            })
            .filter(o => {
                if (!searchTerm) return true;
                return o.dailyTicketNumber.toString().includes(searchTerm) ||
                    o.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [orders, selectedStatus, searchTerm]);

    const handleShareWhatsApp = (order: Order) => {
        const baseUrl = window.location.origin;
        const trackingUrl = `${baseUrl}/#/delivery/${activeBranchId}?ticket=${order.dailyTicketNumber}`;
        const itemsList = order.items.map(item => `• ${item.quantity}x ${item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name}`).join('\n');

        const googleMapsLink = order.shippingLat && order.shippingLng
            ? `https://www.google.com/maps?q=${order.shippingLat},${order.shippingLng}`
            : null;

        const message = encodeURIComponent(
            `*${t('delivery.courier_message')}* 🛵\n\n` +
            `🔹 *Pedido:* #${order.dailyTicketNumber}\n` +
            `👤 *Cliente:* ${order.customerName}\n` +
            `📞 *Celular:* ${order.customerPhone || 'No proveído'}\n\n` +
            `📍 *UBICACIÓN DE ENTREGA:*\n` +
            (googleMapsLink ? `🗺️ ${googleMapsLink}\n` : '') +
            `📝 *Ref:* ${order.shippingReference || 'Sin referencia'}\n\n` +
            `📦 *RESUMEN DE PRODUCTOS:*\n${itemsList}\n\n` +
            `💰 *TOTAL A COBRAR:* ${settings.currency || '$'} ${order.totalAmount.toFixed(2)}\n\n` +
            `🔗 *Link de Rastreo:*\n${trackingUrl}`
        );
        window.open(`https://wa.me/?text=${message}`, '_blank');
    };

    const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
        const config = {
            [OrderStatus.AwaitingApproval]: { bg: 'bg-amber-100 text-amber-700', label: t('status.AwaitingApproval') },
            [OrderStatus.Pending]: { bg: 'bg-blue-100 text-blue-700', label: t('status.Pending') },
            [OrderStatus.Preparing]: { bg: 'bg-purple-100 text-purple-700', label: t('status.Preparing') },
            [OrderStatus.Ready]: { bg: 'bg-green-100 text-green-700', label: t('status.Ready') },
            [OrderStatus.Delivered]: { bg: 'bg-gray-100 text-gray-700', label: t('status.Delivered') },
            [OrderStatus.Cancelled]: { bg: 'bg-red-100 text-red-700', label: t('status.Cancelled') },
        };
        const s = config[status] || { bg: 'bg-gray-100 text-gray-700', label: status };
        return (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.bg}`}>
                {s.label}
            </span>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <Navigation className="text-primary-600" size={32} />
                        {t('sidebar.delivery')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Gestiona tus pedidos a domicilio en tiempo real.</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <Search className="text-gray-400 ml-2" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por ticket o nombre..."
                        className="bg-transparent border-none focus:ring-0 text-sm font-medium w-48"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="flex overflow-x-auto gap-2 pb-4 no-scrollbar mb-6">
                <button
                    onClick={() => setSelectedStatus('All')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedStatus === 'All' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}
                >
                    ACTIVOS ({orders.filter(o => o.orderType === OrderType.Delivery && (o as any).driverFlowStatus !== 'delivered').length})
                </button>
                {[OrderStatus.AwaitingApproval, OrderStatus.Pending, OrderStatus.Preparing, OrderStatus.Ready, OrderStatus.Delivered].map(status => (
                    <button
                        key={status}
                        onClick={() => setSelectedStatus(status)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedStatus === status ? 'bg-primary-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}
                    >
                        {t(`status.${status}`).toUpperCase()} ({orders.filter(o => o.orderType === OrderType.Delivery && o.status === status && (o as any).driverFlowStatus !== 'delivered').length})
                    </button>
                ))}
                <button
                    onClick={() => setSelectedStatus('Completed')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedStatus === 'Completed' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}
                >
                    COMPLETADOS ({orders.filter(o => o.orderType === OrderType.Delivery && (o as any).driverFlowStatus === 'delivered').length})
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {deliveryOrders.map(order => {
                    const isShared = order.isSharedWithDrivers && !order.assignedDriverId;
                    const isAssigned = !!order.assignedDriverId;
                    const isDoneByDriver = order.driverFlowStatus === 'delivered';

                    return (
                        <Card
                            key={order.id}
                            className={`p-0 overflow-hidden flex flex-col border-2 shadow-xl transition-all duration-300 hover:shadow-2xl ${isAssigned
                                ? 'border-sky-500/30 bg-sky-50/30 dark:bg-sky-950/20 shadow-sky-500/5'
                                : isShared
                                    ? 'border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/20 shadow-rose-500/5 animate-pulse-subtle'
                                    : 'border-transparent bg-white dark:bg-gray-800'
                                }`}
                        >
                            {/* Header Card */}
                            <div className={`p-4 border-b flex justify-between items-start ${isAssigned ? 'border-sky-100 dark:border-sky-900/50 bg-sky-100/30 dark:bg-sky-900/40' :
                                isShared ? 'border-rose-100 dark:border-rose-900/50 bg-rose-100/30 dark:bg-rose-900/40' :
                                    'border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20'
                                }`}>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">#{order.dailyTicketNumber}</span>
                                        <StatusBadge status={order.status} />
                                    </div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
                                        {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => { setPreviewOrder(order); setPreviewType('kitchen'); }}
                                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-white dark:hover:bg-gray-700 rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm"
                                    >
                                        <Printer size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleShareWhatsApp(order)}
                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-white dark:hover:bg-gray-700 rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm"
                                    >
                                        <MessageSquare size={16} />
                                    </button>
                                    {order.status !== OrderStatus.Delivered && order.status !== OrderStatus.Cancelled && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await shareOrderWithDrivers(order.id);
                                                } catch (e) {
                                                    alert("Error: No se pudo compartir.");
                                                }
                                            }}
                                            disabled={!!order.isSharedWithDrivers || !!order.assignedDriverId}
                                            className={`p-2 rounded-xl transition-all border border-transparent ${order.isSharedWithDrivers || isAssigned
                                                ? 'text-white bg-emerald-500 shadow-lg shadow-emerald-500/30 scale-105'
                                                : 'text-gray-400 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700 hover:border-gray-100 shadow-sm'
                                                }`}
                                            title="Compartir con Red de Repartidores"
                                        >
                                            <Smartphone size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex-grow space-y-5">
                                <div className="flex items-center justify-between">
                                    <div className="truncate pr-4">
                                        <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight truncate leading-none mb-1.5">{order.customerName}</h4>
                                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                            <Phone size={11} className="text-primary-500" />
                                            <span>{order.customerPhone || 'N/A'}</span>
                                        </div>
                                    </div>
                                    {isDoneByDriver && (
                                        <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-200 shadow-sm whitespace-nowrap">
                                            Delivery Entregado ✅
                                        </div>
                                    )}
                                </div>

                                {/* Driver Assigned Info - BLUE STATE */}
                                {order.assignedDriver && (
                                    <div className="bg-white dark:bg-gray-800/80 p-3 rounded-2xl border-2 border-sky-500/20 shadow-lg shadow-sky-500/5 relative">
                                        <div className="absolute top-0 right-0 -mt-2 -mr-1 bg-sky-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                            En Camino
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                {order.assignedDriver.profileImage ? (
                                                    <img src={order.assignedDriver.profileImage} alt={order.assignedDriver.name} className="w-10 h-10 rounded-xl object-cover border-2 border-sky-100 shadow-sm" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600 dark:text-sky-400 font-black text-lg border border-sky-200">
                                                        {order.assignedDriver.name.charAt(0)}
                                                    </div>
                                                )}
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-black text-gray-900 dark:text-white leading-tight truncate uppercase tracking-tight">{order.assignedDriver.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <Navigation size={10} className="text-sky-500" />
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{order.assignedDriver.phone || 'S/N'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isShared && (
                                    <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-2xl border-2 border-dashed border-rose-300 dark:border-rose-800 flex items-center justify-center gap-2">
                                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>
                                        <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Buscando Repartidor...</span>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {/* Delivery Info */}
                                    <div className="bg-gray-50 dark:bg-gray-900/30 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-inner">
                                        <div className="flex justify-between items-start gap-4 mb-2">
                                            <div className="truncate">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                    <MapPin size={10} className="text-primary-500" /> Dirección de Entrega
                                                </p>
                                                <p className="text-xs text-gray-700 dark:text-gray-300 font-bold italic leading-tight truncate">
                                                    {order.shippingReference || "Sin referencia."}
                                                </p>
                                            </div>
                                            {order.shippingLat && order.shippingLng && (
                                                <a
                                                    href={`https://www.google.com/maps?q=${order.shippingLat},${order.shippingLng}`}
                                                    target="_blank"
                                                    className="shrink-0 p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-md text-primary-600 hover:bg-primary-50 transition-colors border border-primary-50 active:scale-95"
                                                >
                                                    <Navigation size={18} />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="px-1">
                                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2.5 italic">Contenido del Pedido</p>
                                        <div className="space-y-1.5">
                                            {order.items.slice(0, 3).map((item, i) => (
                                                <div key={i} className="flex justify-between text-[11px] font-bold">
                                                    <span className="text-primary-600 dark:text-primary-400">x{item.quantity}</span>
                                                    <span className="flex-1 px-2 text-gray-600 dark:text-gray-400 truncate uppercase">
                                                        {item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name}
                                                    </span>
                                                </div>
                                            ))}
                                            {order.items.length > 3 && (
                                                <p className="text-[9px] text-primary-600 font-black text-center mt-2 uppercase tracking-tighter">
                                                    +{order.items.length - 3} artículos adicionales
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Actions */}
                            <div className="p-4 border-t border-gray-50 dark:border-gray-700 mt-auto bg-gray-50/30 dark:bg-gray-900/10">
                                <div className="space-y-1 mb-4">
                                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-500">
                                        <span>Productos:</span>
                                        <span>{settings.currency || '$'} {(order.totalAmount - (order.deliveryFee || 0)).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] font-bold text-emerald-600">
                                        <span>Pago Repartidor:</span>
                                        <span>{settings.currency || '$'} {(order.deliveryFee || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-gray-800">
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-tighter">Total a Cobrar:</span>
                                        <span className="text-xl font-black text-primary-600">{settings.currency || '$'} {order.totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-2">
                                    {order.status === OrderStatus.AwaitingApproval && (
                                        <Button
                                            className="w-full !py-3 !text-sm font-black"
                                            onClick={() => updateOrderStatus(order.id, OrderStatus.Pending)}
                                        >
                                            ACEPTAR PEDIDO
                                        </Button>
                                    )}

                                    {/* Flow: Pending -> Ready -> Delivered -> Finalized */}
                                    {(order.status === OrderStatus.Pending || order.status === OrderStatus.Preparing) && (
                                        <Button
                                            className="w-full !py-3 !text-sm font-black !bg-ready"
                                            onClick={() => updateOrderStatus(order.id, OrderStatus.Ready)}
                                        >
                                            MARCAR COMO LISTO
                                        </Button>
                                    )}

                                    {/* Botón de Finalización Manual para Ready y Delivered */}
                                    {(order.status === OrderStatus.Ready || order.status === OrderStatus.Delivered) && (order as any).driverFlowStatus !== 'delivered' && (
                                        <Button
                                            className="w-full !py-3.5 !text-sm font-black !bg-emerald-600 hover:!bg-emerald-700 shadow-lg shadow-emerald-500/20"
                                            onClick={async () => {
                                                const label = order.status === OrderStatus.Ready ? "ENTREGAR Y FINALIZAR" : "FINALIZAR ENTREGA";
                                                const confirmed = window.confirm(`¿Confirmar entrega y finalizar pedido #${order.dailyTicketNumber}?`);
                                                if (!confirmed) return;

                                                try {
                                                    const { supabase: scc } = await import('../services/supabase');
                                                    const { error } = await scc.from('orders').update({
                                                        status: 'Delivered',
                                                        driver_flow_status: 'delivered'
                                                    }).eq('id', order.id);

                                                    if (error) throw error;

                                                    // Actualizar el estado local del contexto para que la UI responda de inmediato
                                                    await updateOrderStatus(order.id, OrderStatus.Delivered);
                                                } catch (err: any) {
                                                    console.error("Error finalizando pedido manual:", err);
                                                    alert("No se pudo finalizar el pedido.");
                                                }
                                            }}
                                        >
                                            <CheckCircle size={18} className="mr-2 inline" />
                                            {order.status === OrderStatus.Ready ? 'ENTREGAR Y FINALIZAR' : 'FINALIZAR ENTREGA'}
                                        </Button>
                                    )}

                                    {(order as any).driverFlowStatus === 'delivered' && (
                                        <div className="py-3 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-dashed border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
                                            <CheckCircle size={15} />
                                            <span className="text-[11px] font-extrabold uppercase tracking-widest italic">Pedido Entregado Correctamente ✓</span>
                                        </div>
                                    )}

                                    {order.status !== OrderStatus.Delivered && order.status !== OrderStatus.Cancelled && (order as any).driverFlowStatus !== 'delivered' && (
                                        <button
                                            className="w-full py-2 text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all border border-transparent hover:border-red-100"
                                            onClick={() => {
                                                if (window.confirm("¿Cancelar pedido?")) {
                                                    updateOrderStatus(order.id, OrderStatus.Cancelled);
                                                }
                                            }}
                                        >
                                            CANCELAR PEDIDO
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {deliveryOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <ShoppingBag className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No hay pedidos de delivery</h3>
                    <p className="text-gray-500 max-w-xs">{selectedStatus === 'All' ? 'Cuando los clientes realicen pedidos de delivery, aparecerán aquí.' : `No hay pedidos con el estado ${selectedStatus}.`}</p>
                </div>
            )}

            {/* Preview Modals */}
            <Modal
                isOpen={!!previewOrder}
                onClose={() => setPreviewOrder(null)}
                title={previewType === 'kitchen' ? "Ticket de Cocina" : "Ticket de Venta"}
                footer={
                    <div className="flex gap-2 justify-end">
                        <Button variant="secondary" onClick={() => setPreviewOrder(null)}>Cerrar</Button>
                        <Button
                            onClick={() => {
                                if (previewType === 'kitchen') {
                                    printKitchenRawBt(previewOrder!);
                                } else {
                                    printReceipt(previewOrder!);
                                }
                            }}
                        >
                            <Smartphone size={16} className="mr-2" /> Imprimir BT
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                if (previewType === 'kitchen') {
                                    setPreviewType('receipt');
                                } else {
                                    setPreviewType('kitchen');
                                }
                            }}
                        >
                            Ver {previewType === 'kitchen' ? 'Recibo' : 'Cocina'}
                        </Button>
                    </div>
                }
            >
                {previewOrder && (
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl flex justify-center">
                        {previewType === 'kitchen' ? (
                            <KitchenReceipt order={previewOrder} />
                        ) : (
                            <Receipt order={previewOrder} settings={settings} />
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DeliveryManagement;
