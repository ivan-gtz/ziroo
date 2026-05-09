
import React from 'react';
import { Order, BranchSettings } from '../types';

interface ReceiptProps {
  order: Order;
  settings: BranchSettings;
  id?: string;
}

const Receipt: React.FC<ReceiptProps> = ({ order, settings, id = 'receipt-print' }) => {
  const date = new Date(order.timestamp).toLocaleString();

  const calculateTotal = () => {
    let total = 0;
    order.items.forEach(item => {
      const basePrice = item.variation?.price ?? item.menuItem.price;
      const extrasPrice = item.selectedExtras?.reduce((s, e) => s + e.price, 0) || 0;
      total += (basePrice + extrasPrice) * item.quantity;
    });
    return total;
  };

  const subtotal = calculateTotal();
  const total = Math.max(0, subtotal - (order.discount || 0));

  return (
    <div id={id} className="bg-white p-4 w-[80mm] mx-auto text-black font-mono text-sm leading-tight shadow-md">
      <div className="text-center mb-4 text-black">
        {settings.logoImage && (
          <img src={settings.logoImage} alt="Logo" className="h-16 w-16 mx-auto mb-2 object-contain grayscale" />
        )}
        <h2 className="text-xl font-bold uppercase text-black">{settings.restaurantName}</h2>
        {settings.address && <p className="text-xs text-black">{settings.address}</p>}
        {settings.phone && <p className="text-xs text-black">{settings.phone}</p>}
        {(settings.fiscalMunicipio || settings.city || settings.country) && (
          <p className="text-xs uppercase text-black">
            {settings.fiscalMunicipio || settings.city || ''} {settings.country || 'BOLIVIA'}
          </p>
        )}
        <div className="mt-2 border-t border-b border-black py-1">
          <p className="text-xs font-bold text-black">NIT: {settings.fiscalNit || settings.taxId || '0000000'}</p>
          <p className="text-xs font-bold text-black uppercase">{settings.fiscalBusinessName ? 'FACTURA' : 'RECIBO'} N°: {order.fiscalNumber || order.dailyTicketNumber}</p>
          <p className="text-xs text-black">AUTORIZACIÓN: {settings.fiscalAuthorization || '000000000'}</p>
        </div>
        <p className="text-xs mt-1 text-black font-bold uppercase">{settings.fiscalBusinessName || settings.restaurantName}</p>
        <p className="text-xs text-black">{date}</p>
      </div>

      <div className="mb-2 border-b border-dashed border-black pb-2">
        <p className="text-xs text-black uppercase"><span className="font-bold">Cliente:</span> {order.customerName || 'SIN NOMBRE'}</p>
        <p className="text-xs text-black font-bold">
          <span className="font-bold uppercase">{order.customerDocType === 5 ? 'NIT' : 'NIT/CI'}:</span> {order.customerNitCI || order.taxId || '0'} {order.customerComplement ? `-${order.customerComplement}` : ''}
        </p>
      </div>

      <table className="w-full mb-2 text-xs">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1 text-black">CANT</th>
            <th className="text-left py-1 text-black">DETALLE</th>
            <th className="text-right py-1 text-black">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => {
            const basePrice = item.variation?.price ?? item.menuItem.price;
            const extrasPrice = item.selectedExtras?.reduce((s, e) => s + e.price, 0) || 0;
            const itemSubtotal = (basePrice + extrasPrice) * item.quantity;
            const name = item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name;
            return (
              <React.Fragment key={index}>
                <tr>
                  <td className="text-left align-top py-1 text-black">{item.quantity}</td>
                  <td className="text-left align-top py-1 text-black font-bold">{name}</td>
                  <td className="text-right align-top py-1 text-black">{itemSubtotal.toFixed(2)}</td>
                </tr>
                {item.selectedExtras?.map(extra => (
                  <tr key={`${index}-${extra.id}`} className="text-[10px] italic text-gray-800">
                    <td></td>
                    <td className="text-left py-0.5 pl-2">
                      + <span className="font-bold uppercase tracking-tight">{extra.name}</span>
                    </td>
                    <td className="text-right py-0.5">{extra.price.toFixed(2)}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="border-t border-black pt-2 mb-4">
        <div className="flex justify-between font-bold text-black">
          <span>SUBTOTAL:</span>
          <span>{settings.currency} {subtotal.toFixed(2)}</span>
        </div>
        {order.discount && order.discount > 0 && (
          <div className="flex justify-between text-xs text-black">
            <span>DESCUENTO:</span>
            <span>-{settings.currency} {order.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg mt-1 text-black">
          <span>TOTAL:</span>
          <span>{settings.currency} {total.toFixed(2)}</span>
        </div>

        {order.cashPaid !== undefined && (
          <div className="flex justify-between text-xs text-black mt-1">
            <span>EFECTIVO:</span>
            <span>{settings.currency} {order.cashPaid.toFixed(2)}</span>
          </div>
        )}
        {order.cashChange !== undefined && (
          <div className="flex justify-between text-xs text-black">
            <span>CAMBIO:</span>
            <span>{settings.currency} {order.cashChange.toFixed(2)}</span>
          </div>
        )}
      </div>

      {order.notes && order.notes.trim() !== '' && (
        <div className="mb-4 p-2 bg-gray-50 border border-black text-[10px]">
          <p className="font-bold uppercase mb-0.5">NOTAS:</p>
          <p className="font-bold text-sm italic">"{order.notes}"</p>
        </div>
      )}

      <div className="mb-4 text-xs text-black">
        <p>SON: {total.toFixed(2)} {settings.currency}</p>
        {order.fiscalControlCode && <p className="mt-1">Cód. Control: {order.fiscalControlCode}</p>}
        {settings.fiscalAuthorization && <p>Límite Emisión: {new Date(new Date().getFullYear(), 11, 31).toLocaleDateString()}</p>}
      </div>

      <div className="text-center text-xs text-black">
        <p className="font-bold mb-1 uppercase">
          {settings.fiscalLegend || '"ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS. EL USO ILÍCITO DE ÉSTA SERÁ SANCIONADO DE ACUERDO A LEY"'}
        </p>
        <p className="italic">¡Gracias por su preferencia!</p>
        <div className="mt-2 text-[10px] text-gray-400">Powered by Ziroo</div>
      </div>
    </div >
  );
};

export default Receipt;
