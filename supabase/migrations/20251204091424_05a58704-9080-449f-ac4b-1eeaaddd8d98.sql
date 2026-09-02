-- Allow repartidores to view all orders
CREATE POLICY "Repartidores can view all orders" 
ON public.orders 
FOR SELECT 
USING (public.has_role(auth.uid(), 'repartidor'));

-- Allow repartidores to update orders (for status changes)
CREATE POLICY "Repartidores can update orders" 
ON public.orders 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'repartidor'));