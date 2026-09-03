// Da de alta una cuenta real de staff/admin desde el panel — crear un
// usuario de auth necesita el service role (la API admin de Supabase Auth
// nunca puede llamarse desde el navegador), así que esta función lo hace por
// el cliente: crea el usuario, le guarda el perfil, le asigna un rol real de
// `user_roles` (enum app_role: admin/user/repartidor/superadmin) y, salvo
// que el rol sea superadmin (no pertenece a un restaurante en particular),
// lo vincula al restaurante vía `restaurant_staff`.
//
// verify_jwt=true: solo entra alguien con sesión válida. Además, aquí adentro
// se exige que quien llama sea superadmin de la plataforma o dueño/admin del
// propio restaurante — dar de alta cuentas es una acción sensible, no basta
// con "está logueado".
//
// Si algún insert después de crear el usuario de auth falla, se borra ese
// usuario (auth.admin.deleteUser) para no dejar una cuenta huérfana sin
// perfil/rol/vínculo al restaurante.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Roles reales del enum app_role que tiene sentido asignar al dar de alta
// una cuenta de staff desde aquí — se excluye "user" a propósito: es el rol
// por default de un cliente, nunca algo que se asigne manualmente.
const ROLES_VALIDOS = ["admin", "repartidor", "superadmin"] as const;
type RolStaff = (typeof ROLES_VALIDOS)[number];

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !caller) {
      return json({ error: "No autenticado" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      restaurant_id: restaurantId,
      nombre,
      apellidos,
      email,
      telefono,
      password,
      role,
    } = body as {
      restaurant_id?: string; nombre?: string; apellidos?: string; email?: string;
      telefono?: string; password?: string; role?: string;
    };

    if (!nombre?.trim() || !apellidos?.trim() || !email?.trim() || !password || !role) {
      return json({ error: "Faltan campos requeridos" }, 400);
    }
    if (!ROLES_VALIDOS.includes(role as RolStaff)) {
      return json({ error: `Rol inválido: ${role}` }, 400);
    }
    if (!PASSWORD_REGEX.test(password)) {
      return json({ error: "La contraseña no cumple los requisitos de seguridad (8+ caracteres, mayúscula, minúscula, número y carácter especial)" }, 400);
    }
    if (role !== "superadmin" && !restaurantId) {
      return json({ error: "Falta el restaurante para este rol" }, 400);
    }

    // Autorización real: superadmin de la plataforma, o dueño/admin del
    // propio restaurante al que se está agregando la cuenta.
    const [{ data: callerRoles }, callerStaffResult] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id),
      restaurantId
        ? supabaseAdmin.from("restaurant_staff").select("role").eq("user_id", caller.id).eq("restaurant_id", restaurantId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const esSuperadmin = (callerRoles ?? []).some((r: { role: string }) => r.role === "superadmin");
    const callerStaffRole = (callerStaffResult as { data: { role: string } | null } | null)?.data?.role;
    const esAdminDelRestaurante = callerStaffRole === "owner" || callerStaffRole === "admin";
    if (!esSuperadmin && !esAdminDelRestaurante) {
      return json({ error: "No tienes permiso para dar de alta cuentas" }, 403);
    }

    const nombreCompleto = `${nombre.trim()} ${apellidos.trim()}`.trim();
    const emailLimpio = email.trim().toLowerCase();

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLimpio,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombreCompleto },
    });
    if (createError || !created?.user) {
      return json({ error: createError?.message ?? "No se pudo crear la cuenta" }, 400);
    }
    const nuevoUserId = created.user.id;

    const limpiarYFallar = async (mensaje: string) => {
      await supabaseAdmin.auth.admin.deleteUser(nuevoUserId).catch((e) =>
        console.error("crear-cuenta-staff: no se pudo limpiar el usuario huérfano", e)
      );
      return json({ error: mensaje }, 500);
    };

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: nuevoUserId,
      email: emailLimpio,
      nombre: nombreCompleto,
      telefono: telefono?.trim() || null,
    });
    if (profileError) return await limpiarYFallar(`No se pudo crear el perfil: ${profileError.message}`);

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: nuevoUserId,
      role,
    });
    if (roleError) return await limpiarYFallar(`No se pudo asignar el rol: ${roleError.message}`);

    if (role !== "superadmin" && restaurantId) {
      const staffRole = role === "admin" ? "admin" : "repartidor";
      const { error: staffError } = await supabaseAdmin.from("restaurant_staff").insert({
        restaurant_id: restaurantId,
        user_id: nuevoUserId,
        role: staffRole,
      });
      if (staffError) return await limpiarYFallar(`No se pudo vincular al restaurante: ${staffError.message}`);
    }

    return json({ ok: true, user_id: nuevoUserId });
  } catch (err) {
    console.error("crear-cuenta-staff error:", err);
    return json({ error: "Error interno" }, 500);
  }
});
