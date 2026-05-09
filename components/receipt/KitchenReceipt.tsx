
import React from 'react';
import { Order } from '../../types';

interface KitchenReceiptProps {
    order: Order;
    id?: string;
}

const KitchenReceipt: React.FC<KitchenReceiptProps> = ({ order, id = 'kitchen-print' }) => {
    const date = new Date(order.timestamp).toLocaleString();

    // Translate order types
    let orderTypeDisplay: string = order.orderType;
    if (order.orderType === 'DineIn') orderTypeDisplay = 'Mesa / Local';
    else if (order.orderType === 'Takeaway' || (order.orderType as string) === 'takeaway') orderTypeDisplay = 'Para Llevar';
    else if (order.orderType === 'Delivery') orderTypeDisplay = 'Delivery / Envio';

    return (
        <div id={id} className="bg-white p-6 w-[80mm] mx-auto text-black font-mono leading-tight shadow-md border-2 border-dashed border-gray-300">
            <div className="text-center mb-4 pb-2 border-b-2 border-black">
                <h2 className="text-2xl font-black uppercase">ORDEN COCINA</h2>
                <h3 className="text-3xl font-black">TICKET: #{order.dailyTicketNumber}</h3>
            </div>

            <div className="mb-4 text-sm font-bold">
                <p>FECHA: {date}</p>
                <p>TIPO: {orderTypeDisplay}</p>
                {order.tableId && <p>MESA: {order.tableId}</p>}
                {order.customerName && <p>CLIENTE: {order.customerName}</p>}
            </div>

            <div className="border-t-2 border-black pt-2">
                <div className="space-y-3">
                    {order.items.map((item, index) => (
                        <div key={index} className="flex flex-col border-b border-gray-100 pb-2 last:border-0">
                            <div className="flex justify-between items-start">
                                <span className="text-3xl font-black min-w-[60px]">{item.quantity} x</span>
                                <div className="flex-1 text-right">
                                    <span className="text-2xl font-black block">
                                        {item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name}
                                    </span>
                                    {item.selectedExtras && item.selectedExtras.length > 0 && (
                                        <div className="mt-1 space-y-1">
                                            {item.selectedExtras.map(extra => (
                                                <div key={extra.id} className="text-xl font-bold uppercase text-black flex items-center justify-end gap-1">
                                                    <span>▶</span> {extra.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {order.notes && order.notes.trim() !== '' && (
                <div className="mt-4 p-3 bg-yellow-50 border-2 border-black">
                    <p className="text-sm font-black uppercase mb-1">NOTAS ADICIONALES:</p>
                    <p className="text-xl font-black bg-white p-2 border border-black leading-tight italic">
                        "{order.notes}"
                    </p>
                </div>
            )}

            <div className="mt-6 pt-2 border-t border-black text-center text-xs">
                <p className="font-bold">Ziroo chef - COMANDA COCINA</p>
            </div>
        </div >
    );
};

export default KitchenReceipt;
