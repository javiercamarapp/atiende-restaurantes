// Placeholder honesto — el texto legal real todavía no se ha redactado.
// No se fabrica contenido legal falso solo para llenar la página.
const Terminos = () => (
  <main className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="max-w-md text-center">
      <h1 className="font-display text-xl font-semibold text-foreground mb-3">Términos de Servicio</h1>
      <p className="text-sm text-muted-foreground">
        Todavía no están publicados. Si necesitas los términos ahora, escribe directamente al equipo de atiende.ai.
      </p>
      <a href="/admin/login" className="inline-block mt-6 text-sm text-primary underline underline-offset-2">
        Volver al login
      </a>
    </div>
  </main>
);

export default Terminos;
