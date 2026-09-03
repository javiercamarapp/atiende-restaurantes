// Shared by supabase/functions/create-order (HTTP webhook, used by the website
// checkout and by the ElevenLabs voice agent's Server Tool) and by
// supabase/functions/whatsapp-webhook (called in-process, no HTTP round-trip,
// from the WhatsApp tool-use loop). Keeping this in one place means the price
// re-validation logic can't drift between the three callers.

// deno-lint-ignore-file no-explicit-any
export interface OrderItemInput {
  product_id: string;
  quantity: number;
}

export interface CreateOrderPayload {
  branch_slug?: string;
  branch_name?: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  items: OrderItemInput[];
  source?: "web" | "voice" | "whatsapp" | "admin";
  call_transcript?: string;
  call_recording_url?: string;
}

export class OrderValidationError extends Error {}

// El mismo cliente real llega con el teléfono en formatos distintos según el
// canal: ElevenLabs transcribe lo que dice en voz (con o sin espacios/guiones,
// a veces sin el "52" de México), Meta manda el wa_id de WhatsApp sin "+" y a
// veces con un "1" extra después del "52" (quirk real y documentado de la
// Cloud API para números mexicanos migrados de la app clásica de WhatsApp), y
// el checkout web puede mandar cualquier formato que el cliente haya tecleado.
// Un match exacto (`.eq("phone", phone)`) sin normalizar hacía que el MISMO
// cliente real apareciera como "nuevo" cada vez que el formato variaba
// levemente — perdiendo en silencio su tier VIP, direcciones guardadas e
// historial, y creando un customer_id duplicado en vez de reconocerlo.
// Confirmado en vivo el 3-sep-2026 (auditoría multi-agente): dos filas reales
// de `customers` para la misma persona, cada una con order_count=1.
//
// Normaliza a los últimos 10 dígitos (número nacional significativo
// mexicano) — absorbe "+", espacios, guiones, "52"/"521" de país, y es
// estable sin importar cuál de los formatos reales llegue primero.
export function normalizePhone(phone: string): string {
  const soloDigitos = phone.replace(/\D/g, "");
  return soloDigitos.slice(-10) || soloDigitos;
}

export async function createOrderCore(supabase: any, payload: CreateOrderPayload) {
  if ((!payload.branch_slug && !payload.branch_name) || !payload.customer_name || !payload.customer_phone) {
    throw new OrderValidationError("branch_slug (o branch_name), customer_name y customer_phone son requeridos");
  }
  payload = { ...payload, customer_phone: normalizePhone(payload.customer_phone) };
  if (!payload.items || payload.items.length === 0) {
    throw new OrderValidationError("El pedido no tiene productos");
  }

  const branchQuery = supabase.from("branches").select("id, name, is_active, restaurant_id");
  const { data: branch, error: branchError } = await (
    payload.branch_slug
      ? branchQuery.eq("slug", payload.branch_slug)
      : branchQuery.eq("name", payload.branch_name)
  ).maybeSingle();

  if (branchError) throw branchError;
  if (!branch || !branch.is_active) {
    throw new OrderValidationError(`Sucursal '${payload.branch_slug ?? payload.branch_name}' no encontrada o inactiva`);
  }

  // Precio y disponibilidad REALES de esta sucursal — verificados contra
  // fotos reales del menú de cada una, distintos de verdad entre sucursales
  // (branch_products), no el precio plano de `products` (catálogo maestro
  // de nombres/categorías compartido, ya no la fuente de precio/verdad).
  const productIds = payload.items.map((i) => i.product_id);
  const { data: branchProducts, error: productsError } = await supabase
    .from("branch_products")
    .select("price, is_available, products!inner(id, name)")
    .eq("branch_id", branch.id)
    .in("product_id", productIds);

  if (productsError) throw productsError;

  const orderItems: { id: string; name: string; price: number; quantity: number }[] = [];
  let total = 0;

  for (const item of payload.items) {
    const bp = branchProducts?.find((r: any) => r.products.id === item.product_id);
    if (!bp || !bp.is_available) {
      throw new OrderValidationError(`Producto no disponible: ${item.product_id}`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new OrderValidationError(`Cantidad inválida para ${bp.products.name}`);
    }
    const lineTotal = Number(bp.price) * item.quantity;
    total += lineTotal;
    orderItems.push({
      id: bp.products.id,
      name: bp.products.name,
      price: Number(bp.price),
      quantity: item.quantity,
    });
  }

  // Customer memory: upsert by phone (scoped to this restaurant — the same phone
  // can be a separate customer at a different restaurant) so a returning
  // caller/chatter is recognized next time regardless of channel.
  const customer = await upsertCustomer(supabase, branch.restaurant_id, payload.customer_phone, payload.customer_name, payload.customer_address);

  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
      customer_address: payload.customer_address ?? null,
      customer_id: customer.id,
      restaurant_id: branch.restaurant_id,
      branch: branch.name,
      branch_id: branch.id,
      total,
      status: "pending",
      items: orderItems,
      source: payload.source ?? "web",
      call_transcript: payload.call_transcript ?? null,
      call_recording_url: payload.call_recording_url ?? null,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return order;
}

async function upsertCustomer(supabase: any, restaurantId: string, phone: string, name: string, address?: string) {
  const { data: existing } = await supabase
    .from("customers")
    .select("id, name, order_count")
    .eq("restaurant_id", restaurantId)
    .eq("phone", phone)
    .maybeSingle();

  let customer;
  if (existing) {
    const { data: updated, error } = await supabase
      .from("customers")
      .update({
        name: existing.name ?? name, // never overwrite a known name with a possibly-misheard one
        order_count: existing.order_count + 1,
        last_order_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    customer = updated;
  } else {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ restaurant_id: restaurantId, phone, name, order_count: 1, last_order_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    customer = created;
  }

  if (address) {
    const { data: hasAnyAddress } = await supabase
      .from("customer_addresses")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id);

    await supabase
      .from("customer_addresses")
      .upsert(
        { customer_id: customer.id, address, is_default: !hasAnyAddress },
        { onConflict: "customer_id,address", ignoreDuplicates: true },
      );
  }

  return customer;
}

export type CustomerTier = "BLACK" | "PLATINUM" | "GOLD" | "BLUE";

// Nota lista para inyectar tal cual en un prompt/tool-result: cuando el
// cliente es BLACK o PLATINUM el agente (voz o WhatsApp) debe saberlo y
// tratarlo con calidez extra/prioridad — pedido explícito de Javier, no
// dejar el tier calculado sin usar en el trato real.
export function vipNote(tier: CustomerTier | null): string | null {
  if (tier === "BLACK") {
    return "Es cliente BLACK — uno de los clientes de mayor consumo/frecuencia del restaurante (top 10%). Trátalo con calidez extra y dale prioridad.";
  }
  if (tier === "PLATINUM") {
    return "Es cliente PLATINUM — uno de los clientes más frecuentes/de mayor consumo del restaurante. Trátalo con calidez extra y dale prioridad.";
  }
  return null;
}

// Used by the voice agent's buscar_cliente Server Tool and by the WhatsApp
// webhook to greet a returning customer by name and offer their saved address
// before taking the order, per the requested flow: identify -> confirm/offer
// address -> take order -> recap what's included -> total -> wait time.
//
// Memoria real de cliente frecuente (no solo del último pedido): además del
// último pedido, agrega frequent_items (los productos más pedidos across
// TODO su historial real, contando cantidades reales de orders.items) y
// tier (BLACK/PLATINUM/GOLD/BLUE, mismos cortes de percentil que
// ClientesSection.tsx) calculado server-side vía la función SQL
// calc_customer_tier (ver supabase/migrations/20260903140000_customer_tier_percentile.sql)
// contra la distribución real de TODOS los clientes del restaurante, sin
// traer esa lista completa a este edge function.
export async function lookupCustomer(supabase: any, restaurantId: string, phone: string) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, order_count")
    .eq("restaurant_id", restaurantId)
    .eq("phone", normalizePhone(phone))
    .maybeSingle();

  if (!customer) {
    return { is_new: true as const };
  }

  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("address, label, is_default")
    .eq("customer_id", customer.id)
    .order("is_default", { ascending: false });

  // Todo el historial real de pedidos del cliente (no solo el último) —
  // ordenado desc, así allOrders[0] es también el último pedido y no hace
  // falta una segunda consulta aparte para eso.
  const { data: allOrders } = await supabase
    .from("orders")
    .select("items, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  const lastOrder = allOrders?.[0] ?? null;

  // frequent_items: ocurrencias reales (suma de cantidades) por producto,
  // contadas across TODO el historial real de orders.items de este
  // customer_id — no solo el último pedido. Con un solo pedido, coincide
  // con last_order_items (esperado).
  const conteoPorProducto = new Map<string, { name: string; quantity: number }>();
  for (const order of allOrders ?? []) {
    for (const item of (order.items ?? []) as { id?: string; name: string; quantity: number }[]) {
      const key = item.id ?? item.name;
      const actual = conteoPorProducto.get(key);
      if (actual) actual.quantity += item.quantity;
      else conteoPorProducto.set(key, { name: item.name, quantity: item.quantity });
    }
  }
  const frequent_items = [...conteoPorProducto.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);

  // Tier real por percentil, calculado en SQL (ver calc_customer_tier) —
  // si la función todavía no existe en la base (migración bloqueada por
  // Auto Mode, pendiente de aplicar a mano) o falla por cualquier motivo,
  // cae a tier: null en vez de romper la conversación.
  let tier: CustomerTier | null = null;
  const { data: tierResult, error: tierError } = await supabase.rpc("calc_customer_tier", {
    p_restaurant_id: restaurantId,
    p_customer_id: customer.id,
  });
  if (tierError) {
    console.error("calc_customer_tier: no se pudo calcular, tier=null:", tierError);
  } else {
    tier = (tierResult?.tier ?? null) as CustomerTier | null;
  }

  return {
    is_new: false as const,
    name: customer.name as string | null,
    order_count: customer.order_count as number,
    addresses: (addresses ?? []) as { address: string; label: string | null; is_default: boolean }[],
    last_order_items: (lastOrder?.items ?? null) as { name: string; quantity: number }[] | null,
    frequent_items: frequent_items as { name: string; quantity: number }[],
    tier,
  };
}
