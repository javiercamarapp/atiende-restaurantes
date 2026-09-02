import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem } from './CartContext';
import { supabase } from '@/integrations/supabase/client';

// Matches the real values written by the admin/repartidor panels and by
// create-order in the `orders.status` column — this used to be a fake
// 'confirmed' | 'preparing' | 'on-the-way' | 'delivered' vocabulary that had
// no connection to the real order.
export type OrderStatus = 'pending' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado';

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  address: string;
  phone: string;
  name: string;
  createdAt: Date;
}

interface OrderContextType {
  currentOrder: Order | null;
  createOrder: (orderData: Omit<Order, 'createdAt'>) => void;
  clearOrder: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // Once we have a real order id, poll its status via a SECURITY DEFINER RPC
  // (get_order_status) so the tracker reflects what the kitchen/repartidor/voice
  // agent actually does to the order — without exposing the whole `orders` table
  // (which holds customer PII and has no public SELECT policy) to postgres_changes.
  useEffect(() => {
    if (!currentOrder?.id) return;
    if (currentOrder.status === 'entregado' || currentOrder.status === 'cancelado') return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase.rpc('get_order_status', { _order_id: currentOrder.id });
      if (!error && data) {
        setCurrentOrder(prev => (prev ? { ...prev, status: data as OrderStatus } : prev));
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [currentOrder?.id, currentOrder?.status]);

  const createOrder = (orderData: Omit<Order, 'createdAt'>) => {
    setCurrentOrder({ ...orderData, createdAt: new Date() });
  };

  const clearOrder = () => {
    setCurrentOrder(null);
  };

  return (
    <OrderContext.Provider value={{ currentOrder, createOrder, clearOrder }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
};
