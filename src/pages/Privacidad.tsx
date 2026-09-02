import { LegalPage, FaltaDato, type SeccionLegal } from "./legal/LegalPage";

const RESPONSABLE = {
  razonSocial: null as string | null,
  domicilio: null as string | null,
  contacto: null as string | null,
};

const SECCIONES: SeccionLegal[] = [
  {
    titulo: "1. Quién es responsable de tus datos",
    parrafos: [
      "Este aviso aplica a dos grupos de personas distintos, con responsables distintos:",
      "**Personal del restaurante** (dueños, encargados, repartidores con acceso al panel): sus datos de cuenta (correo, nombre, rol) son tratados por **atiende.ai** como responsable, para operar el panel.",
      "**Clientes del restaurante** (quienes llaman o escriben por WhatsApp para pedir): sus datos (nombre, teléfono, dirección de entrega, pedido) pertenecen a la relación comercial entre esa persona y el **restaurante**. El restaurante es el responsable de esos datos frente a la ley; atiende.ai los trata **por cuenta del restaurante**, como encargado, únicamente para prestar el servicio de toma de pedidos.",
    ],
  },
  {
    titulo: "2. Qué datos se recaban",
    parrafos: [
      "De quien llama o escribe para pedir: nombre, número de teléfono, dirección de entrega, y el contenido del pedido.",
      "De la llamada de voz: la **transcripción** de la conversación con el agente y, cuando el proveedor de voz la genera, la **grabación de audio** de la llamada — se conservan para poder auditar o corregir un pedido si algo salió mal en el reconocimiento.",
      "De la conversación por WhatsApp: el **historial completo de mensajes** intercambiados con el agente, para que pueda dar seguimiento a un pedido en curso y el restaurante pueda revisarlo si hay una duda.",
      "Del personal del restaurante: correo electrónico, nombre, teléfono (opcional) y el rol que tiene dentro del panel.",
    ],
  },
  {
    titulo: "3. Para qué se usan",
    parrafos: [
      "Para tomar, registrar y dar seguimiento al pedido; para que el agente reconozca a un cliente que ya pidió antes y no tenga que repetir su dirección cada vez; para que el restaurante pueda auditar una llamada o conversación si hay un reclamo sobre el pedido; y para operar y dar soporte al panel del restaurante.",
      "No se usan para fines publicitarios propios de atiende.ai ni se venden a terceros.",
    ],
  },
  {
    titulo: "4. Con quién se comparten",
    parrafos: [
      "Con los proveedores que hacen posible el servicio, únicamente en la medida necesaria para operarlo: **Twilio** (telefonía y WhatsApp), **ElevenLabs** (voz del agente), **Anthropic** (el modelo de lenguaje que conduce la conversación de WhatsApp), **Supabase** (base de datos y autenticación) y **Vercel** (hosting del panel).",
      "No se comparten los datos de los clientes de un restaurante con otro restaurante distinto dado de alta en la plataforma — cada restaurante solo ve sus propios pedidos y clientes.",
    ],
  },
  {
    titulo: "5. Cuánto tiempo se conservan",
    parrafos: [
      "Los datos de pedidos, clientes y conversaciones se conservan mientras el restaurante mantenga una cuenta activa, para que el historial de pedidos siga siendo útil. Si el restaurante da de baja su cuenta o solicita el borrado, se eliminan conforme a la sección 7.",
    ],
  },
  {
    titulo: "6. Derechos ARCO",
    parrafos: [
      "De acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, toda persona tiene derecho a Acceder, Rectificar, Cancelar u Oponerse (ARCO) al tratamiento de sus datos personales.",
      "Si eres cliente de un restaurante que usa atiende.ai, tu primer punto de contacto para ejercer estos derechos es el propio restaurante, por ser el responsable de tus datos. Si eres personal del restaurante con cuenta en el panel, puedes ejercerlos directamente con atiende.ai.",
    ],
  },
  {
    titulo: "7. Borrado de cuenta y de datos",
    parrafos: [
      "El personal del restaurante puede solicitar el borrado de su cuenta de acceso al panel en cualquier momento. Un restaurante puede solicitar la eliminación de su información y la de sus clientes al terminar su relación con atiende.ai, salvo la que deba conservarse por obligación legal.",
    ],
  },
  {
    titulo: "8. Cambios a este aviso",
    parrafos: [
      "Este aviso puede actualizarse para reflejar cambios en el servicio, en los proveedores utilizados o en la ley aplicable. Los cambios relevantes se avisarán por correo o dentro del panel antes de entrar en vigor.",
    ],
  },
  {
    titulo: "9. Contacto",
    parrafos: [
      RESPONSABLE.contacto
        ? `Para ejercer tus derechos o resolver dudas sobre este aviso: ${RESPONSABLE.contacto}.`
        : "Para ejercer tus derechos o resolver dudas sobre este aviso, contacta directamente al equipo de atiende.ai por el canal por el que te dieron de alta.",
    ],
  },
];

const Privacidad = () => (
  <LegalPage
    etiqueta="Legal"
    bajada="Aviso de Privacidad de atiende.ai"
    vigenteDesde="2 de septiembre de 2026"
    secciones={SECCIONES}
    aviso={
      !RESPONSABLE.razonSocial && (
        <FaltaDato>
          🔴 Falta capturar aquí la razón social y el domicilio exactos de la entidad responsable
          (atiende.ai) para efectos del aviso de privacidad. Este documento no inventa esos datos —
          se completan cuando existan.
        </FaltaDato>
      )
    }
    pie={<p>© 2026 atiende.ai. Todos los derechos reservados.</p>}
  />
);

export default Privacidad;
