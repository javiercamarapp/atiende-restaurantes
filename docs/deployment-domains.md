# Dominios de producción

Configuración verificada el 4 de septiembre de 2026:

- Agencia (pendiente): `https://useatiende.ai`.
- Landing de restaurantes (pendiente): `https://useatiende.ai/restaurantes`.
- Software: `https://app.useatiende.ai/restaurantes`, en el proyecto Vercel `atiende-restaurantes`.
- Cada solución usará `useatiende.ai/<solucion>` para su landing y `app.useatiende.ai/<solucion>` para su aplicación. El dominio de la agencia y `www` siguen fuera del proyecto del software, pendientes de publicar el sitio comercial.

GoDaddy publica el CNAME `app` hacia `33480974c025a059.vercel-dns-016.com` y el TXT de verificación de Vercel. Google DNS y Cloudflare DNS resolvieron el subdominio; algunos resolvers pueden conservar la respuesta negativa anterior hasta vencer su caché.

Supabase Auth usa `https://app.useatiende.ai/restaurantes` como Site URL. El único retorno autorizado de Google/enlaces de correo es `https://app.useatiende.ai/restaurantes/admin/login`. La allowlist CORS usa el origen `https://app.useatiende.ai`, sin ruta.

Las direcciones técnicas `*.vercel.app` del despliegue actual redirigen permanentemente al dominio oficial, conservando la ruta y los parámetros. No son enlaces públicos alternativos ni de contingencia. Los despliegues históricos inmutables de Vercel se conservan para recuperación; no se eliminan como parte de la limpieza de enlaces.

Vite y React Router comparten la base `/restaurantes/`; Vercel sirve allí los archivos y las rutas de la SPA. Los enlaces antiguos `/admin`, `/admin/*`, `/repartidor`, `/terminos` y `/privacidad` redirigen a sus equivalentes bajo `/restaurantes`, conservando parámetros. La raíz de `app` redirige temporalmente a restaurantes hasta que exista un selector de soluciones.

Verificación: TLS válido y HTTP 200; preflight de `agent-config` con HTTP 204 y el origen correcto; nueve pruebas de seguridad HTTP aprobadas; panel autenticado y centro de notificaciones sin errores JavaScript en Chromium. Para esta prueba de navegador se usó una IP publicada por DNS público mediante una regla de resolución exclusiva del proceso, debido al caché DNS negativo local; no se desactivó la validación TLS.
