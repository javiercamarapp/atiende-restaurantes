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

export async function createOrderCore(supabase: any, payload: CreateOrderPayload) {
  if ((!payload.branch_slug && !payload.branch_name) || !payload.customer_name || !payload.customer_phone) {
    throw new OrderValidationError("branch_slug (o branch_name), customer_name y customer_phone son requeridos");
  }
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

  const productIds = payload.items.map((i) => i.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, is_available")
    .in("id", productIds);

  if (productsError) throw productsError;

  const orderItems: { id: string; name: string; price: number; quantity: number }[] = [];
  let total = 0;

  for (const item of payload.items) {
    const product = products?.find((p: any) => p.id === item.product_id);
    if (!product || !product.is_available) {
      throw new OrderValidationError(`Producto no disponible: ${item.product_id}`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new OrderValidationError(`Cantidad inválida para ${product.name}`);
    }
    const lineTotal = Number(product.price) * item.quantity;
    total += lineTotal;
    orderItems.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
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

// Used by the voice agent's buscar_cliente Server Tool and by the WhatsApp
// webhook to greet a returning customer by name and offer their saved address
// before taking the order, per the requested flow: identify -> confirm/offer
// address -> take order -> recap what's included -> total -> wait time.
export async function lookupCustomer(supabase: any, restaurantId: string, phone: string) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, order_count")
    .eq("restaurant_id", restaurantId)
    .eq("phone", phone)
    .maybeSingle();

  if (!customer) {
    return { is_new: true as const };
  }

  const { data: addresses } = await supabase
    .from("customer_addresses")
    .select("address, label, is_default")
    .eq("customer_id", customer.id)
    .order("is_default", { ascending: false });

  const { data: lastOrder } = await supabase
    .from("orders")
    .select("items, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    is_new: false as const,
    name: customer.name as string | null,
    order_count: customer.order_count as number,
    addresses: (addresses ?? []) as { address: string; label: string | null; is_default: boolean }[],
    last_order_items: (lastOrder?.items ?? null) as { name: string; quantity: number }[] | null,
  };
}
