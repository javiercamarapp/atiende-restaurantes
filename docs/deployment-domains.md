# Dominios de producción

Configuración verificada el 4 de septiembre de 2026:

- Software: `https://app.useatiende.ai`, agregado y verificado en el proyecto Vercel `atiende-restaurantes`.
- Contingencia: `https://atiende-restaurantes.vercel.app`.
- Landing pendiente: `useatiende.ai` y `www.useatiende.ai`, retirados del proyecto del software; todavía no sirven una landing.

GoDaddy publica el CNAME `app` hacia `33480974c025a059.vercel-dns-016.com` y el TXT de verificación de Vercel. Google DNS y Cloudflare DNS resolvieron el subdominio; algunos resolvers pueden conservar la respuesta negativa anterior hasta vencer su caché.

Supabase Auth usa `https://app.useatiende.ai` como Site URL. Las redirecciones permitidas son `https://app.useatiende.ai/admin/login` y la URL de contingencia preexistente `https://atiende-restaurantes.vercel.app/**`. La allowlist CORS del backend incluye exactamente el nuevo origen HTTPS.

Verificación: TLS válido y HTTP 200; preflight de `agent-config` con HTTP 204 y el origen correcto; nueve pruebas de seguridad HTTP aprobadas; panel autenticado y centro de notificaciones sin errores JavaScript en Chromium. Para esta prueba de navegador se usó una IP publicada por DNS público mediante una regla de resolución exclusiva del proceso, debido al caché DNS negativo local; no se desactivó la validación TLS.
