import { LegalPage, FaltaDato, type SeccionLegal } from "./legal/LegalPage";

const PRESTADOR = {
  razonSocial: null as string | null,
  domicilio: null as string | null,
  jurisdiccion: null as string | null,
  contacto: null as string | null,
};

const SECCIONES: SeccionLegal[] = [
  {
    titulo: "1. Qué es atiende.ai",
    parrafos: [
      "atiende.ai es un servicio que opera agentes de inteligencia artificial por voz y WhatsApp para restaurantes: contestan llamadas y mensajes de los clientes de un restaurante, toman su pedido y lo registran en el panel de operación del restaurante para que el equipo lo prepare y lo entregue.",
      "atiende.ai **no** cocina, empaca ni entrega pedidos, **no** procesa pagos ni cobra a los clientes finales, y **no** sustituye al personal del restaurante — automatiza la toma del pedido y la entrega la información al equipo humano que sí lo prepara y lo lleva.",
    ],
  },
  {
    titulo: "2. A quién le aplican estos términos",
    parrafos: [
      "Estos Términos rigen la relación entre atiende.ai y el **restaurante** que contrata el servicio (\"el Cliente\") y a las personas que ese restaurante da de alta como usuarias del panel (dueños, encargados, repartidores).",
      "Las personas que llaman o escriben por WhatsApp para pedir comida son clientes del restaurante, no clientes de atiende.ai; su relación contractual (precio, tiempos de entrega, cancelaciones, reclamos sobre el pedido) es con el restaurante. atiende.ai únicamente provee la tecnología que toma y registra ese pedido.",
    ],
  },
  {
    titulo: "3. Cuentas y acceso",
    parrafos: [
      "El acceso al panel es por invitación: el restaurante da de alta a su personal con su correo, y el ingreso se hace con un enlace mágico enviado a ese correo (sin contraseña) o con una cuenta de Google. Cada persona es responsable de mantener el acceso a su propio correo seguro.",
      "El restaurante es responsable de dar de baja a las personas que dejen de trabajar ahí y de que solo tengan acceso quienes deban tenerlo.",
    ],
  },
  {
    titulo: "4. Cómo decide el agente de IA",
    parrafos: [
      "El agente conversa con el cliente para reunir nombre, teléfono, dirección y los productos que quiere pedir, apoyándose en el catálogo real del restaurante (menú y precios) cargado en el sistema.",
      "**El precio final de cada pedido nunca lo calcula ni lo inventa el modelo de lenguaje**: cada vez que se registra un pedido, el sistema vuelve a calcular el total desde el catálogo de precios guardado en la base de datos del restaurante, sin importar lo que haya dicho la conversación. Esto evita que un error o una alucinación del modelo se traduzca en un cobro incorrecto.",
      "Aun así, es una conversación conducida por un modelo de lenguaje y puede cometer errores de interpretación (por ejemplo, entender mal un producto o una dirección). El restaurante debe revisar los pedidos entrantes, especialmente al principio, y puede corregir o cancelar cualquier pedido desde su panel.",
    ],
  },
  {
    titulo: "5. Uso aceptable",
    parrafos: [
      "El Cliente se compromete a usar el servicio solo para tomar y gestionar pedidos legítimos de su propio restaurante, a no intentar acceder a datos de otros restaurantes dados de alta en la plataforma, y a no usar el servicio para enviar spam, contenido engañoso o mensajes no solicitados a través de los canales de voz o WhatsApp conectados.",
      "atiende.ai puede suspender una cuenta que incumpla esto, o que ponga en riesgo la operación o la seguridad de la plataforma para otros restaurantes.",
    ],
  },
  {
    titulo: "6. Suscripción y pagos",
    parrafos: [
      "El acceso al servicio está sujeto a un plan de suscripción cuyas condiciones comerciales (precio, periodicidad, medios de pago) se acuerdan directamente con el equipo de atiende.ai al momento de contratar.",
    ],
  },
  {
    titulo: "7. Servicios de terceros que hacen posible el servicio",
    parrafos: [
      "Para operar, atiende.ai se apoya en proveedores externos: telefonía y mensajería de WhatsApp (Twilio), voz conversacional (ElevenLabs), enrutamiento de modelos de lenguaje (OpenRouter), proveedores de modelos como OpenAI y Google, la base de datos y autenticación (Supabase) y el hosting del panel (Vercel).",
      "La disponibilidad del servicio depende, en parte, de la disponibilidad de estos proveedores. Una caída de alguno de ellos puede interrumpir temporalmente la toma de pedidos por voz o WhatsApp.",
    ],
  },
  {
    titulo: "8. Disponibilidad y soporte",
    parrafos: [
      "atiende.ai procura que el servicio esté disponible de forma continua, pero no garantiza un porcentaje de disponibilidad (uptime) determinado ni la ausencia total de errores, dado que el servicio depende de terceros y de la conectividad del propio restaurante.",
    ],
  },
  {
    titulo: "9. Propiedad de los datos del restaurante",
    parrafos: [
      "El menú, los precios, las sucursales, los pedidos y los datos de los clientes del restaurante son propiedad del restaurante. atiende.ai los trata únicamente para prestar el servicio (ver el Aviso de Privacidad) y no los vende ni los comparte con otros restaurantes de la plataforma.",
    ],
  },
  {
    titulo: "10. Propiedad intelectual de atiende.ai",
    parrafos: [
      "El software, la marca, el diseño del panel y los agentes conversacionales de atiende.ai son propiedad de atiende.ai. Contratar el servicio no transfiere ningún derecho de propiedad intelectual sobre ellos al Cliente.",
    ],
  },
  {
    titulo: "11. Límite de responsabilidad",
    parrafos: [
      "atiende.ai no es responsable por pérdidas derivadas de la operación propia del restaurante (preparación, entrega, calidad de los alimentos, cobro al cliente final) ni por interrupciones causadas por proveedores externos fuera de su control razonable.",
      "En la medida permitida por la ley, la responsabilidad de atiende.ai frente al Cliente por daños directos comprobables derivados del servicio se limita al monto efectivamente pagado por el Cliente en los tres meses previos al hecho que dio origen al reclamo.",
    ],
  },
  {
    titulo: "12. Vigencia y terminación",
    parrafos: [
      "Estos Términos aplican mientras el restaurante tenga una cuenta activa. Cualquiera de las partes puede terminar la relación con aviso razonable; atiende.ai puede suspender de inmediato una cuenta por incumplimiento grave de la sección 5.",
      "Al terminar, el restaurante puede solicitar la exportación o el borrado de sus datos conforme al Aviso de Privacidad.",
    ],
  },
  {
    titulo: "13. Cambios a estos términos",
    parrafos: [
      "atiende.ai puede actualizar estos Términos para reflejar cambios en el servicio o en la ley aplicable. Los cambios relevantes se avisarán al restaurante por correo o dentro del panel antes de entrar en vigor.",
    ],
  },
  {
    titulo: "14. Ley aplicable",
    fundamento: PRESTADOR.jurisdiccion ?? undefined,
    parrafos: [
      "Estos Términos se rigen por las leyes de México, sin perjuicio de las disposiciones locales que resulten aplicables.",
    ],
  },
  {
    titulo: "15. Contacto",
    parrafos: [
      PRESTADOR.contacto
        ? `Dudas sobre estos Términos: ${PRESTADOR.contacto}.`
        : "Dudas sobre estos Términos: contacta directamente al equipo de atiende.ai por el canal por el que te dieron de alta.",
    ],
  },
];

const Terminos = () => (
  <LegalPage
    etiqueta="Legal"
    bajada="Términos de Servicio para restaurantes que usan atiende.ai"
    vigenteDesde="2 de septiembre de 2026"
    secciones={SECCIONES}
    aviso={
      !PRESTADOR.razonSocial && (
        <FaltaDato>
          🔴 Falta capturar aquí la razón social, el domicilio fiscal y la jurisdicción exactos de la
          entidad que opera atiende.ai. Este documento no inventa esos datos — se completan cuando
          existan.
        </FaltaDato>
      )
    }
    pie={<p>© 2026 atiende.ai. Todos los derechos reservados.</p>}
  />
);

export default Terminos;
