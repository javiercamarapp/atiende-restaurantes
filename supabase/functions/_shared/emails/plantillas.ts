// Todas las plantillas concretas de correo transaccional de atiende.ai,
// construidas sobre el marco de plantilla.ts. Un objeto {asunto, html, texto}
// por evento — lo que consume send-order-notification y, a futuro, cualquier
// otro disparador (bienvenida, etc).
import { renderCorreo, moneda } from "./plantilla.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://atiende-restaurantes.vercel.app";

export interface PedidoCorreo {
  id: string;
  restauranteNombre: string;
  sucursalNombre: string;
  clienteNombre: string;
  clienteTelefono: string;
  direccion: string | null;
  total: number;
  fuente: "web" | "whatsapp" | "voz" | string;
  itemsTexto: string; // "2x Taco al pastor, 1x Agua de horchata"
}

interface Correo {
  asunto: string;
  html: string;
  texto: string;
}

function fuenteLegible(f: string): string {
  if (f === "whatsapp") return "WhatsApp";
  if (f === "voz") return "llamada telefónica";
  return "el sitio web";
}

const tablaPedido = (p: PedidoCorreo) => ({
  filas: [
    { etiqueta: "Cliente", valor: p.clienteNombre },
    { etiqueta: "Teléfono", valor: p.clienteTelefono },
    ...(p.direccion ? [{ etiqueta: "Dirección", valor: p.direccion }] : []),
    { etiqueta: "Sucursal", valor: p.sucursalNombre },
    { etiqueta: "Total", valor: moneda(p.total) },
  ],
});

export function correoPedidoNuevo(p: PedidoCorreo): Correo {
  const html = renderCorreo({
    titulo: "Nuevo pedido por atender",
    preheader: `${p.clienteNombre} pidió por ${fuenteLegible(p.fuente)} — ${moneda(p.total)}`,
    etiqueta: { texto: "Pedido nuevo", color: "#1D4ED8" },
    parrafosHtml: [
      `El agente de ${escapeHtml(fuenteLegible(p.fuente))} acaba de tomar un pedido nuevo para <strong>${escapeHtml(p.sucursalNombre)}</strong>.`,
      `<strong>${escapeHtml(p.itemsTexto)}</strong>`,
    ],
    tabla: tablaPedido(p),
    cta: { texto: "Ver pedido en el panel", url: `${APP_URL}/admin` },
    piePorQueLlego: "Recibes este correo porque activaste las notificaciones de pedido nuevo en tu cuenta de atiende.ai.",
  });
  return {
    asunto: `Pedido nuevo · ${p.sucursalNombre} · ${moneda(p.total)}`,
    html,
    texto: `Nuevo pedido de ${p.clienteNombre} (${p.clienteTelefono}) por ${fuenteLegible(p.fuente)} en ${p.sucursalNombre}: ${p.itemsTexto}. Total: ${moneda(p.total)}. Ver en ${APP_URL}/admin`,
  };
}

export function correoPedidoPreparando(p: PedidoCorreo): Correo {
  const html = renderCorreo({
    titulo: "Pedido en preparación",
    preheader: `${p.sucursalNombre} ya está preparando el pedido de ${p.clienteNombre}`,
    etiqueta: { texto: "En preparación", color: "#b45309" },
    parrafosHtml: [`Se confirmó el pedido de <strong>${escapeHtml(p.clienteNombre)}</strong> y ya está en preparación.`],
    tabla: tablaPedido(p),
    cta: { texto: "Ver pedido en el panel", url: `${APP_URL}/admin` },
    piePorQueLlego: "Recibes este correo porque activaste las notificaciones de pedidos en tu cuenta de atiende.ai.",
  });
  return {
    asunto: `En preparación · ${p.sucursalNombre} · ${p.clienteNombre}`,
    html,
    texto: `El pedido de ${p.clienteNombre} en ${p.sucursalNombre} está en preparación. Total: ${moneda(p.total)}.`,
  };
}

export function correoPedidoEnCamino(p: PedidoCorreo): Correo {
  const html = renderCorreo({
    titulo: "Pedido en camino",
    preheader: `El pedido de ${p.clienteNombre} salió a entrega`,
    etiqueta: { texto: "En camino", color: "#0ea5e9" },
    parrafosHtml: [`El pedido de <strong>${escapeHtml(p.clienteNombre)}</strong> salió de <strong>${escapeHtml(p.sucursalNombre)}</strong> rumbo a su dirección.`],
    tabla: tablaPedido(p),
    cta: { texto: "Ver pedido en el panel", url: `${APP_URL}/admin` },
    piePorQueLlego: "Recibes este correo porque activaste las notificaciones de pedidos en tu cuenta de atiende.ai.",
  });
  return {
    asunto: `En camino · ${p.sucursalNombre} · ${p.clienteNombre}`,
    html,
    texto: `El pedido de ${p.clienteNombre} salió a entrega desde ${p.sucursalNombre}.`,
  };
}

export function correoPedidoEntregado(p: PedidoCorreo): Correo {
  const html = renderCorreo({
    titulo: "Pedido entregado",
    preheader: `Se entregó el pedido de ${p.clienteNombre} · ${moneda(p.total)}`,
    etiqueta: { texto: "Entregado", color: "#16a34a" },
    parrafosHtml: [`Se marcó como entregado el pedido de <strong>${escapeHtml(p.clienteNombre)}</strong> desde <strong>${escapeHtml(p.sucursalNombre)}</strong>.`],
    tabla: tablaPedido(p),
    cta: { texto: "Ver historial en el panel", url: `${APP_URL}/admin` },
    piePorQueLlego: "Recibes este correo porque activaste las notificaciones de pedidos entregados en tu cuenta de atiende.ai.",
  });
  return {
    asunto: `Entregado · ${p.sucursalNombre} · ${moneda(p.total)}`,
    html,
    texto: `Se entregó el pedido de ${p.clienteNombre} (${moneda(p.total)}) desde ${p.sucursalNombre}.`,
  };
}

export function correoPedidoCancelado(p: PedidoCorreo, motivo?: string): Correo {
  const html = renderCorreo({
    titulo: "Pedido cancelado",
    preheader: `Se canceló el pedido de ${p.clienteNombre}`,
    etiqueta: { texto: "Cancelado", color: "#dc2626" },
    parrafosHtml: [
      `Se canceló el pedido de <strong>${escapeHtml(p.clienteNombre)}</strong> en <strong>${escapeHtml(p.sucursalNombre)}</strong>.`,
      ...(motivo ? [`Motivo: ${escapeHtml(motivo)}`] : []),
    ],
    tabla: tablaPedido(p),
    cta: { texto: "Ver pedido en el panel", url: `${APP_URL}/admin` },
    piePorQueLlego: "Recibes este correo porque activaste las notificaciones de pedidos cancelados en tu cuenta de atiende.ai.",
  });
  return {
    asunto: `Cancelado · ${p.sucursalNombre} · ${p.clienteNombre}`,
    html,
    texto: `Se canceló el pedido de ${p.clienteNombre} en ${p.sucursalNombre}.${motivo ? ` Motivo: ${motivo}` : ""}`,
  };
}

export function correoBienvenida(nombreRestaurante: string, rol: string): Correo {
  const html = renderCorreo({
    titulo: `Ya tienes acceso a ${nombreRestaurante}`,
    preheader: `Te dieron de alta en el panel de atiende.ai como ${rol}`,
    etiqueta: { texto: "Cuenta nueva", color: "#1D4ED8" },
    parrafosHtml: [
      `Te dieron de alta en el panel de operación de <strong>${escapeHtml(nombreRestaurante)}</strong> en atiende.ai, con el rol de <strong>${escapeHtml(rol)}</strong>.`,
      `No necesitas contraseña: entra con tu correo y te llega un enlace de acceso de un solo uso, o con tu cuenta de Google.`,
    ],
    cta: { texto: "Entrar a atiende.ai", url: `${APP_URL}/admin/login` },
    piePorQueLlego: "Recibes este correo porque alguien de tu restaurante te dio de alta en atiende.ai con esta dirección.",
  });
  return {
    asunto: `Ya tienes acceso a ${nombreRestaurante} en atiende.ai`,
    html,
    texto: `Te dieron de alta en ${nombreRestaurante} en atiende.ai como ${rol}. Entra en ${APP_URL}/admin/login con tu correo (enlace de un solo uso, sin contraseña).`,
  };
}

function escapeHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
