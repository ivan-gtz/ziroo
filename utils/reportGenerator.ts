import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, OrderStatus, BranchSettings } from '../types';

interface DailyData {
    date: string;
    ticketsIssued: number;
    qrPayments: number;
    cashPayments: number;
    expensesAmount: number; // Added
    cancellations: number;
    totalSales: number;
    netCash: number; // Added: Cash - Expenses
}

interface MonthlyReportData {
    restaurantName: string;
    taxId: string;
    address: string;
    month: string;
    year: number;
    dailyData: DailyData[];
    operatingDays: number;
    averageTicket: number;
    totalSales: number;
    totalExpenses: number; // Added
    netTotal: number; // Added
    currencySymbol: string;
}

const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
};

export const generateMonthlyReportData = (
    orders: Order[],
    expenses: any[], // Added
    settings: BranchSettings,
    year: number,
    month: number // 0-indexed (0 = January)
): MonthlyReportData => {
    const daysInMonth = getDaysInMonth(year, month);
    const dailyData: DailyData[] = [];
    const currencySymbol = settings.currency || '$';

    // Initialize all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

        // Filter orders for this specific day
        const dayOrders = orders.filter(order => {
            const orderDate = new Date(order.timestamp);
            return orderDate.getFullYear() === year &&
                orderDate.getMonth() === month &&
                orderDate.getDate() === day;
        });

        const deliveredOrders = dayOrders.filter(o => (o.status || '').toLowerCase() === OrderStatus.Delivered.toLowerCase());
        const cancelledOrders = dayOrders.filter(o => (o.status || '').toLowerCase() === OrderStatus.Cancelled.toLowerCase());

        let qrPayments = 0;
        let cashPayments = 0;

        deliveredOrders.forEach(order => {
            let total = order.totalAmount || 0;

            // If totalAmount is missing or 0, calculate from items
            if (!total && order.items) {
                total = order.items.reduce((sum, item) => {
                    const price = item.variation?.price ?? item.menuItem.price;
                    return sum + (price * item.quantity);
                }, 0);
            }

            const method = (order.paymentMethod || '').toLowerCase();

            if (method === 'qr') {
                qrPayments += total;
            } else if (method === 'cash') {
                cashPayments += total;
            } else if (method === 'combined') {
                // Use the split amounts
                qrPayments += order.qrPaid || 0;
                cashPayments += order.cashPaid || 0;
            }
        });

        // Filter expenses for this day
        const dayExpenses = (expenses || []).filter(e => {
            const expDate = new Date(e.createdAt);
            return expDate.getFullYear() === year &&
                expDate.getMonth() === month &&
                expDate.getDate() === day;
        });

        const totalDayExpenses = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

        dailyData.push({
            date: dateStr,
            ticketsIssued: deliveredOrders.length,
            qrPayments,
            cashPayments,
            expensesAmount: totalDayExpenses,
            cancellations: cancelledOrders.length,
            totalSales: qrPayments + cashPayments,
            netCash: cashPayments - totalDayExpenses
        });
    }

    const operatingDays = dailyData.filter(d => d.ticketsIssued > 0).length;
    const totalSales = dailyData.reduce((sum, d) => sum + d.totalSales, 0);
    const totalExpenses = dailyData.reduce((sum, d) => sum + d.expensesAmount, 0);
    const totalTickets = dailyData.reduce((sum, d) => sum + d.ticketsIssued, 0);
    const averageTicket = totalTickets > 0 ? totalSales / totalTickets : 0;

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return {
        restaurantName: settings.restaurantName || 'Restaurant',
        taxId: settings.taxId || 'N/A',
        address: settings.address || 'N/A',
        month: monthNames[month],
        year,
        dailyData,
        operatingDays,
        averageTicket,
        totalSales,
        totalExpenses,
        netTotal: totalSales - totalExpenses,
        currencySymbol
    };
};

const formatCurrency = (amount: number, symbol: string): string => {
    return `${symbol} ${amount.toFixed(2)}`;
};

export const downloadExcel = (data: MonthlyReportData) => {
    const worksheetData = [
        ['Reporte Mensual de Ventas'],
        [],
        ['Restaurante:', data.restaurantName],
        ['NIT/Tax ID:', data.taxId],
        ['Dirección:', data.address],
        ['Período:', `${data.month} ${data.year}`],
        [],
        ['Resumen del Mes'],
        ['Días Operativos:', data.operatingDays],
        ['Ticket Promedio:', formatCurrency(data.averageTicket, data.currencySymbol)],
        ['Ventas Totales:', formatCurrency(data.totalSales, data.currencySymbol)],
        ['Gastos Totales:', formatCurrency(data.totalExpenses, data.currencySymbol)],
        ['Balance Neto:', formatCurrency(data.netTotal, data.currencySymbol)],
        [],
        ['Fecha', 'Tickets Emitidos', 'Pagos QR', 'Pagos Efectivo', 'Gastos', 'Ventas Totales', 'Caja (Neto)'],
        ...data.dailyData.map(d => [
            d.date,
            d.ticketsIssued,
            formatCurrency(d.qrPayments, data.currencySymbol),
            formatCurrency(d.cashPayments, data.currencySymbol),
            formatCurrency(d.expensesAmount, data.currencySymbol),
            formatCurrency(d.totalSales, data.currencySymbol),
            formatCurrency(d.netCash, data.currencySymbol)
        ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Mensual');

    // Auto-size columns
    const maxWidth = worksheetData.reduce((w, r) => Math.max(w, r.length), 10);
    ws['!cols'] = Array(maxWidth).fill({ wch: 15 });

    XLSX.writeFile(wb, `Reporte_${data.month}_${data.year}.xlsx`);
};

export const downloadPDF = (data: MonthlyReportData) => {
    const doc = new jsPDF();

    // Modern Header with gradient effect
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE MENSUAL DE VENTAS', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.month} ${data.year}`, 105, 30, { align: 'center' });

    // Restaurant Info Card
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(15, 52, 180, 35, 3, 3, 'F');

    doc.setTextColor(52, 73, 94);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL RESTAURANTE', 20, 60);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Restaurante: ${data.restaurantName}`, 20, 68);
    doc.text(`NIT/Tax ID: ${data.taxId}`, 20, 74);
    doc.text(`Dirección: ${data.address}`, 20, 80);

    // Summary Cards
    const cardY = 95;
    const cardWidth = 56;
    const cardHeight = 28;
    const gap = 6;

    // Card 1: Operating Days
    doc.setFillColor(46, 204, 113);
    doc.roundedRect(15, cardY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Días Operativos', 43, cardY + 8, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.operatingDays.toString(), 43, cardY + 20, { align: 'center' });

    // Card 2: Average Ticket
    doc.setFillColor(52, 152, 219);
    doc.roundedRect(15 + cardWidth + gap, cardY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Ticket Promedio', 43 + cardWidth + gap, cardY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.averageTicket, data.currencySymbol), 43 + cardWidth + gap, cardY + 20, { align: 'center' });

    // Card 3: Total Sales
    doc.setFillColor(231, 76, 60);
    doc.roundedRect(15 + (cardWidth + gap) * 2, cardY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Ventas Totales', 43 + (cardWidth + gap) * 2, cardY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(data.totalSales, data.currencySymbol), 43 + (cardWidth + gap) * 2, cardY + 20, { align: 'center' });

    // Daily Data Table
    autoTable(doc, {
        startY: 132,
        head: [['Fecha', 'Tickets', 'Pagos QR', 'Pagos Efectivo', 'Gastos', 'Caja (Neto)', 'Total Bruto']],
        body: data.dailyData.map(d => [
            d.date,
            d.ticketsIssued.toString(),
            formatCurrency(d.qrPayments, data.currencySymbol),
            formatCurrency(d.cashPayments, data.currencySymbol),
            formatCurrency(d.expensesAmount, data.currencySymbol),
            formatCurrency(d.netCash, data.currencySymbol),
            formatCurrency(d.totalSales, data.currencySymbol)
        ]),
        headStyles: {
            fillColor: [41, 128, 185],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [52, 73, 94]
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        },
        columnStyles: {
            0: { cellWidth: 22, halign: 'center' }, // Fecha
            1: { cellWidth: 12, halign: 'center' }, // Tickets
            2: { cellWidth: 28, halign: 'right' },  // Pagos QR
            3: { cellWidth: 30, halign: 'right' },  // Pagos Efectivo
            4: { cellWidth: 25, halign: 'center' }, // Gastos
            5: { cellWidth: 33, halign: 'right', fontStyle: 'bold', fillColor: [230, 245, 255] }, // Caja (Neto)
            6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } // Total Bruto
        },
        margin: { left: 15, right: 15 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        doc.text(`Generado el ${new Date().toLocaleDateString()}`, 105, 290, { align: 'center' });
    }

    doc.save(`Reporte_${data.month}_${data.year}.pdf`);
};

export const downloadXML = (data: MonthlyReportData) => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ReporteMensual>
    <Restaurante>
        <Nombre>${data.restaurantName}</Nombre>
        <TaxID>${data.taxId}</TaxID>
        <Direccion>${data.address}</Direccion>
    </Restaurante>
    <Periodo>
        <Mes>${data.month}</Mes>
        <Año>${data.year}</Año>
    </Periodo>
    <Resumen>
        <DiasOperativos>${data.operatingDays}</DiasOperativos>
        <TicketPromedio>${data.averageTicket.toFixed(2)}</TicketPromedio>
        <VentasTotales>${data.totalSales.toFixed(2)}</VentasTotales>
        <Moneda>${data.currencySymbol}</Moneda>
    </Resumen>
    <DatoDiarios>
${data.dailyData.map(d => `        <Dia>
            <Fecha>${d.date}</Fecha>
            <TicketsEmitidos>${d.ticketsIssued}</TicketsEmitidos>
            <PagosQR>${d.qrPayments.toFixed(2)}</PagosQR>
            <PagosEfectivo>${d.cashPayments.toFixed(2)}</PagosEfectivo>
            <Anulaciones>${d.cancellations}</Anulaciones>
            <VentasTotales>${d.totalSales.toFixed(2)}</VentasTotales>
        </Dia>`).join('\n')}
    </DatoDiarios>
</ReporteMensual>`;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_${data.month}_${data.year}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --- YEARLY REPORT LOGIC ---

export interface YearlyReportData {
    restaurantName: string;
    taxId: string;
    address: string;
    year: number;
    monthlyData: {
        month: string;
        ticketsIssued: number;
        qrPayments: number;
        cashPayments: number;
        cancellations: number;
        totalExpenses: number; // Added
        totalSales: number;
        averageTicket: number;
    }[];
    totalSales: number;
    totalTickets: number;
    totalQR: number;
    totalCash: number;
    totalCancellations: number;
    totalExpenses: number; // Added
    netTotal: number; // Added
    averageTicket: number;
    currencySymbol: string;
}

export const generateYearlyReportData = (
    orders: Order[],
    expenses: any[], // Added
    summaries: any[], // Monthly summaries already archived
    settings: BranchSettings,
    year: number
): YearlyReportData => {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const monthlyData: YearlyReportData['monthlyData'] = [];
    const currencySymbol = settings.currency || '$';

    for (let m = 0; m < 12; m++) {
        // 1. Check if we have an archived summary for this month
        const archived = summaries.find(s => s.year === year && s.month === m);

        if (archived) {
            // Aggregate from DailyDataJson
            const dailyData = archived.dailyDataJson || [];

            const mTickets = dailyData.reduce((sum: number, d: any) => sum + (d.ticketsIssued || 0), 0);
            const mQR = dailyData.reduce((sum: number, d: any) => sum + (d.qrPayments || 0), 0);
            const mCash = dailyData.reduce((sum: number, d: any) => sum + (d.cashPayments || 0), 0);
            const mCancellations = dailyData.reduce((sum: number, d: any) => sum + (d.cancellations || 0), 0);
            const mExpenses = dailyData.reduce((sum: number, d: any) => sum + (d.expensesAmount || 0), 0);
            const mSales = dailyData.reduce((sum: number, d: any) => sum + (d.totalSales || 0), 0);

            monthlyData.push({
                month: monthNames[m],
                ticketsIssued: mTickets,
                qrPayments: mQR,
                cashPayments: mCash,
                cancellations: mCancellations,
                totalExpenses: mExpenses,
                totalSales: mSales,
                averageTicket: mTickets > 0 ? mSales / mTickets : 0
            });
        } else {
            // 2. If not archived, calculate from current orders
            const monthOrders = orders.filter(o => {
                const d = new Date(o.timestamp);
                return d.getFullYear() === year && d.getMonth() === m;
            });

            const deliveredOrders = monthOrders.filter(o => (o.status || '').toLowerCase() === OrderStatus.Delivered.toLowerCase());
            const cancelledOrders = monthOrders.filter(o => (o.status || '').toLowerCase() === OrderStatus.Cancelled.toLowerCase());

            let qrPayments = 0;
            let cashPayments = 0;

            deliveredOrders.forEach(order => {
                let total = order.totalAmount || 0;
                if (!total && order.items) {
                    total = order.items.reduce((sum, item) => {
                        const price = item.variation?.price ?? item.menuItem.price;
                        return sum + (price * item.quantity);
                    }, 0);
                }
                const method = (order.paymentMethod || '').toLowerCase();
                if (method === 'qr') qrPayments += total;
                else if (method === 'cash') cashPayments += total;
                else if (method === 'combined') {
                    qrPayments += order.qrPaid || 0;
                    cashPayments += order.cashPaid || 0;
                }
            });

            // Calculate expenses for this month
            const monthExpenses = (expenses || []).filter(e => {
                const d = new Date(e.createdAt);
                return d.getFullYear() === year && d.getMonth() === m;
            });
            const totalMonthExpenses = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

            const sales = qrPayments + cashPayments;
            const tickets = deliveredOrders.length;

            monthlyData.push({
                month: monthNames[m],
                ticketsIssued: tickets,
                qrPayments,
                cashPayments,
                cancellations: cancelledOrders.length,
                totalExpenses: totalMonthExpenses,
                totalSales: sales,
                averageTicket: tickets > 0 ? sales / tickets : 0
            });
        }
    }

    const totalSales = monthlyData.reduce((sum, m) => sum + m.totalSales, 0);
    const totalTickets = monthlyData.reduce((sum, m) => sum + m.ticketsIssued, 0);
    const totalQR = monthlyData.reduce((sum, m) => sum + m.qrPayments, 0);
    const totalCash = monthlyData.reduce((sum, m) => sum + m.cashPayments, 0);
    const totalExpenses = monthlyData.reduce((sum, m) => sum + m.totalExpenses, 0);
    const totalCancellations = monthlyData.reduce((sum, m) => sum + m.cancellations, 0);
    const averageTicket = totalTickets > 0 ? totalSales / totalTickets : 0;

    return {
        restaurantName: settings.restaurantName || 'Restaurant',
        taxId: settings.taxId || 'N/A',
        address: settings.address || 'N/A',
        year,
        monthlyData,
        totalSales,
        totalTickets,
        totalQR,
        totalCash,
        totalCancellations,
        totalExpenses,
        netTotal: totalSales - totalExpenses,
        averageTicket,
        currencySymbol
    };
};

export const downloadYearlyExcel = (data: YearlyReportData) => {
    const worksheetData = [
        [`Reporte Anual de Ventas - ${data.year}`],
        [],
        ['Restaurante:', data.restaurantName],
        ['NIT/Tax ID:', data.taxId],
        ['Dirección:', data.address],
        [],
        ['Resumen del Año'],
        ['Ventas Totales:', formatCurrency(data.totalSales, data.currencySymbol)],
        ['Total Tickets:', data.totalTickets],
        ['Pagos QR:', formatCurrency(data.totalQR, data.currencySymbol)],
        ['Pagos Efectivo:', formatCurrency(data.totalCash, data.currencySymbol)],
        ['Gastos Totales:', formatCurrency(data.totalExpenses, data.currencySymbol)],
        ['Balance Neto:', formatCurrency(data.netTotal, data.currencySymbol)],
        ['Anulaciones:', data.totalCancellations],
        ['Ticket Promedio:', formatCurrency(data.averageTicket, data.currencySymbol)],
        [],
        ['Mes', 'Tickets', 'Pagos QR', 'Pagos Efectivo', 'Gastos', 'Ventas Totales'],
        ...data.monthlyData.map(m => [
            m.month,
            m.ticketsIssued,
            formatCurrency(m.qrPayments, data.currencySymbol),
            formatCurrency(m.cashPayments, data.currencySymbol),
            formatCurrency(m.totalExpenses, data.currencySymbol),
            formatCurrency(m.totalSales, data.currencySymbol)
        ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Anual');

    // Auto-size columns for better readability
    ws['!cols'] = [
        { wch: 15 }, // Mes
        { wch: 10 }, // Tickets
        { wch: 15 }, // QR
        { wch: 15 }, // Efectivo
        { wch: 12 }, // Anulaciones
        { wch: 18 }  // Total
    ];

    XLSX.writeFile(wb, `Reporte_Anual_${data.year}.xlsx`);
};

export const downloadYearlyPDF = (data: YearlyReportData) => {
    const doc = new jsPDF();

    // Modern Header (Consistent with Monthly Report)
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`REPORTE ANUAL ${data.year}`, 105, 25, { align: 'center' });

    // Restaurant Info
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(15, 55, 180, 25, 3, 3, 'F');

    doc.setTextColor(52, 73, 94);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(data.restaurantName, 20, 65);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`NIT/Tax ID: ${data.taxId}`, 20, 71);
    doc.text(`Dirección: ${data.address}`, 20, 77);

    // KPI Cards Row
    const cardY = 90;
    const cardWidth = 40; // Smaller width to fit 4 cards
    const cardHeight = 24;
    const gap = 5;
    const startX = 15;

    // Helper to draw mini summary card
    const drawCard = (x: number, title: string, value: string, color: [number, number, number]) => {
        doc.setFillColor(...color);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(title, x + (cardWidth / 2), cardY + 8, { align: 'center' });

        doc.setFontSize(11); // Slightly smaller font to fit large numbers
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + (cardWidth / 2), cardY + 18, { align: 'center' });
    };

    drawCard(startX, 'Tickets', data.totalTickets.toString(), [46, 204, 113]); // Green
    drawCard(startX + cardWidth + gap, 'Efectivo (Neto)', formatCurrency(data.totalCash - data.totalExpenses, data.currencySymbol), [52, 152, 219]); // Blue
    drawCard(startX + (cardWidth + gap) * 2, 'Gastos', formatCurrency(data.totalExpenses, data.currencySymbol), [155, 89, 182]); // Purple (moved)
    drawCard(startX + (cardWidth + gap) * 3, 'Ventas Totales', formatCurrency(data.totalSales, data.currencySymbol), [231, 76, 60]); // Red

    // Monthly breakdown Table
    autoTable(doc, {
        startY: 125,
        head: [['Mes', 'Tickets', 'Pagos QR', 'Pagos Efectivo', 'Gastos', 'Total']],
        body: data.monthlyData.map(m => [
            m.month,
            m.ticketsIssued.toString(),
            formatCurrency(m.qrPayments, data.currencySymbol),
            formatCurrency(m.cashPayments, data.currencySymbol),
            formatCurrency(m.totalExpenses, data.currencySymbol),
            formatCurrency(m.totalSales, data.currencySymbol)
        ]),
        headStyles: {
            fillColor: [41, 128, 185],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [52, 73, 94]
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        },
        columnStyles: {
            0: { cellWidth: 25, halign: 'left' },
            1: { cellWidth: 15, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        doc.text(`Generado el ${new Date().toLocaleDateString()}`, 105, 290, { align: 'center' });
    }

    doc.save(`Reporte_Anual_${data.year}.pdf`);
};


// --- BOLIVIA SIAT RCV EXPORT ---

export const downloadRCVExcel = (orders: Order[], settings: BranchSettings, year: number, month: number) => {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Header for RCV manual submission (16 columns)
    const headers = [
        'Fecha de Emisión',
        'Nro. de Factura',
        'Nro. de Autorización',
        'NIT / CI Cliente',
        'Complemento',
        'Nombre o Razón Social',
        'Importe Total de la Venta',
        'Importe ICE/IEHD/Tasas',
        'Exportaciones y Operaciones Exentas',
        'Ventas Gravadas a Tasa Cero',
        'Subtotal',
        'Descuentos / Bonificaciones',
        'Importe Base para Débito Fiscal',
        'Débito Fiscal (IVA)',
        'Estado (V/A)',
        'Código de Control'
    ];

    const rcvData = orders.map(order => {
        const total = order.totalAmount || 0;
        const discount = order.discount || 0;
        const subtotal = total - 0; // Assuming no ICE/IEHD/Exempt for now
        const baseAmount = total - discount;
        const debitFiscal = baseAmount * 0.13;
        const status = order.status === OrderStatus.Cancelled ? 'A' : 'V';

        return [
            new Date(order.timestamp).toLocaleDateString(),
            order.fiscalNumber || order.dailyTicketNumber,
            settings.fiscalAuthorization || '0',
            order.customerNitCI || '0',
            order.customerComplement || '',
            (order.customerName || 'SIN NOMBRE').toUpperCase(),
            total.toFixed(2),
            '0.00', // ICE
            '0.00', // Exportaciones
            '0.00', // Tasa Cero
            total.toFixed(2), // Subtotal
            discount.toFixed(2),
            baseAmount.toFixed(2),
            debitFiscal.toFixed(2),
            status,
            order.fiscalControlCode || '0'
        ];
    });

    const worksheetData = [
        [`REGISTRO DE VENTAS - ${monthNames[month]} ${year}`],
        [`NIT EMISOR: ${settings.fiscalNit || settings.taxId || 'N/A'}`],
        [`RAZON SOCIAL: ${settings.fiscalBusinessName || settings.restaurantName}`],
        [],
        headers,
        ...rcvData
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RCV_SIAT');

    const columnWidths = headers.map(() => ({ wch: 15 }));
    columnWidths[5] = { wch: 30 }; // Nombre o Razón Social
    ws['!cols'] = columnWidths;

    XLSX.writeFile(wb, `RCV_SIAT_${monthNames[month]}_${year}.xlsx`);
};

export const downloadRCVPDF = (orders: Order[], settings: BranchSettings, year: number, month: number) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    doc.setFontSize(14);
    doc.text(`REGISTRO DE VENTAS - ${monthNames[month]} ${year}`, 148, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`NIT EMISOR: ${settings.fiscalNit || settings.taxId}`, 15, 25);
    doc.text(`RAZÓN SOCIAL: ${settings.fiscalBusinessName || settings.restaurantName}`, 15, 30);

    const headers = [[
        'Fecha', 'Nro. Fac', 'NIT/CI', 'Nombre / Razón Social', 'Total', 'Subtotal', 'Desc', 'Base DF', 'IVA', 'Est'
    ]]; // Simplified for PDF landscape a4

    const body = orders.map(order => {
        const total = order.totalAmount || 0;
        const discount = order.discount || 0;
        const baseAmount = total - discount;
        const debitFiscal = baseAmount * 0.13;
        const status = order.status === OrderStatus.Cancelled ? 'A' : 'V';

        return [
            new Date(order.timestamp).toLocaleDateString(),
            order.fiscalNumber || order.dailyTicketNumber,
            order.customerNitCI || '0',
            (order.customerName || 'SIN NOMBRE').substring(0, 20),
            total.toFixed(2),
            total.toFixed(2),
            discount.toFixed(2),
            baseAmount.toFixed(2),
            debitFiscal.toFixed(2),
            status
        ];
    });

    autoTable(doc, {
        startY: 35,
        head: headers,
        body: body,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        columnStyles: {
            3: { cellWidth: 40 }, // Social Name
        }
    });

    doc.save(`RCV_SIAT_${monthNames[month]}_${year}.pdf`);
};
