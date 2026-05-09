import { useState, useCallback } from 'react';
import { PaymentMethod } from '../types';

interface PaymentState {
    paymentMethod: PaymentMethod;
    amountPaid: string;
    combinedCash: string;
    combinedQR: string;
    discount: string;
}

interface PaymentCalculations {
    total: number;
    discountAmount: number;
    finalTotal: number;
    change: number;
    cashPaid: number;
    qrPaid: number;
}

export const usePayment = (orderTotal: number) => {
    const [paymentState, setPaymentState] = useState<PaymentState>({
        paymentMethod: PaymentMethod.Cash,
        amountPaid: '',
        combinedCash: '',
        combinedQR: '',
        discount: ''
    });

    const setPaymentMethod = useCallback((method: PaymentMethod) => {
        setPaymentState(prev => ({ ...prev, paymentMethod: method }));
    }, []);

    const setAmountPaid = useCallback((amount: string) => {
        setPaymentState(prev => ({ ...prev, amountPaid: amount }));
    }, []);

    const setCombinedCash = useCallback((amount: string) => {
        const cashValue = parseFloat(amount) || 0;
        const remaining = Math.max(0, orderTotal - cashValue);
        setPaymentState(prev => ({
            ...prev,
            combinedCash: amount,
            combinedQR: remaining > 0 ? remaining.toFixed(2) : ''
        }));
    }, [orderTotal]);

    const setCombinedQR = useCallback((amount: string) => {
        const qrValue = parseFloat(amount) || 0;
        const remaining = Math.max(0, orderTotal - qrValue);
        setPaymentState(prev => ({
            ...prev,
            combinedQR: amount,
            combinedCash: remaining > 0 ? remaining.toFixed(2) : ''
        }));
    }, [orderTotal]);

    const setDiscount = useCallback((discount: string) => {
        setPaymentState(prev => ({ ...prev, discount }));
    }, []);

    const calculatePayment = useCallback((): PaymentCalculations => {
        const discountValue = parseFloat(paymentState.discount) || 0;
        const discountAmount = (orderTotal * discountValue) / 100;
        const finalTotal = orderTotal - discountAmount;

        let cashPaid = 0;
        let qrPaid = 0;
        let change = 0;

        if (paymentState.paymentMethod === PaymentMethod.Cash) {
            cashPaid = parseFloat(paymentState.amountPaid) || 0;
            change = Math.max(0, cashPaid - finalTotal);
        } else if (paymentState.paymentMethod === PaymentMethod.QR) {
            qrPaid = finalTotal;
        } else if (paymentState.paymentMethod === PaymentMethod.Combined) {
            cashPaid = parseFloat(paymentState.combinedCash) || 0;
            qrPaid = parseFloat(paymentState.combinedQR) || 0;
        }

        return {
            total: orderTotal,
            discountAmount,
            finalTotal,
            change,
            cashPaid,
            qrPaid
        };
    }, [paymentState, orderTotal]);

    const resetPayment = useCallback(() => {
        setPaymentState({
            paymentMethod: PaymentMethod.Cash,
            amountPaid: '',
            combinedCash: '',
            combinedQR: '',
            discount: ''
        });
    }, []);

    const isPaymentValid = useCallback((): boolean => {
        const calculations = calculatePayment();

        if (paymentState.paymentMethod === PaymentMethod.Cash) {
            return calculations.cashPaid >= calculations.finalTotal;
        } else if (paymentState.paymentMethod === PaymentMethod.Combined) {
            const total = calculations.cashPaid + calculations.qrPaid;
            return Math.abs(total - calculations.finalTotal) < 0.01; // Tolerancia de 1 centavo
        }

        return true; // QR siempre válido
    }, [paymentState, calculatePayment]);

    return {
        paymentState,
        setPaymentMethod,
        setAmountPaid,
        setCombinedCash,
        setCombinedQR,
        setDiscount,
        calculatePayment,
        resetPayment,
        isPaymentValid
    };
};
