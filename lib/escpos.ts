
import { Order, BranchSettings } from '../types';

const encoder = new TextEncoder();

const cleanText = (text: string): string => {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/ñ/g, 'n')
        .replace(/Ñ/g, 'N');
};

export const generateReceipt = (order: Order, settings: BranchSettings, t: (key: string) => string): Uint8Array => {
    let commands = '';

    // ESC/POS Commands
    const INIT = '\x1B\x40';
    const ALIGN_CENTER = '\x1B\x61\x01';
    const ALIGN_LEFT = '\x1B\x61\x00';
    const ALIGN_RIGHT = '\x1B\x61\x02';
    const BOLD_ON = '\x1B\x45\x01';
    const BOLD_OFF = '\x1B\x45\x00';
    const TEXT_NORMAL = '\x1D\x21\x00';
    const TEXT_DOUBLE_HEIGHT = '\x1D\x21\x01';
    const TEXT_DOUBLE_WIDTH = '\x1D\x21\x10';
    const LINE_SPACING_TIGHT = '\x1B\x33\x1E';
    const CUT_PAPER = '\x1D\x56\x00';

    commands += INIT;
    commands += LINE_SPACING_TIGHT;

    // Header - Always Restaurant Name first
    commands += ALIGN_CENTER + BOLD_ON + TEXT_DOUBLE_WIDTH + settings.restaurantName.toUpperCase() + '\n' + TEXT_NORMAL + BOLD_OFF;

    if (settings.fiscalBusinessName && settings.fiscalBusinessName.toUpperCase() !== settings.restaurantName.toUpperCase()) {
        commands += cleanText(settings.fiscalBusinessName).toUpperCase() + '\n';
    }

    if (settings.address) commands += cleanText(settings.address) + '\n';
    if (settings.phone) commands += settings.phone + '\n';

    const municipio = settings.fiscalMunicipio || settings.city || '';
    const country = settings.country || 'BOLIVIA';
    if (municipio || country) {
        commands += `${municipio.toUpperCase()} - ${country.toUpperCase()}\n`;
    }

    commands += '-'.repeat(32) + '\n';

    // Fiscal Data Block (NIT, Factura, Autorizacion)
    const nit = settings.fiscalNit || settings.taxId || '0';
    const facturaNo = order.fiscalNumber || order.dailyTicketNumber;
    const authCode = settings.fiscalAuthorization || '000000000';

    commands += `NIT: ${nit}\n`;
    commands += `FACTURA N: ${facturaNo}\n`;
    commands += `AUTORIZACION: ${authCode}\n`;

    commands += '-'.repeat(32) + '\n';

    // Type and Date
    commands += ALIGN_CENTER + BOLD_ON + "COMIDA" + BOLD_OFF + '\n';
    commands += new Date(order.timestamp).toLocaleString() + '\n\n';

    // Customer Info
    commands += ALIGN_LEFT;
    commands += `CLIENTE: ${cleanText(order.customerName || 'YOYOYO').toUpperCase()}\n`;
    const clienteNit = order.customerNitCI || order.taxId || '0';
    commands += `NIT/CI: ${clienteNit}\n`;
    commands += '-'.repeat(32) + '\n';

    // Items Column logic - Fixed 32 chars width (1: 4 chars, Detail: 16 chars, Subtotal: 12 chars)
    commands += BOLD_ON + 'CANT  DETALLE           SUBTOTAL\n' + BOLD_OFF;

    let subtotal = 0;
    order.items.forEach(item => {
        const basePrice = item.variation?.price ?? item.menuItem.price;
        const extrasPrice = item.selectedExtras?.reduce((s, e) => s + e.price, 0) || 0;
        const itemSubtotal = basePrice * item.quantity;
        subtotal += (basePrice + extrasPrice) * item.quantity;

        const name = item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name;

        const qtyStr = item.quantity.toString().padEnd(4);
        const nameStr = name.substring(0, 16).padEnd(16);
        const priceStr = itemSubtotal.toFixed(2).padStart(10);
        commands += `${qtyStr}${nameStr}${priceStr}\n`;

        if (name.length > 16) {
            commands += `    ${name.substring(16)}\n`;
        }

        item.selectedExtras?.forEach(extra => {
            const extraName = `+ ${extra.name}`;
            const extraNameStr = `    ${extraName.substring(0, 16)}`.padEnd(20);
            const extraPriceTotal = extra.price * item.quantity;
            const extraPriceStr = extraPriceTotal.toFixed(2).padStart(10);
            commands += `${extraNameStr}${extraPriceStr}\n`;
            if (extraName.length > 16) {
                commands += `       ${extraName.substring(16)}\n`;
            }
        });
    });

    commands += '-'.repeat(32) + '\n';

    // Totals - Fixed width 30 to avoid wrapping
    commands += ALIGN_RIGHT;
    const currency = settings.currency || 'Bs';

    const formatLine = (label: string, value: number, isBold = false) => {
        const labelStr = label.padEnd(15);
        const valStr = `${currency} ${value.toFixed(2)}`.padStart(15);
        return (isBold ? BOLD_ON : '') + `${labelStr}${valStr}\n` + (isBold ? BOLD_OFF : '');
    };

    commands += formatLine('SUBTOTAL:', subtotal);
    // Always show discount (even 0) as in app preview
    commands += formatLine('DESCUENTO:', order.discount || 0);

    const total = Math.max(0, subtotal - (order.discount || 0));
    commands += TEXT_DOUBLE_HEIGHT + formatLine('TOTAL:', total, true) + TEXT_NORMAL;

    if (order.cashPaid) {
        commands += formatLine('EFECTIVO:', order.cashPaid);
    }
    if (order.cashChange !== undefined) {
        commands += formatLine('CAMBIO:', order.cashChange);
    }

    commands += '\n' + ALIGN_CENTER;
    if (order.notes && order.notes.trim()) {
        commands += BOLD_ON + 'NOTAS:' + BOLD_OFF + '\n';
        commands += cleanText(order.notes) + '\n\n';
    }

    commands += `SON: ${total.toFixed(2)} ${currency}\n`;
    commands += `Limite Emision: 31/12/${new Date().getFullYear()}\n\n`;

    const legend1 = '"ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAIS. ';
    const legend2 = 'EL USO ILICITO DE ESTA SERA SANCIONADO DE ACUERDO A LEY"';
    commands += BOLD_ON + cleanText(legend1) + '\n' + cleanText(legend2) + BOLD_OFF + '\n\n';

    commands += '¡Gracias por su preferencia!\n';
    commands += 'Powered by Ziroo';

    commands += CUT_PAPER;

    return encoder.encode(cleanText(commands));
};

export const generateKitchenTicket = (order: Order, t: (key: string) => string): Uint8Array => {
    const encoder = new TextEncoder();
    let commands = '';

    // ESC/POS Commands
    const INIT = '\x1B\x40';
    const ALIGN_CENTER = '\x1B\x61\x01';
    const ALIGN_LEFT = '\x1B\x61\x00';
    const BOLD_ON = '\x1B\x45\x01';
    const BOLD_OFF = '\x1B\x45\x00';
    const TEXT_NORMAL = '\x1D\x21\x00';
    const TEXT_DOUBLE_HEIGHT = '\x1D\x21\x01';
    const TEXT_DOUBLE_WIDTH = '\x1D\x21\x10';
    const TEXT_BIG = '\x1D\x21\x11'; // Double Width + Double Height
    const LINE_SPACING_TIGHT = '\x1B\x33\x1E'; // 30 dots
    const CUT_PAPER = '\x1D\x56\x00'; // Clean cut

    commands += INIT;
    commands += LINE_SPACING_TIGHT;
    commands += ALIGN_CENTER;
    commands += BOLD_ON + TEXT_DOUBLE_WIDTH + "ORDEN COCINA" + '\n' + TEXT_NORMAL + BOLD_OFF;

    // BIG TICKET NUMBER (Yellow circle fix)
    commands += ALIGN_CENTER + BOLD_ON + TEXT_BIG + `TICKET: #${order.dailyTicketNumber}` + TEXT_NORMAL + BOLD_OFF + '\n';

    commands += '\n' + ALIGN_LEFT;
    commands += `FECHA: ${new Date(order.timestamp).toLocaleString()}\n`;

    let orderTypeDisplay: string = order.orderType;
    if (order.orderType === 'DineIn') orderTypeDisplay = 'Mesa / Local';
    else if (order.orderType === 'Takeaway' || (order.orderType as string) === 'takeaway') orderTypeDisplay = 'Para Llevar';
    else if (order.orderType === 'Delivery') orderTypeDisplay = 'Delivery / Envio';

    commands += `TIPO: ${orderTypeDisplay}\n`;

    if (order.tableId && order.tableId !== '0' && order.tableId.toLowerCase() !== 'takeaway' && order.orderType === 'DineIn') {
        commands += BOLD_ON + `MESA: ${order.tableId}\n` + BOLD_OFF;
    }

    if (order.customerName) commands += `CLIENTE: ${cleanText(order.customerName)}\n`;

    commands += '-'.repeat(32) + '\n';

    // Items - BIGGER TEXT for kitchen
    commands += BOLD_ON;
    order.items.forEach(item => {
        const name = item.variation ? `${item.menuItem.name} (${item.variation.name})` : item.menuItem.name;
        commands += `${item.quantity} x ${cleanText(name)}\n`;

        item.selectedExtras?.forEach(extra => {
            commands += `  + ${cleanText(extra.name)}\n`;
        });
    });
    commands += BOLD_OFF;

    if (order.notes && order.notes.trim()) {
        commands += '\n' + BOLD_ON + 'NOTAS ADICIONALES:' + BOLD_OFF + '\n';
        commands += TEXT_DOUBLE_HEIGHT + cleanText(order.notes) + TEXT_NORMAL + '\n';
    }

    commands += '-'.repeat(32) + '\n';
    commands += ALIGN_CENTER;
    commands += "Ziroo chef - COMANDA COCINA"; // Removed trailing \n

    // Minimal gap (Green circle fix)
    commands += CUT_PAPER;

    return encoder.encode(cleanText(commands));
};

export const uint8ToBase64 = (buffer: Uint8Array): string => {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return window.btoa(binary);
};
