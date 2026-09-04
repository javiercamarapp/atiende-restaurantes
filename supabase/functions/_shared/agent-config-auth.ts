export type AgentConfigAuth = {
  status: number;
  error?: string;
  userId?: string;
  isSuperadmin?: boolean;
  ownedAgentIds?: Set<string>;
};

const AGENT_ACTIONS = new Set([
  "add_tool",
  "set_tools",
  "set_knowledge_base",
  "sync_knowledge_base",
  "set_languages",
  "get_raw",
  "get",
  "signed_url",
  "mark_preview_conversation",
  "update",
]);
const CONVERSATION_ACTIONS = new Set([
  "list_conversations",
  "get_conversation",
]);

export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

/** Authenticates first, then applies restaurant/agent ownership to an action. */
export async function authorizeAgentConfig(
  supabase: any,
  header: string | null,
  body: Record<string, unknown>,
  restaurantId: string,
): Promise<AgentConfigAuth> {
  const token = bearerToken(header);
  if (!token) return { status: 401, error: "No autenticado" };

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    token,
  );
  if (authError || !user) return { status: 401, error: "No autenticado" };

  const [
    { data: roles, error: rolesError },
    { data: staff, error: staffError },
    { data: branches, error: branchesError },
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("restaurant_staff").select("role").eq("user_id", user.id).eq(
      "restaurant_id",
      restaurantId,
    ),
    supabase.from("branches").select("elevenlabs_agent_id").eq(
      "restaurant_id",
      restaurantId,
    ).not("elevenlabs_agent_id", "is", null),
  ]);
  if (rolesError || staffError || branchesError) {
    return { status: 500, error: "No se pudo validar permisos" };
  }

  const isSuperadmin = (roles ?? []).some((r: { role: string }) =>
    r.role === "superadmin"
  );
  // Couriers can read their assigned orders through dedicated policies/RPCs,
  // but they must never mutate prompts, tools, voices or provider resources.
  const isStaff = (staff ?? []).some((membership: { role?: string }) =>
    membership.role === "owner" || membership.role === "admin" ||
    membership.role === "staff"
  );
  if (!isSuperadmin && !isStaff) return { status: 403, error: "Sin permisos" };

  const action = typeof body.action === "string" ? body.action : "";
  const ownedAgentIds = new Set<string>(
    (branches ?? [])
      .map((b: { elevenlabs_agent_id?: string | null }) =>
        b.elevenlabs_agent_id
      )
      .filter((id: string | null | undefined): id is string => Boolean(id)),
  );

  if (
    CONVERSATION_ACTIONS.has(action) && action === "list_conversations" &&
    typeof body.agent_id !== "string"
  ) {
    return { status: 400, error: "agent_id requerido" };
  }
  if (
    (AGENT_ACTIONS.has(action) || CONVERSATION_ACTIONS.has(action)) &&
    typeof body.agent_id !== "string"
  ) {
    return { status: 400, error: "agent_id requerido" };
  }
  if (
    (AGENT_ACTIONS.has(action) || CONVERSATION_ACTIONS.has(action)) &&
    !isSuperadmin && !ownedAgentIds.has(body.agent_id as string)
  ) {
    return { status: 403, error: "Sin permisos" };
  }

  return { status: 200, userId: user.id, isSuperadmin, ownedAgentIds };
}
