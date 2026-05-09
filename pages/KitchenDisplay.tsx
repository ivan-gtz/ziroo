import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { Order, OrderStatus, OrderType, UserRole } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Clock, CheckCircle, BellRing, Printer, Smartphone, MapPin, Navigation } from 'lucide-react';
import { playSound, triggerVibration } from '../utils/notifications';
import { useReceiptActions } from '../components/PrintingProvider';
import KitchenReceipt from '../components/receipt/KitchenReceipt';

// Timer Component
const KitchenTimer: React.FC<{ startTime: Date; endTime?: Date }> = ({ startTime, endTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      if (endTime) {
        const duration = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
        setElapsed(Math.max(0, duration));
        return;
      }
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    };

    update();

    if (!endTime) {
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, endTime]);

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatted = formatDuration(elapsed);

  if (endTime) {
    return (
      <div className="flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
        <CheckCircle size={14} />
        <span>{formatted}</span>
      </div>
    );
  }

  let textColor = 'text-green-600 dark:text-green-400';
  if (elapsed >= 1200) textColor = 'text-red-600 dark:text-red-400 font-bold animate-pulse';
  else if (elapsed >= 600) textColor = 'text-yellow-600 dark:text-yellow-400 font-bold';

  return (
    <div className={`flex items-center gap-1 text-sm ${textColor}`}>
      <Clock size={14} />
      <span>{formatted}</span>
    </div>
  );
};

const KitchenDisplay: React.FC = () => {
  const { t, orders, updateOrderStatus, currentUser } = useAppContext();
  const { printKitchenRawBt } = useReceiptActions();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  // Filtrar pedidos según el rol del usuario
  const isWaiter = currentUser?.role === UserRole.Waiter || currentUser?.role === 'Waiter';

  const activeOrders = orders
    .filter((order) => {
      // Si el pedido ya fue entregado por el repartidor, NO mostrarlo en cocina.
      if ((order as any).driverFlowStatus === 'delivered') return false;

      const isActiveStatus =
        order.status === OrderStatus.Pending ||
        order.status === OrderStatus.Preparing ||
        order.status === OrderStatus.Ready;

      // Si es mesero, solo mostrar pedidos "Listos"
      if (isWaiter) {
        return order.status === OrderStatus.Ready;
      }

      // Para otros roles, mostrar todos los pedidos activos
      return isActiveStatus;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const preparingOrders = activeOrders.filter(
    (order) => order.status === OrderStatus.Pending || order.status === OrderStatus.Preparing
  );

  const readyOrders = activeOrders.filter(
    (order) => order.status === OrderStatus.Ready
  );

  const transitOrders = useMemo(() => {
    return orders.filter(o =>
      o.orderType === OrderType.Delivery &&
      o.status === OrderStatus.Delivered &&
      (o as any).driverFlowStatus !== 'delivered'
    );
  }, [orders]);

  // Si es mesero, solo mostrar la columna de "Listos"
  const statusColumns = isWaiter
    ? [{ title: t('kitchen.ready'), orders: readyOrders, color: 'border-ready' }]
    : [
      { title: t('kitchen.preparing'), orders: preparingOrders, color: 'border-preparing' },
      { title: t('kitchen.ready'), orders: readyOrders, color: 'border-ready' },
    ];

  const [hasActivatedAudio, setHasActivatedAudio] = useState(() => {
    return localStorage.getItem('kitchen_audio_activated') === 'true';
  });

  const requestAudioUsage = () => {
    playSound('kitchen');
    localStorage.setItem('kitchen_audio_activated', 'true');
    setHasActivatedAudio(true);
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  const handleCancelRequest = (order: Order) => {
    setOrderToCancel(order);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (orderToCancel) {
      setUpdatingOrderId(orderToCancel.id);
      try {
        await updateOrderStatus(orderToCancel.id, OrderStatus.Cancelled);
      } catch (error) {
        alert(t('kitchen.error_updating') || "Error");
      } finally {
        setUpdatingOrderId(null);
      }
    }
    setIsCancelModalOpen(false);
    setOrderToCancel(null);
  };

  const ActionButton: React.FC<{ order: Order }> = ({ order }) => {
    const isUpdating = updatingOrderId === order.id;

    const handleStatusUpdate = async (newStatus: OrderStatus) => {
      setUpdatingOrderId(order.id);
      try {
        await updateOrderStatus(order.id, newStatus);
      } catch (error) {
        alert(t('kitchen.error_updating') || "Error");
      } finally {
        setUpdatingOrderId(null);
      }
    };

    if (order.status === OrderStatus.Pending || order.status === OrderStatus.Preparing) {
      return (
        <Button
          className="w-full mt-4 !bg-ready"
          onClick={() => handleStatusUpdate(OrderStatus.Ready)}
          loading={isUpdating}
          disabled={isUpdating}
        >
          {t('kitchen.mark_ready')}
        </Button>
      );
    }
    if (order.status === OrderStatus.Ready) {
      if (order.orderType === OrderType.Delivery) {
        // For delivery orders, we don't show the handoff button in kitchen.
        // This forces the flow to be handled in the Delivery App/Management.
        // This prevents the "disappearing from driver app" issue.
        return (
          <div className="mt-4 w-full py-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400">
            <Clock size={14} className="animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-tight">Listo para recojo</span>
          </div>
        );
      }
      return (
        <Button
          className="w-full mt-4 !bg-sky-600 hover:!bg-sky-700"
          onClick={() => handleStatusUpdate(OrderStatus.Delivered)}
          loading={isUpdating}
          disabled={isUpdating}
        >
          {t('kitchen.mark_delivered')}
        </Button>
      );
    }

    if (order.status === OrderStatus.Delivered && order.orderType === OrderType.Delivery) {
      // The order is with the driver. Only the driver can finalize it via DeliveryDriver.tsx.
      // The kitchen just needs visual confirmation — no action needed.
      return (
        <div className="mt-4 w-full py-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 flex items-center justify-center gap-2 text-sky-700 dark:text-sky-400">
          <Navigation size={15} className="animate-pulse" />
          <span className="text-[11px] font-black uppercase tracking-widest">Repartidor en camino...</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('kitchen.title')}</h1>
        {currentUser?.role === UserRole.Cook && (
          <Button onClick={requestAudioUsage} className={`bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 !py-2 border ${!hasActivatedAudio ? 'animate-pulse bg-yellow-500' : 'text-gray-600 dark:text-gray-300'}`}>
            <BellRing className="mr-2" size={18} />
            {t('monitor.test_alert')}
          </Button>
        )}
      </div>

      <div className={`grid grid-cols-1 ${isWaiter ? 'md:grid-cols-1' : 'md:grid-cols-2'} gap-6 h-[calc(100vh-10rem)]`}>
        {statusColumns.map((col) => (
          <div key={col.title} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex flex-col">
            <h2 className={`text-xl font-bold text-center pb-2 mb-4 border-b-4 ${col.color} text-gray-900 dark:text-white`}>
              {col.title}
            </h2>
            <div className="overflow-y-auto space-y-4 flex-grow pr-2">
              {col.orders.map((order) => (
                <Card key={order.id} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('kitchen.order')} #{order.dailyTicketNumber}</h3>
                        {order.customerName && <p className="text-sm text-gray-600 dark:text-gray-400">{order.customerName}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.orderType === OrderType.Delivery ? 'bg-orange-100 text-orange-700 flex items-center gap-1' :
                            order.orderType === OrderType.Takeaway ? 'bg-purple-100 text-purple-700' :
                              'bg-blue-100 text-blue-700'}`}>
                            {order.orderType === OrderType.Delivery ? (
                              <><MapPin size={10} /> {t('sidebar.delivery')}</>
                            ) : order.orderType === OrderType.Takeaway ? (
                              t('kitchen.takeaway_order')
                            ) : (
                              `${t('kitchen.from_table')} ${order.tableId}`
                            )}
                          </span>
                          <button
                            onClick={() => setPreviewOrder(order)}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                            title="Vista previa e Imprimir"
                          >
                            <Printer size={16} />
                          </button>
                        </div>
                        <KitchenTimer startTime={order.timestamp} endTime={order.readyTime} />
                      </div>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {order.items.map((item, idx) => (
                        <li key={idx}>
                          <div className="flex justify-between text-base text-gray-800 dark:text-gray-200 leading-tight">
                            <div className="flex-1">
                              <span className="font-bold">
                                {item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name}
                              </span>
                              {item.selectedExtras && item.selectedExtras.length > 0 && (
                                <div className="mt-0.5 space-y-0.5">
                                  {item.selectedExtras.map(extra => (
                                    <div key={extra.id} className="text-sm font-black text-red-600 dark:text-red-400 uppercase flex items-center gap-1">
                                      <span className="text-[10px]">▶</span> {extra.name}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="font-black text-xl ml-2">x{item.quantity}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {order.notes && order.notes.trim() !== '' && (
                      <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded">
                        <p className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-0.5">Notas:</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 italic">"{order.notes}"</p>
                      </div>
                    )}
                    {order.orderType === OrderType.Delivery && (
                      <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 rounded space-y-2">
                        {order.customerPhone && (
                          <div>
                            <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                              <Smartphone size={10} /> {t('common.phone') || 'Celular'}:
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{order.customerPhone}</p>
                          </div>
                        )}
                        {order.shippingReference && (
                          <div>
                            <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                              <MapPin size={10} /> Referencia:
                            </p>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 italic">"{order.shippingReference}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <ActionButton order={order} />
                    {!isWaiter && (order.status === OrderStatus.Pending || order.status === OrderStatus.Preparing) && (
                      <div className="text-center mt-2">
                        <button onClick={() => handleCancelRequest(order)} className="text-xs text-red-500 hover:underline">
                          {t('kitchen.cancel_order')}
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={t('kitchen.cancel_confirm_title')}
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIsCancelModalOpen(false)}>{t('menu.cancel')}</Button>
            <Button variant="danger" onClick={handleConfirmCancel}>{t('settings.confirm')}</Button>
          </div>
        }
      >
        <p>{t('kitchen.cancel_confirm_desc')}</p>
      </Modal>

      <Modal
        isOpen={!!previewOrder}
        onClose={() => setPreviewOrder(null)}
        title="Ticket de Cocina"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setPreviewOrder(null)}>Cerrar</Button>
            <Button onClick={() => printKitchenRawBt(previewOrder!)}>
              <Smartphone size={16} className="mr-2" /> Imprimir BT
            </Button>
          </div>
        }
      >
        {previewOrder && <KitchenReceipt order={previewOrder} />}
      </Modal>
    </div>
  );
};

export default KitchenDisplay;
