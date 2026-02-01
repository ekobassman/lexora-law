import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Shield, FileText, Clock, Download, Lock, Globe, Database, Scale, Building, Users, Server, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIVACY_VERSION, getLastUpdatedLabel } from '@/lib/legalVersions';
import { LocalizedPrivacyBanner } from '@/components/LocalizedPrivacyBanner';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Spanish localized Privacy Policy
 * Translation of the master English version
 */
export default function PrivacyES() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-navy">
      <Helmet>
        <title>Política de Privacidad | Lexora</title>
        <meta name="description" content="Política de Privacidad de Lexora - Descubre cómo protegemos tus datos. Conforme al RGPD." />
        <link rel="canonical" href="https://lexora-law.com/privacy" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <header className="border-b border-gold/20">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              <span className="relative font-display text-sm font-semibold text-gold">L</span>
            </div>
            <span className="font-display text-lg font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </Link>
          <Button variant="ghost" size="sm" asChild className="text-ivory/70 hover:text-gold hover:bg-transparent">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />{t('common.back')}</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl py-12 px-4">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <Shield className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-medium text-ivory">Política de Privacidad</h1>
            <p className="text-sm text-ivory/50 mt-1">{getLastUpdatedLabel(PRIVACY_VERSION, 'es')}</p>
            <p className="text-xs text-ivory/30 mt-0.5">Versión: {PRIVACY_VERSION}</p>
          </div>
        </div>

        {/* Localized Banner */}
        <LocalizedPrivacyBanner languageName="Spanish (Español)" />

        <div className="space-y-6">
          {/* Section 1: Responsable */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Building className="h-5 w-5" />
              1. Responsable del Tratamiento
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p>El responsable del tratamiento de sus datos personales es:</p>
              <div className="bg-navy/50 p-4 rounded-md border border-gold/10 mt-2">
                <p className="font-medium text-ivory">Roberto Imbimbo</p>
                <p className="text-ivory/70">Mörikestraße 10</p>
                <p className="text-ivory/70">72202 Nagold</p>
                <p className="text-ivory/70">Alemania</p>
              </div>
            </div>
          </section>

          {/* Section 2: Finalidad */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              2. Finalidad del Tratamiento
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Tratamos datos personales para proporcionar las siguientes funcionalidades:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Gestión de cuenta y autenticación</li>
                <li>Carga y almacenamiento de documentos</li>
                <li>OCR (Reconocimiento Óptico de Caracteres) para extracción de texto</li>
                <li>Análisis de documentos con IA y orientación legal</li>
                <li>Generación de borradores de respuesta</li>
                <li>Seguimiento de plazos y recordatorios</li>
                <li>Soporte al cliente y seguridad</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Categorías de Datos */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              3. Categorías de Datos Personales
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <div>
                <p className="font-medium text-ivory mb-1">Datos de Cuenta:</p>
                <p className="ml-4">Dirección de email, ID de usuario, eventos de autenticación, estado de suscripción</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Datos de Uso:</p>
                <p className="ml-4">Registros técnicos, informes de errores, marcas de tiempo, información del dispositivo, dirección IP (anonimizada)</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Datos de Documentos:</p>
                <p className="ml-4">Documentos y escaneos subidos, texto extraído (OCR), metadatos de documentos, interacciones de chat con IA</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Datos de Pago:</p>
                <p className="ml-4">Información de suscripción (procesada por Stripe), historial de facturación</p>
              </div>
            </div>
          </section>

          {/* Section 3.1: CCPA Notice at Collection */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              3.1 Aviso CCPA sobre la Recopilación (Residentes de California)
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                En el momento o antes de la recopilación, informamos a los residentes de California que recopilamos información 
                personal para los fines descritos en esta Política de Privacidad, incluyendo la prestación de nuestros servicios, 
                seguridad, cumplimiento legal y mejora del servicio. No vendemos información personal y no la compartimos para 
                publicidad comportamental entre contextos. Los períodos de retención de datos se describen en la Sección 7.
              </p>
            </div>
          </section>

          {/* Section 4: Base Legal */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              4. Base Legal del Tratamiento
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Tratamos sus datos basándonos en las siguientes bases legales:</p>
              <div className="space-y-2 mt-2">
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Ejecución del Contrato (Art. 6(1)(b) RGPD)</p>
                  <p className="text-sm text-ivory/60">Tratamiento necesario para proporcionar los servicios solicitados</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Interés Legítimo (Art. 6(1)(f) RGPD)</p>
                  <p className="text-sm text-ivory/60">Medidas de seguridad, análisis de errores, mejora del servicio</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Consentimiento (Art. 6(1)(a) RGPD)</p>
                  <p className="text-sm text-ivory/60">Cuando sea específicamente requerido para funcionalidades opcionales o marketing</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Obligación Legal (Art. 6(1)(c) RGPD)</p>
                  <p className="text-sm text-ivory/60">Cumplimiento de leyes y regulaciones aplicables</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ivory/70">
                Para los usuarios fuera de la UE/EEE, procesamos los datos personales de acuerdo con las leyes de privacidad locales aplicables.
              </p>
            </div>
          </section>

          {/* Section 5: Destinatarios */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Server className="h-5 w-5" />
              5. Destinatarios de Datos y Encargados del Tratamiento
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Podemos compartir sus datos con las siguientes categorías de destinatarios:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li><strong>Infraestructura Cloud:</strong> Servidores seguros para alojamiento y servicios de base de datos</li>
                <li><strong>Servicios de IA:</strong> Para análisis de documentos y procesamiento de texto (minimización de datos aplicada)</li>
                <li><strong>Procesadores de Pago:</strong> Stripe para gestión de suscripciones</li>
                <li><strong>Servicios de Email:</strong> Para emails transaccionales y notificaciones</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                Todos los encargados del tratamiento están vinculados por acuerdos de tratamiento de datos y están obligados a mantener medidas de seguridad apropiadas.
              </p>
            </div>
          </section>

          {/* Section 6: Transferencias Internacionales */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Globe className="h-5 w-5" />
              6. Transferencias Internacionales de Datos
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Sus datos pueden ser transferidos y procesados en países fuera de su país de residencia. 
                Cuando transferimos datos internacionalmente, aseguramos las salvaguardas apropiadas:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Cláusulas Contractuales Tipo de la UE (CCT)</li>
                <li>Decisiones de adecuación de la Comisión Europea</li>
                <li>EU-U.S. Data Privacy Framework (donde aplique)</li>
                <li>Normas Corporativas Vinculantes (BCR) de nuestros proveedores</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Conservación */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Clock className="h-5 w-5" />
              7. Conservación de Datos
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p><strong>Datos de Cuenta:</strong> Conservados mientras su cuenta esté activa</p>
              <p><strong>Documentos y Borradores:</strong> Hasta que los elimine o cierre su cuenta</p>
              <p><strong>Registros Técnicos:</strong> 30-90 días para seguridad y depuración</p>
              <p><strong>Registros de Pago:</strong> Según leyes fiscales y contables aplicables (típicamente 7-10 años)</p>
              <p className="mt-3 text-sm text-ivory/60">
                Al eliminar la cuenta, eliminaremos o anonimizaremos sus datos personales en 30 días, excepto donde la conservación sea requerida por ley.
              </p>
            </div>
          </section>

          {/* Section 8: Sus Derechos */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Users className="h-5 w-5" />
              8. Sus Derechos
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Dependiendo de su ubicación, tiene los siguientes derechos sobre sus datos personales:</p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-medium text-ivory mb-2">Para Todos los Usuarios:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li><strong>Acceso:</strong> Solicitar una copia de sus datos personales</li>
                    <li><strong>Rectificación:</strong> Corregir datos inexactos</li>
                    <li><strong>Supresión:</strong> Solicitar la eliminación de sus datos</li>
                    <li><strong>Portabilidad:</strong> Recibir sus datos en formato legible por máquina</li>
                    <li><strong>Oposición:</strong> Oponerse a ciertas actividades de tratamiento</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Residentes UE/EEE (RGPD):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Derecho a la limitación del tratamiento</li>
                    <li>Derecho a retirar el consentimiento en cualquier momento</li>
                    <li>Derecho a presentar una reclamación ante una autoridad de control</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Residentes de California (CCPA/CPRA):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Derecho a saber qué información personal se recopila</li>
                    <li>Derecho a acceder a piezas específicas de información personal</li>
                    <li>Derecho a eliminar información personal</li>
                    <li>Derecho a corregir información personal inexacta</li>
                    <li>Derecho a optar por no vender/compartir información personal (donde aplique)</li>
                    <li>Derecho a limitar el uso de información personal sensible (donde aplique)</li>
                    <li>Derecho a la no discriminación por ejercer sus derechos</li>
                  </ul>
                  <p className="text-sm text-ivory/70 mt-3">
                    <strong>Cómo ejercer estos derechos:</strong> Puede enviar una solicitud a través del método de contacto descrito en la Sección 13. 
                    Es posible que necesitemos verificar su identidad antes de cumplir con su solicitud.
                  </p>
                  <p className="text-xs text-ivory/50 mt-2">
                    Nota: No vendemos su información personal y no la compartimos para publicidad comportamental entre contextos.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9: Seguridad */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Lock className="h-5 w-5" />
              9. Medidas de Seguridad
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Implementamos medidas técnicas y organizativas apropiadas para proteger sus datos:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Cifrado en tránsito (TLS/SSL) y en reposo</li>
                <li>Controles de acceso y autenticación</li>
                <li>Evaluaciones de seguridad regulares</li>
                <li>Formación del personal en protección de datos</li>
                <li>Procedimientos de respuesta a incidentes</li>
              </ul>
            </div>
          </section>

          {/* Section 10: Cookies */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              10. Cookies y Almacenamiento Local
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Utilizamos cookies técnicamente necesarias y mecanismos de almacenamiento local para:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Autenticación de usuario y gestión de sesión</li>
                <li>Configuración de idioma y preferencias</li>
                <li>Funcionalidades de seguridad</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                No utilizamos cookies de seguimiento con fines publicitarios. Las analíticas, si las hay, utilizan datos anonimizados.
              </p>
              <p className="mt-2 text-sm text-ivory/60">
                Respetamos las señales válidas de Global Privacy Control (GPC) cuando lo requiera la ley aplicable.
              </p>
            </div>
          </section>

          {/* Section 11: Menores */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <AlertTriangle className="h-5 w-5" />
              11. Privacidad de Menores
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Nuestros servicios no están destinados a personas menores de 18 años. No recopilamos conscientemente 
                información personal de menores. Si cree que un menor nos ha proporcionado datos personales, 
                contáctenos y los eliminaremos rápidamente.
              </p>
            </div>
          </section>

          {/* Section 12: Cambios */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              12. Cambios a esta Política
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Podemos actualizar esta Política de Privacidad de vez en cuando. Le notificaremos cambios significativos 
                a través de la aplicación o por email. La fecha "Última actualización" arriba indica cuándo se revisó la política 
                por última vez. El uso continuado de nuestros servicios después de los cambios constituye aceptación de la política actualizada.
              </p>
            </div>
          </section>

          {/* Section 13: Contacto */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Download className="h-5 w-5" />
              13. Contáctenos
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Para hacer preguntas sobre esta Política de Privacidad o para ejercer sus derechos sobre sus datos (incluyendo solicitudes CCPA/CPRA), 
                contáctenos a través del formulario de contacto en nuestra <Link to="/impressum" className="text-gold hover:underline">página Impressum</Link>. 
                Por favor incluya el asunto: <strong>"Solicitud de Privacidad"</strong>.
              </p>
              <p className="mt-3 text-sm text-ivory/60">
                Los residentes de la UE también pueden contactar a su autoridad local de protección de datos si tienen preocupaciones sobre nuestras prácticas.
              </p>
            </div>
          </section>
        </div>

        {/* Master version link */}
        <div className="mt-8 p-4 rounded-lg border border-gold/20 bg-ivory/5 text-center">
          <p className="text-sm text-ivory/60">
            <Link to="/privacy" className="text-gold hover:underline">
              Ver la versión en inglés (legalmente vinculante) →
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-ivory/50 hover:text-gold transition-colors">← Volver al inicio</Link>
        </div>
      </main>

      <footer className="border-t border-gold/20 py-6">
        <div className="container text-center">
          <p className="text-sm text-ivory/40">© {new Date().getFullYear()} LEXORA</p>
        </div>
      </footer>
    </div>
  );
}
