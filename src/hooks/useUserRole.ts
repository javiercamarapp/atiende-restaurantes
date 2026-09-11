import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

// 'superadmin' faltaba aquí — el enum real app_role sí lo tiene
// (supabase/migrations/20260901000000_multitenant_foundation.sql:
// "alter type public.app_role add value if not exists 'superadmin'"), y
// is_superadmin() en la base ya lo usa. Sin él, una fila real de superadmin
// se aceptaba en runtime (`r.role as AppRole` no valida en tiempo de
// ejecución) pero el tipo mentía sobre qué roles existen de verdad.
type AppRole = 'admin' | 'user' | 'repartidor' | 'superadmin';

export const useUserRole = (user: User | null) => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  // Patrón 6: además del rol de plataforma (user_roles), RequireRole.tsx
  // necesita saber si el usuario es staff de ALGÚN restaurante
  // (restaurant_staff: owner/admin/staff) para la regla "tenant_staff" de
  // routePermissions.ts — ver el mismo chequeo real que ya hace
  // AdminDashboard.tsx en su propio useEffect ad hoc.
  const [hasTenantMembership, setHasTenantMembership] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchRoles = async () => {
      if (!user) {
        setRoles([]);
        setHasTenantMembership(false);
        setLoading(false);
        return;
      }

      const [{ data: roleRows, error: roleError }, {
        data: staffRows,
        error: staffError,
      }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase
          .from('restaurant_staff')
          .select('restaurant_id')
          .eq('user_id', user.id),
      ]);
      if (cancelled) return;

      if (!roleError && roleRows) {
        setRoles(roleRows.map(r => r.role as AppRole));
      }
      setHasTenantMembership(!staffError && (staffRows?.length ?? 0) > 0);
      setLoading(false);
    };

    fetchRoles();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdmin = roles.includes('admin');
  const isSuperadmin = roles.includes('superadmin');
  const isRepartidor = roles.includes('repartidor');
  const isUser = roles.includes('user');

  return {
    roles,
    isAdmin,
    isSuperadmin,
    isRepartidor,
    isUser,
    hasTenantMembership,
    loading,
  };
};
