/**
 * SERVICIO DE ÓRDENES
 * 
 * Maneja todas las operaciones CRUD de órdenes.
 * Incluye lógica de inventario integrada.
 * Preparado para migración a Supabase.
 */

import { Order, OrderStatus, OrderItem } from '../../types';

// TODO: Reemplazar con Supabase cuando se migre
// import { supabase } from './supabaseClient';

export const orderService = {
    /**
     * Obtener todas las órdenes
     */
    async getAllOrders(): Promise<Record<string, Order[]>> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('orders')
        //     .select('*, order_items(*)')
        //     .order('created_at', { ascending: false });

        const stateJson = localStorage.getItem('ziroo_order_state');
        const state = stateJson ? JSON.parse(stateJson) : { allOrders: {}, allInventoryTransactions: {}, allDailyCounters: {} };
        return state.allOrders || {};
    },

    /**
     * Obtener órdenes por sucursal
     */
    async getOrdersByBranch(branchId: string): Promise<Order[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('orders')
        //     .select('*, order_items(*)')
        //     .eq('branch_id', branchId)
        //     .order('created_at', { ascending: false });

        const allOrders = await this.getAllOrders();
        return allOrders[branchId] || [];
    },

    /**
     * Obtener orden por ID
     */
    async getOrderById(branchId: string, orderId: string): Promise<Order | null> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('orders')
        //     .select('*, order_items(*)')
        //     .eq('id', orderId)
        //     .single();

        const orders = await this.getOrdersByBranch(branchId);
        return orders.find(o => o.id === orderId) || null;
    },

    /**
     * Crear orden
     */
    async createOrder(branchId: string, orderData: Omit<Order, 'id' | 'timestamp' | 'dailyTicketNumber'>): Promise<Order> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('orders')
        //     .insert([{ ...orderData, branch_id: branchId }])
        //     .select('*, order_items(*)')
        //     .single();

        const now = new Date();
        const dateKey = now.toLocaleDateString();

        // Obtener contador diario
        const stateJson = localStorage.getItem('ziroo_order_state');
        const state = stateJson ? JSON.parse(stateJson) : { allOrders: {}, allInventoryTransactions: {}, allDailyCounters: {} };

        let nextTicket = (state.allDailyCounters[branchId] || 0) + 1;

        const branchOrders = state.allOrders[branchId] || [];
        if (branchOrders.length > 0) {
            const lastOrder = branchOrders[branchOrders.length - 1];
            const lastDate = new Date(lastOrder.timestamp).toLocaleDateString();
            if (lastDate !== dateKey) {
                nextTicket = 1;
            }
        }

        const newOrder: Order = {
            ...orderData,
            id: Date.now().toString(),
            timestamp: now,
            dailyTicketNumber: nextTicket
        };

        const updatedOrders = {
            ...state.allOrders,
            [branchId]: [...branchOrders, newOrder]
        };

        const updatedCounters = {
            ...state.allDailyCounters,
            [branchId]: nextTicket
        };

        localStorage.setItem('ziroo_order_state', JSON.stringify({
            ...state,
            allOrders: updatedOrders,
            allDailyCounters: updatedCounters
        }));

        return newOrder;
    },

    /**
     * Actualizar estado de orden
     */
    async updateOrderStatus(branchId: string, orderId: string, status: OrderStatus): Promise<Order> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('orders')
        //     .update({ status, updated_at: new Date() })
        //     .eq('id', orderId)
        //     .select('*, order_items(*)')
        //     .single();

        const orders = await this.getOrdersByBranch(branchId);
        const orderIndex = orders.findIndex(o => o.id === orderId);

        if (orderIndex === -1) {
            throw new Error('Order not found');
        }

        const order = orders[orderIndex];
        const updates: Partial<Order> = { status };

        if (status === OrderStatus.Ready) {
            updates.readyTime = new Date();
        }

        if (status === OrderStatus.Delivered) {
            const completionTime = order.readyTime
                ? (new Date().getTime() - new Date(order.timestamp).getTime()) / 60000
                : undefined;
            updates.completionTime = completionTime;
        }

        const updatedOrder = { ...order, ...updates };
        orders[orderIndex] = updatedOrder;

        const stateJson = localStorage.getItem('ziroo_order_state');
        const state = stateJson ? JSON.parse(stateJson) : { allOrders: {}, allInventoryTransactions: {}, allDailyCounters: {} };

        const updatedOrders = {
            ...state.allOrders,
            [branchId]: orders
        };

        localStorage.setItem('ziroo_order_state', JSON.stringify({
            ...state,
            allOrders: updatedOrders
        }));

        return updatedOrder;
    },

    /**
     * Obtener órdenes por rango de fechas
     */
    async getOrdersByDateRange(branchId: string, startDate: Date, endDate: Date): Promise<Order[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('orders')
        //     .select('*, order_items(*)')
        //     .eq('branch_id', branchId)
        //     .gte('created_at', startDate.toISOString())
        //     .lte('created_at', endDate.toISOString())
        //     .order('created_at', { ascending: false });

        const orders = await this.getOrdersByBranch(branchId);
        return orders.filter(o => {
            const orderDate = new Date(o.timestamp);
            return orderDate >= startDate && orderDate <= endDate;
        });
    },

    /**
     * Obtener órdenes por estado
     */
    async getOrdersByStatus(branchId: string, status: OrderStatus): Promise<Order[]> {
        // TODO: Implementar con Supabase
        // const { data, error } = await supabase
        //     .from('orders')
        //     .select('*, order_items(*)')
        //     .eq('branch_id', branchId)
        //     .eq('status', status)
        //     .order('created_at', { ascending: false });

        const orders = await this.getOrdersByBranch(branchId);
        return orders.filter(o => o.status === status);
    },

    /**
     * Calcular total de ventas por rango de fechas
     */
    async calculateSales(branchId: string, startDate: Date, endDate: Date): Promise<{
        totalOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
        ordersByStatus: Record<OrderStatus, number>;
    }> {
        const orders = await this.getOrdersByDateRange(branchId, startDate, endDate);

        const deliveredOrders = orders.filter(o => o.status === OrderStatus.Delivered);
        const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        const ordersByStatus: Record<OrderStatus, number> = {
            [OrderStatus.AwaitingApproval]: 0,
            [OrderStatus.Pending]: 0,
            [OrderStatus.Preparing]: 0,
            [OrderStatus.Ready]: 0,
            [OrderStatus.Delivered]: 0,
            [OrderStatus.Cancelled]: 0
        };

        orders.forEach(o => {
            ordersByStatus[o.status]++;
        });

        return {
            totalOrders: orders.length,
            totalRevenue,
            averageOrderValue: deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0,
            ordersByStatus
        };
    }
};
