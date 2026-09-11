// src/lib/routePermissions.ts (patrón 6) es TypeScript puro sin ninguna
// dependencia de React ni de Supabase, así que se puede testear aquí, con
// el mismo runner Deno que ya corre en CI vía "test:edge" en package.json.
// No vive junto a un routePermissions.test.ts dentro de src/ a propósito:
// tsconfig.app.json declara "include": ["src"] con lib DOM/ES2020 (sin el
// namespace Deno) para que Vite/tsc compilen el panel — cualquier
// *.test.ts colocado ahí rompería `npm run typecheck` (tsc no conoce
// `Deno.test` ni la lib "deno.ns"). Puesto aquí, se cubre con el mismo
// glob *.test.ts de _shared/ sin agregar ningún script nuevo ni tocar la
// configuración de TypeScript del frontend.
import {
  findRoutePermission,
  isRouteAllowed,
  ROUTE_PERMISSIONS,
} from "../../../src/lib/routePermissions.ts";

Deno.test("route permissions: every protected route from App.tsx is covered by the map", () => {
  const expectedPaths = [
    "/admin",
    "/admin/superadmin",
    "/admin/repartidor/:userId",
    "/repartidor",
  ];
  for (const path of expectedPaths) {
    if (!ROUTE_PERMISSIONS.some((entry) => entry.path === path)) {
      throw new Error(`${path} is not declared in ROUTE_PERMISSIONS`);
    }
  }
});

Deno.test("findRoutePermission matches a dynamic :userId segment", () => {
  const permission = findRoutePermission("/admin/repartidor/abc-123");
  if (!permission || permission.path !== "/admin/repartidor/:userId") {
    throw new Error(
      `expected a match on the dynamic repartidor route, got: ${
        JSON.stringify(permission)
      }`,
    );
  }
});

Deno.test("findRoutePermission does not match an unrelated path", () => {
  if (findRoutePermission("/terminos") !== null) {
    throw new Error("an unrelated public route matched a protected rule");
  }
});

Deno.test("findRoutePermission requires an exact segment count (no partial prefix match)", () => {
  if (findRoutePermission("/admin/repartidor") !== null) {
    throw new Error(
      "a path missing the required :userId segment should not match",
    );
  }
  if (findRoutePermission("/admin/repartidor/abc/extra") !== null) {
    throw new Error("a path with an extra trailing segment should not match");
  }
});

Deno.test("isRouteAllowed: superadmin route requires the superadmin role", () => {
  if (
    isRouteAllowed("/admin/superadmin", {
      roles: [],
      hasTenantMembership: true,
    })
  ) {
    throw new Error("tenant staff without superadmin reached the superadmin route");
  }
  if (
    !isRouteAllowed("/admin/superadmin", {
      roles: ["superadmin"],
      hasTenantMembership: false,
    })
  ) {
    throw new Error("a real superadmin was denied the superadmin route");
  }
});

Deno.test("isRouteAllowed: /admin requires tenant staff membership or superadmin", () => {
  if (isRouteAllowed("/admin", { roles: [], hasTenantMembership: false })) {
    throw new Error("a signed-in user with no membership at all reached /admin");
  }
  if (!isRouteAllowed("/admin", { roles: [], hasTenantMembership: true })) {
    throw new Error("real restaurant staff were denied /admin");
  }
  if (
    !isRouteAllowed("/admin", { roles: ["superadmin"], hasTenantMembership: false })
  ) {
    throw new Error("a superadmin viewing an account was denied /admin");
  }
});

Deno.test("isRouteAllowed: /repartidor requires the repartidor role specifically", () => {
  if (
    isRouteAllowed("/repartidor", { roles: [], hasTenantMembership: true })
  ) {
    throw new Error(
      "tenant staff without the repartidor role reached the courier dashboard",
    );
  }
  if (
    !isRouteAllowed("/repartidor", {
      roles: ["repartidor"],
      hasTenantMembership: false,
    })
  ) {
    throw new Error("a real repartidor was denied /repartidor");
  }
});

Deno.test("isRouteAllowed: an undeclared route is never blocked by this guard", () => {
  if (
    !isRouteAllowed("/terminos", { roles: [], hasTenantMembership: false })
  ) {
    throw new Error("a public, undeclared route was incorrectly blocked");
  }
});
