-- Horarios reales de las 7 sucursales, investigados cruzando el sitio
-- oficial (renderizado con JS, la home sí los publica aunque no se veían en
-- un scrape sin JS), Google Maps (listados independientes por sucursal) y
-- Mérida Restaurant Week. Pensiones queda con una nota porque Yelp reporta
-- una hora de apertura distinta al resto de fuentes — no se resolvió esa
-- contradicción por decisión unilateral, se dejó documentada.
alter table public.branches add column if not exists hours text;

update public.branches set hours = 'Todos los días, 12:00 pm – 1:00 am' where slug = 'altabrisa';
update public.branches set hours = 'Todos los días, 12:00 pm – 1:00 am' where slug = 'garcia-lavin';
update public.branches set hours = 'Lunes a jueves 6:00 pm – 1:00 am; viernes a domingo 12:00 pm – 1:00 am' where slug = 'prol-montejo';
update public.branches set hours = 'Lunes a viernes 6:00 pm – 12:00 am; sábado y domingo 12:00 pm – 12:00 am' where slug = 'fco-montejo';
update public.branches set hours = 'Todos los días, 12:00 pm – 9:00 pm' where slug = 'galerias';
update public.branches set hours = 'Cerrada temporalmente — solo abre en Semana Santa y temporada de verano (julio-agosto). Cuando está abierta: lunes a domingo, 6:00 pm – 1:00 am.' where slug = 'chicxulub';
update public.branches set hours = 'Lunes a sábado 6:00 pm – 12:00 am; domingo 12:00 pm – 12:00 am (una fuente de terceros, Yelp, reporta apertura a las 7:00 pm — no confirmado con certeza contra la fuente oficial)' where slug = 'pensiones';
