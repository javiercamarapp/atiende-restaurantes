// Arma y dispara el correo de bienvenida (plantillas.ts:correoBienvenida)
// cuando se crea una cuenta nueva — separado de los propios index.ts de
// crear-cuenta-staff/crear-repartidor para poder probar la construcción del
// correo (nombre de restaurante, rol legible, destinatario) sin levantar la
// función HTTP completa.
//
// A propósito estas funciones NO atrapan errores aquí adentro: quien las
// llama (los dos disparadores de alta de cuenta) decide envolver la llamada
// en try/catch y solo loguear — el correo de bienvenida es best-effort y
// nunca debe bloquear ni revertir el alta de una cuenta ya creada.
import { correoBienvenida } from "./plantillas.ts";
import { enviarCorreo } from "./enviar.ts";

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export type RolStaff = "admin" | "repartidor" | "superadmin";

// Mismas etiquetas en español que ya muestra el selector de rol del panel
// (src/components/ModalCuenta.tsx) — el correo debe decir lo mismo que vio
// quien dio de alta la cuenta, no el valor crudo del enum app_role.
export const ROL_LEGIBLE: Record<RolStaff, string> = {
  admin: "Administrador",
  repartidor: "Repartidor",
  superadmin: "Superadministrador",
};

// Un repartidor (crear-repartidor) y un superadmin (crear-cuenta-staff) no
// pertenecen a un restaurante en particular — su acceso es a la plataforma.
const NOMBRE_PLATAFORMA = "atiende.ai";

export async function nombreRestauranteBienvenida(
  supabase: SupabaseLike,
  restaurantId: string | null | undefined,
): Promise<string> {
  if (!restaurantId) return NOMBRE_PLATAFORMA;
  const { data } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();
  const nombre = (data?.name as string | undefined)?.trim();
  return nombre || NOMBRE_PLATAFORMA;
}

export async function dispararCorreoBienvenidaStaff(
  supabase: SupabaseLike,
  params: {
    userId: string;
    email: string;
    role: RolStaff;
    restaurantId: string | null | undefined;
  },
): Promise<void> {
  const nombreRestaurante = params.role === "superadmin"
    ? NOMBRE_PLATAFORMA
    : await nombreRestauranteBienvenida(supabase, params.restaurantId);
  const correo = correoBienvenida(nombreRestaurante, ROL_LEGIBLE[params.role]);
  await enviarCorreo(correo, [params.email], `bienvenida/staff/${params.userId}`);
}

export async function dispararCorreoBienvenidaRepartidor(
  params: { userId: string; email: string },
): Promise<void> {
  const correo = correoBienvenida(NOMBRE_PLATAFORMA, ROL_LEGIBLE.repartidor);
  await enviarCorreo(correo, [params.email], `bienvenida/repartidor/${params.userId}`);
}
