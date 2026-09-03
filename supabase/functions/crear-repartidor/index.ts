// Alta real de un repartidor desde el admin (ModalRepartidor.tsx).
//
// Crear un usuario real de Supabase Auth necesita el service role (el
// navegador solo tiene la publishable key), así que esto vive en una Edge
// Function. Flujo elegido: contraseña temporal que el admin escribe en el
// formulario (no invitación por correo) — es el camino más simple que no
// depende de que el proyecto tenga SMTP/plantillas de correo configuradas,
// algo que no está verificado a tiempo para la demo de mañana.
//
// Al crear el usuario en auth.users, dos triggers ya existentes en el
// proyecto corren solos (ver migraciones 20251204072058 y 20251204091424):
//   - handle_new_user_profile  -> inserta la fila en `profiles`
//   - handle_new_user_role     -> inserta ('repartidor') en `user_roles`,
//                                 porque mandamos isRepartidor: true en el
//                                 user_metadata, mismo mecanismo que ya usa
//                                 el auto-registro público de repartidores.
// Esta función solo necesita, además, insertar la fila operativa en
// `repartidor_perfil` (vehículo, licencia, contacto de emergencia, etc.).
// Si ese insert falla, se hace rollback borrando el usuario recién creado
// para no dejar una cuenta a medias (con rol pero sin perfil operativo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CrearRepartidorPayload {
  nombre_completo?: string;
  telefono?: string;
  correo?: string;
  password?: string;
  fecha_nacimiento?: string; // YYYY-MM-DD
  tipo_vehiculo?: string; // 'moto' | 'bicicleta' | 'auto'
  placas?: string;
  numero_licencia?: string;
  direccion?: string;
  contacto_emergencia_nombre?: string;
  contacto_emergencia_telefono?: string;
}

const VEHICULOS = new Set(["moto", "bicicleta", "auto"]);

function edadEnAnios(fechaNacimientoISO: string): number {
  const hoy = new Date();
  const nacimiento = new Date(`${fechaNacimientoISO}T00:00:00Z`);
  let edad = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const aunNoCumple =
    hoy.getUTCMonth() < nacimiento.getUTCMonth() ||
    (hoy.getUTCMonth() === nacimiento.getUTCMonth() && hoy.getUTCDate() < nacimiento.getUTCDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

function validar(body: CrearRepartidorPayload): string | null {
  if (!body.nombre_completo?.trim()) return "Falta el nombre completo.";
  if (!body.telefono?.trim() || body.telefono.replace(/\D/g, "").length < 10) return "El teléfono debe tener al menos 10 dígitos.";
  if (!body.correo?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.correo)) return "El correo no es válido.";
  if (!body.password || body.password.length < 8) return "La contraseña temporal debe tener al menos 8 caracteres.";
  if (!body.fecha_nacimiento || Number.isNaN(new Date(body.fecha_nacimiento).getTime())) return "Falta la fecha de nacimiento.";
  if (edadEnAnios(body.fecha_nacimiento) < 18) return "El repartidor debe ser mayor de edad (18 años o más).";
  if (!body.tipo_vehiculo || !VEHICULOS.has(body.tipo_vehiculo)) return "El tipo de vehículo debe ser moto, bicicleta o auto.";
  if (body.tipo_vehiculo !== "bicicleta") {
    if (!body.placas?.trim()) return "Las placas son obligatorias para moto/auto.";
    if (!body.numero_licencia?.trim()) return "El número de licencia es obligatorio para moto/auto.";
  }
  if (!body.direccion?.trim()) return "Falta la dirección.";
  if (!body.contacto_emergencia_nombre?.trim()) return "Falta el nombre del contacto de emergencia.";
  if (!body.contacto_emergencia_telefono?.trim() || body.contacto_emergencia_telefono.replace(/\D/g, "").length < 10) {
    return "El teléfono del contacto de emergencia debe tener al menos 10 dígitos.";
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Solo un admin autenticado puede dar de alta repartidores.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "No autenticado." }, 401);

    const { data: esAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!esAdmin) return json({ error: "Solo un admin puede agregar repartidores." }, 403);

    const body = (await req.json()) as CrearRepartidorPayload;
    const errorValidacion = validar(body);
    if (errorValidacion) return json({ error: errorValidacion }, 400);

    const correo = body.correo!.trim().toLowerCase();
    const nombreCompleto = body.nombre_completo!.trim();
    const telefono = body.telefono!.trim();

    const { data: creado, error: errorCrear } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: body.password,
      email_confirm: true,
      user_metadata: { nombre: nombreCompleto, telefono, isRepartidor: true },
    });
    if (errorCrear || !creado?.user) {
      return json({ error: errorCrear?.message || "No se pudo crear el usuario." }, 400);
    }

    const userId = creado.user.id;

    const { error: errorPerfil } = await supabaseAdmin.from("repartidor_perfil").insert({
      user_id: userId,
      nombre_completo: nombreCompleto,
      telefono,
      correo,
      fecha_nacimiento: body.fecha_nacimiento,
      tipo_vehiculo: body.tipo_vehiculo,
      placas: body.placas?.trim() || null,
      numero_licencia: body.numero_licencia?.trim() || null,
      direccion: body.direccion!.trim(),
      contacto_emergencia_nombre: body.contacto_emergencia_nombre!.trim(),
      contacto_emergencia_telefono: body.contacto_emergencia_telefono!.trim(),
    });

    if (errorPerfil) {
      // Rollback: no dejar un usuario con rol de repartidor pero sin perfil operativo.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.error("crear-repartidor: rollback tras fallo de repartidor_perfil:", errorPerfil);
      return json({ error: `No se pudo guardar el perfil operativo: ${errorPerfil.message}` }, 500);
    }

    return json({ user_id: userId, email: correo });
  } catch (err) {
    console.error("crear-repartidor error:", err);
    return json({ error: err instanceof Error ? err.message : "Error interno." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
