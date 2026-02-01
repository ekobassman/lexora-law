import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Shield, FileText, Clock, Download, Lock, Globe, Database, Scale, Building, Users, Server, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIVACY_VERSION, getLastUpdatedLabel } from '@/lib/legalVersions';
import { LocalizedPrivacyBanner } from '@/components/LocalizedPrivacyBanner';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Italian localized Privacy Policy
 * Translation of the master English version
 */
export default function PrivacyIT() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-navy">
      <Helmet>
        <title>Informativa sulla Privacy | Lexora</title>
        <meta name="description" content="Informativa sulla Privacy di Lexora - Scopri come proteggiamo i tuoi dati. Conforme al GDPR." />
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
            <h1 className="font-display text-3xl font-medium text-ivory">Informativa sulla Privacy</h1>
            <p className="text-sm text-ivory/50 mt-1">{getLastUpdatedLabel(PRIVACY_VERSION, 'it')}</p>
            <p className="text-xs text-ivory/30 mt-0.5">Versione: {PRIVACY_VERSION}</p>
          </div>
        </div>

        {/* Localized Banner */}
        <LocalizedPrivacyBanner languageName="Italian (Italiano)" />

        <div className="space-y-6">
          {/* Section 1: Titolare */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Building className="h-5 w-5" />
              1. Titolare del Trattamento
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p>Il titolare del trattamento dei tuoi dati personali è:</p>
              <div className="bg-navy/50 p-4 rounded-md border border-gold/10 mt-2">
                <p className="font-medium text-ivory">Roberto Imbimbo</p>
                <p className="text-ivory/70">Mörikestraße 10</p>
                <p className="text-ivory/70">72202 Nagold</p>
                <p className="text-ivory/70">Germania</p>
              </div>
            </div>
          </section>

          {/* Section 2: Finalità */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              2. Finalità del Trattamento
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Trattiamo i dati personali per fornire le seguenti funzionalità dell'app:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Gestione account e autenticazione</li>
                <li>Caricamento e archiviazione documenti</li>
                <li>OCR (Riconoscimento Ottico dei Caratteri) per l'estrazione del testo</li>
                <li>Analisi documenti basata su IA e orientamento legale</li>
                <li>Generazione di bozze di risposta</li>
                <li>Monitoraggio scadenze e promemoria</li>
                <li>Assistenza clienti e sicurezza</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Categorie di Dati */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              3. Categorie di Dati Personali
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <div>
                <p className="font-medium text-ivory mb-1">Dati dell'Account:</p>
                <p className="ml-4">Indirizzo email, ID utente, eventi di autenticazione, stato abbonamento</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Dati di Utilizzo:</p>
                <p className="ml-4">Log tecnici, rapporti errori, timestamp, informazioni dispositivo, indirizzo IP (anonimizzato)</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Dati dei Documenti:</p>
                <p className="ml-4">Documenti e scansioni caricati, testo estratto (OCR), metadati documenti (tipo file, dimensione, date), interazioni chat IA</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Dati di Pagamento:</p>
                <p className="ml-4">Informazioni abbonamento (elaborati da Stripe), storico fatturazione</p>
              </div>
            </div>
          </section>

          {/* Section 3.1: CCPA Notice at Collection */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              3.1 Avviso CCPA sulla Raccolta (Residenti in California)
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Al momento o prima della raccolta, informiamo i residenti in California che raccogliamo informazioni personali 
                per gli scopi descritti nella presente Informativa sulla Privacy, inclusa la fornitura dei nostri servizi, 
                sicurezza, conformità legale e miglioramento del servizio. Non vendiamo informazioni personali e non le 
                condividiamo per pubblicità comportamentale cross-context. I periodi di conservazione dei dati sono descritti nella Sezione 7.
              </p>
            </div>
          </section>

          {/* Section 4: Base Giuridica */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              4. Base Giuridica del Trattamento
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Trattiamo i tuoi dati sulla base delle seguenti basi giuridiche:</p>
              <div className="space-y-2 mt-2">
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Esecuzione del Contratto (Art. 6(1)(b) GDPR)</p>
                  <p className="text-sm text-ivory/60">Trattamento necessario per fornire i servizi richiesti</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Interesse Legittimo (Art. 6(1)(f) GDPR)</p>
                  <p className="text-sm text-ivory/60">Misure di sicurezza, analisi errori, miglioramento del servizio</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Consenso (Art. 6(1)(a) GDPR)</p>
                  <p className="text-sm text-ivory/60">Quando specificamente richiesto per funzionalità opzionali o marketing</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Obbligo Legale (Art. 6(1)(c) GDPR)</p>
                  <p className="text-sm text-ivory/60">Conformità alle leggi e regolamenti applicabili</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ivory/70">
                Per gli utenti al di fuori dell'UE/SEE, trattiamo i dati personali in conformità con le leggi locali sulla privacy applicabili.
              </p>
            </div>
          </section>

          {/* Section 5: Destinatari */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Server className="h-5 w-5" />
              5. Destinatari dei Dati e Responsabili del Trattamento
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Possiamo condividere i tuoi dati con le seguenti categorie di destinatari:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li><strong>Infrastruttura Cloud:</strong> Server sicuri per hosting e servizi database</li>
                <li><strong>Servizi IA:</strong> Per analisi documenti ed elaborazione testo (minimizzazione dati applicata)</li>
                <li><strong>Processori di Pagamento:</strong> Stripe per la gestione abbonamenti</li>
                <li><strong>Servizi Email:</strong> Per email transazionali e notifiche</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                Tutti i responsabili del trattamento sono vincolati da accordi di trattamento dati e sono tenuti a mantenere misure di sicurezza appropriate.
              </p>
            </div>
          </section>

          {/* Section 6: Trasferimenti Internazionali */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Globe className="h-5 w-5" />
              6. Trasferimenti Internazionali di Dati
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                I tuoi dati potrebbero essere trasferiti ed elaborati in paesi al di fuori del tuo paese di residenza. 
                Quando trasferiamo dati a livello internazionale, garantiamo le appropriate tutele:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Clausole Contrattuali Standard UE (SCCs)</li>
                <li>Decisioni di adeguatezza della Commissione Europea</li>
                <li>EU-U.S. Data Privacy Framework (ove applicabile)</li>
                <li>Norme Vincolanti d'Impresa (BCRs) dei nostri fornitori</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Durata Conservazione */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Clock className="h-5 w-5" />
              7. Conservazione dei Dati
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p><strong>Dati Account:</strong> Conservati finché il tuo account è attivo</p>
              <p><strong>Documenti e Bozze:</strong> Fino alla loro eliminazione o chiusura dell'account</p>
              <p><strong>Log Tecnici:</strong> 30-90 giorni per scopi di sicurezza e debug</p>
              <p><strong>Registri Pagamenti:</strong> Come richiesto dalle leggi fiscali e contabili applicabili (tipicamente 7-10 anni)</p>
              <p className="mt-3 text-sm text-ivory/60">
                Alla cancellazione dell'account, elimineremo o renderemo anonimi i tuoi dati personali entro 30 giorni, salvo dove la conservazione sia richiesta per legge.
              </p>
            </div>
          </section>

          {/* Section 8: I Tuoi Diritti */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Users className="h-5 w-5" />
              8. I Tuoi Diritti
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">A seconda della tua posizione, hai i seguenti diritti riguardo ai tuoi dati personali:</p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-medium text-ivory mb-2">Per Tutti gli Utenti:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li><strong>Accesso:</strong> Richiedere una copia dei tuoi dati personali</li>
                    <li><strong>Rettifica:</strong> Correggere dati inesatti</li>
                    <li><strong>Cancellazione:</strong> Richiedere l'eliminazione dei tuoi dati</li>
                    <li><strong>Portabilità:</strong> Ricevere i tuoi dati in formato leggibile da macchina</li>
                    <li><strong>Opposizione:</strong> Opporti a determinate attività di trattamento</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Residenti UE/SEE (GDPR):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Diritto alla limitazione del trattamento</li>
                    <li>Diritto di revocare il consenso in qualsiasi momento</li>
                    <li>Diritto di proporre reclamo a un'autorità di controllo</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Residenti in California (CCPA/CPRA):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Diritto di sapere quali informazioni personali vengono raccolte</li>
                    <li>Diritto di accedere a specifiche informazioni personali</li>
                    <li>Diritto di cancellare le informazioni personali</li>
                    <li>Diritto di correggere informazioni personali inesatte</li>
                    <li>Diritto di opporsi alla vendita/condivisione di informazioni personali (ove applicabile)</li>
                    <li>Diritto di limitare l'uso di informazioni personali sensibili (ove applicabile)</li>
                    <li>Diritto alla non discriminazione per l'esercizio dei propri diritti</li>
                  </ul>
                  <p className="text-sm text-ivory/70 mt-3">
                    <strong>Come esercitare questi diritti:</strong> Puoi inviare una richiesta tramite il metodo di contatto descritto nella Sezione 13. 
                    Potremmo dover verificare la tua identità prima di soddisfare la tua richiesta.
                  </p>
                  <p className="text-xs text-ivory/50 mt-2">
                    Nota: Non vendiamo le tue informazioni personali e non le condividiamo per pubblicità comportamentale cross-context.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9: Sicurezza */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Lock className="h-5 w-5" />
              9. Misure di Sicurezza
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Implementiamo misure tecniche e organizzative appropriate per proteggere i tuoi dati:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Crittografia in transito (TLS/SSL) e a riposo</li>
                <li>Controlli di accesso e autenticazione</li>
                <li>Valutazioni di sicurezza regolari</li>
                <li>Formazione del personale sulla protezione dei dati</li>
                <li>Procedure di risposta agli incidenti</li>
              </ul>
            </div>
          </section>

          {/* Section 10: Cookie */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              10. Cookie e Archiviazione Locale
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Utilizziamo cookie tecnicamente necessari e meccanismi di archiviazione locale per:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Autenticazione utente e gestione sessioni</li>
                <li>Impostazioni di lingua e preferenze</li>
                <li>Funzionalità di sicurezza</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                Non utilizziamo cookie di tracciamento per scopi pubblicitari. Le analisi, se presenti, utilizzano dati anonimizzati.
              </p>
              <p className="mt-2 text-sm text-ivory/60">
                Rispettiamo i segnali Global Privacy Control (GPC) validi ove richiesto dalla legge applicabile.
              </p>
            </div>
          </section>

          {/* Section 11: Privacy dei Minori */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <AlertTriangle className="h-5 w-5" />
              11. Privacy dei Minori
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                I nostri servizi non sono destinati a persone di età inferiore ai 18 anni. Non raccogliamo consapevolmente 
                informazioni personali da minori. Se ritieni che un minore ci abbia fornito dati personali, 
                contattaci e li elimineremo tempestivamente.
              </p>
            </div>
          </section>

          {/* Section 12: Modifiche */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              12. Modifiche a questa Informativa
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Potremmo aggiornare questa Informativa sulla Privacy di tanto in tanto. Ti informeremo di modifiche significative 
                tramite l'app o via email. La data "Ultimo aggiornamento" in alto indica quando l'informativa è stata 
                rivista l'ultima volta. L'uso continuato dei nostri servizi dopo le modifiche costituisce accettazione dell'informativa aggiornata.
              </p>
            </div>
          </section>

          {/* Section 13: Contatti */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Download className="h-5 w-5" />
              13. Contattaci
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Per porre domande su questa Informativa sulla Privacy o per esercitare i tuoi diritti sui dati (incluse le richieste CCPA/CPRA), 
                contattaci tramite il modulo di contatto sulla nostra <Link to="/impressum" className="text-gold hover:underline">pagina Impressum</Link>. 
                Includi l'oggetto: <strong>"Richiesta Privacy"</strong>.
              </p>
              <p className="mt-3 text-sm text-ivory/60">
                I residenti UE possono anche contattare la loro autorità locale per la protezione dei dati se hanno dubbi sulle nostre pratiche.
              </p>
            </div>
          </section>
        </div>

        {/* Master version link */}
        <div className="mt-8 p-4 rounded-lg border border-gold/20 bg-ivory/5 text-center">
          <p className="text-sm text-ivory/60">
            <Link to="/privacy" className="text-gold hover:underline">
              Visualizza la versione inglese (legalmente vincolante) →
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-ivory/50 hover:text-gold transition-colors">← Torna alla Home</Link>
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
