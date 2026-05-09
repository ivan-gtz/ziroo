
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Receipt from './receipt/Receipt';
import { Order, BranchSettings } from '../types';
import { generateReceipt, generateKitchenTicket, uint8ToBase64 } from '../lib/escpos';
import { useAppContext } from '../context/AppContext';

declare const html2canvas: any;

interface ReceiptDetails {
  order: Order;
  settings: BranchSettings;
}

interface ReceiptActionContextType {
  printReceipt: (details: ReceiptDetails) => void;
  downloadReceipt: (details: ReceiptDetails) => void;
  printRawBt: (details: ReceiptDetails) => void;
  printKitchenTicket: (order: Order) => void;
  printKitchenRawBt: (order: Order) => void;
}

const ReceiptActionContext = createContext<ReceiptActionContextType | undefined>(undefined);

export const ReceiptActionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [receiptDetails, setReceiptDetails] = useState<ReceiptDetails | null>(null);
  const [action, setAction] = useState<'print' | 'download' | null>(null);
  const { t } = useAppContext();

  const performAction = useCallback(() => {
    if (!receiptDetails || !action) return;

    if (action === 'print') {
      window.print();
    } else if (action === 'download') {
      const receiptElement = document.getElementById('receipt-print');
      if (receiptElement && typeof html2canvas !== 'undefined') {
        html2canvas(receiptElement, { scale: 2 }).then((canvas: HTMLCanvasElement) => {
          const image = canvas.toDataURL('image/png', 1.0);
          const link = document.createElement('a');
          link.href = image;
          link.download = `receipt-${receiptDetails.order.dailyTicketNumber}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
      }
    }

    // Cleanup after action
    setReceiptDetails(null);
    setAction(null);
  }, [action, receiptDetails]);

  // Using useEffect to handle actions after state update
  React.useEffect(() => {
    if (receiptDetails && action) {
      // Timeout ensures the component has rendered before we try to act on it
      const timer = setTimeout(performAction, 100);
      return () => clearTimeout(timer);
    }
  }, [receiptDetails, action, performAction]);

  const printReceipt = (details: ReceiptDetails) => {
    setReceiptDetails(details);
    setAction('print');
  };

  const downloadReceipt = (details: ReceiptDetails) => {
    setReceiptDetails(details);
    setAction('download');
  };

  const printRawBt = (details: ReceiptDetails) => {
    const bytes = generateReceipt(details.order, details.settings, t);
    const base64 = uint8ToBase64(bytes);
    launchRawBT(`rawbt:base64,${base64}`);
  };

  const printKitchenTicket = (order: Order) => {
    // For now, kitchen ticket only supports ESC/POS via RawBT or similar
    // We could add a HTML version if needed, but usually kitchen needs ESC/POS
    printKitchenRawBt(order);
  };

  const printKitchenRawBt = (order: Order) => {
    const bytes = generateKitchenTicket(order, t);
    const base64 = uint8ToBase64(bytes);
    launchRawBT(`rawbt:base64,${base64}`);
  };

  const launchRawBT = (url: string) => {
    // Detect mobile/Android to avoid useless errors on Desktop
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (!isAndroid) {
      console.warn("RawBT printing is only supported on Android. Skipping scheme launch.");
      return;
    }

    // Use an iframe to launch the scheme without aborting page scripts or causing "Failed to launch" to block
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    // Cleanup
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 500);
  };

  return (
    <ReceiptActionContext.Provider value={{ printReceipt, downloadReceipt, printRawBt, printKitchenTicket, printKitchenRawBt }}>
      {children}
      {receiptDetails && createPortal(
        <div className={action === 'print' ? '' : 'absolute -left-[9999px]'}>
          <Receipt
            order={receiptDetails.order}
            settings={receiptDetails.settings}
          />
        </div>,
        document.body
      )}
    </ReceiptActionContext.Provider>
  );
};

export const useReceiptActions = () => {
  const context = useContext(ReceiptActionContext);
  if (context === undefined) {
    throw new Error('useReceiptActions must be used within a ReceiptActionProvider');
  }
  return context;
};
