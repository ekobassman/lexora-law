import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Shield, FileText, Clock, Download, Lock, Globe, Database, Scale, Building, Users, Server, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIVACY_VERSION, getLastUpdatedLabel } from '@/lib/legalVersions';
import { LocalizedPrivacyBanner } from '@/components/LocalizedPrivacyBanner';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * German localized Privacy Policy
 * Translation of the master English version
 */
export default function PrivacyDE() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-navy">
      <Helmet>
        <title>Datenschutzerklärung | Lexora</title>
        <meta name="description" content="Lexora Datenschutzerklärung - Erfahren Sie, wie wir Ihre Daten schützen. DSGVO-konform." />
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
            <h1 className="font-display text-3xl font-medium text-ivory">Datenschutzerklärung</h1>
            <p className="text-sm text-ivory/50 mt-1">{getLastUpdatedLabel(PRIVACY_VERSION, 'de')}</p>
            <p className="text-xs text-ivory/30 mt-0.5">Version: {PRIVACY_VERSION}</p>
          </div>
        </div>

        {/* Localized Banner */}
        <LocalizedPrivacyBanner languageName="German (Deutsch)" />

        <div className="space-y-6">
          {/* Section 1: Verantwortlicher */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Building className="h-5 w-5" />
              1. Verantwortlicher
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p>Der Verantwortliche für die Verarbeitung Ihrer personenbezogenen Daten ist:</p>
              <div className="bg-navy/50 p-4 rounded-md border border-gold/10 mt-2">
                <p className="font-medium text-ivory">Roberto Imbimbo</p>
                <p className="text-ivory/70">Mörikestraße 10</p>
                <p className="text-ivory/70">72202 Nagold</p>
                <p className="text-ivory/70">Deutschland</p>
              </div>
            </div>
          </section>

          {/* Section 2: Zweck der Verarbeitung */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              2. Zweck der Verarbeitung
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Wir verarbeiten personenbezogene Daten zur Bereitstellung folgender App-Funktionen:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Kontoverwaltung und Authentifizierung</li>
                <li>Dokumenten-Upload und -Speicherung</li>
                <li>OCR (Optische Zeichenerkennung) zur Textextraktion</li>
                <li>KI-gestützte Dokumentenanalyse und rechtliche Orientierungshilfe</li>
                <li>Erstellung von Antwortentwürfen</li>
                <li>Fristenverfolgung und Erinnerungen</li>
                <li>Kundensupport und Sicherheit</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Kategorien von Daten */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              3. Kategorien personenbezogener Daten
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <div>
                <p className="font-medium text-ivory mb-1">Kontodaten:</p>
                <p className="ml-4">E-Mail-Adresse, Benutzer-ID, Authentifizierungsereignisse, Abonnementstatus</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Nutzungsdaten:</p>
                <p className="ml-4">Technische Protokolle, Fehlerberichte, Zeitstempel, Geräteinformationen, IP-Adresse (anonymisiert)</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Dokumentendaten:</p>
                <p className="ml-4">Hochgeladene Dokumente und Scans, extrahierter Text (OCR), Dokumentmetadaten (Dateityp, Größe, Daten), KI-Chat-Interaktionen</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Zahlungsdaten:</p>
                <p className="ml-4">Abonnementinformationen (verarbeitet durch Stripe), Abrechnungshistorie</p>
              </div>
            </div>
          </section>

          {/* Section 3.1: CCPA Notice at Collection */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              3.1 CCPA-Hinweis bei der Erhebung (Einwohner Kaliforniens)
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Bei oder vor der Erhebung informieren wir Einwohner Kaliforniens, dass wir personenbezogene Daten 
                für die in dieser Datenschutzerklärung beschriebenen Zwecke erheben, einschließlich der Bereitstellung 
                unserer Dienste, Sicherheit, Einhaltung gesetzlicher Vorschriften und Dienstverbesserung. Wir verkaufen 
                keine personenbezogenen Daten und teilen sie nicht für kontextübergreifende verhaltensbasierte Werbung. 
                Die Aufbewahrungsfristen sind in Abschnitt 7 beschrieben.
              </p>
            </div>
          </section>

          {/* Section 4: Rechtsgrundlagen */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              4. Rechtsgrundlagen der Verarbeitung
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Wir verarbeiten Ihre Daten auf folgenden Rechtsgrundlagen:</p>
              <div className="space-y-2 mt-2">
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</p>
                  <p className="text-sm text-ivory/60">Verarbeitung zur Bereitstellung der von Ihnen angeforderten Dienste</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)</p>
                  <p className="text-sm text-ivory/60">Sicherheitsmaßnahmen, Fehleranalyse, Dienstverbesserung</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)</p>
                  <p className="text-sm text-ivory/60">Bei optionalen Funktionen oder Marketing, wo erforderlich</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO)</p>
                  <p className="text-sm text-ivory/60">Einhaltung geltender Gesetze und Vorschriften</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ivory/70">
                Für Nutzer außerhalb der EU/des EWR verarbeiten wir personenbezogene Daten in Übereinstimmung mit den geltenden lokalen Datenschutzgesetzen.
              </p>
            </div>
          </section>

          {/* Section 5: Empfänger */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Server className="h-5 w-5" />
              5. Datenempfänger & Auftragsverarbeiter
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Wir können Ihre Daten mit folgenden Kategorien von Empfängern teilen:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li><strong>Cloud-Infrastruktur:</strong> Sichere Server für Hosting und Datenbankdienste</li>
                <li><strong>KI-Dienste:</strong> Für Dokumentenanalyse und Textverarbeitung (Datenminimierung angewandt)</li>
                <li><strong>Zahlungsabwickler:</strong> Stripe für Abonnementverwaltung</li>
                <li><strong>E-Mail-Dienste:</strong> Für Transaktions-E-Mails und Benachrichtigungen</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                Alle Auftragsverarbeiter sind durch Auftragsverarbeitungsverträge gebunden und verpflichtet, angemessene Sicherheitsmaßnahmen einzuhalten.
              </p>
            </div>
          </section>

          {/* Section 6: Internationale Übermittlungen */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Globe className="h-5 w-5" />
              6. Internationale Datenübermittlungen
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Ihre Daten können in Länder außerhalb Ihres Wohnsitzlandes übermittelt und dort verarbeitet werden. 
                Bei internationalen Übermittlungen stellen wir angemessene Garantien sicher:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>EU-Standardvertragsklauseln (SCCs)</li>
                <li>Angemessenheitsbeschlüsse der Europäischen Kommission</li>
                <li>EU-US Data Privacy Framework (wo anwendbar)</li>
                <li>Verbindliche Unternehmensregeln (BCRs) unserer Dienstleister</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Speicherdauer */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Clock className="h-5 w-5" />
              7. Speicherdauer
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p><strong>Kontodaten:</strong> Solange Ihr Konto aktiv ist</p>
              <p><strong>Dokumente & Entwürfe:</strong> Bis Sie diese löschen oder Ihr Konto schließen</p>
              <p><strong>Technische Protokolle:</strong> 30-90 Tage für Sicherheits- und Debugging-Zwecke</p>
              <p><strong>Zahlungsaufzeichnungen:</strong> Wie nach geltenden Steuer- und Buchhaltungsgesetzen erforderlich (typischerweise 7-10 Jahre)</p>
              <p className="mt-3 text-sm text-ivory/60">
                Bei Kontolöschung werden wir Ihre personenbezogenen Daten innerhalb von 30 Tagen löschen oder anonymisieren, es sei denn, eine Aufbewahrung ist gesetzlich vorgeschrieben.
              </p>
            </div>
          </section>

          {/* Section 8: Ihre Rechte */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Users className="h-5 w-5" />
              8. Ihre Rechte
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Je nach Standort haben Sie folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-medium text-ivory mb-2">Für alle Nutzer:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li><strong>Auskunft:</strong> Eine Kopie Ihrer personenbezogenen Daten anfordern</li>
                    <li><strong>Berichtigung:</strong> Unrichtige Daten korrigieren</li>
                    <li><strong>Löschung:</strong> Löschung Ihrer Daten beantragen</li>
                    <li><strong>Datenübertragbarkeit:</strong> Ihre Daten in maschinenlesbarem Format erhalten</li>
                    <li><strong>Widerspruch:</strong> Bestimmten Verarbeitungsaktivitäten widersprechen</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">EU/EWR-Einwohner (DSGVO):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Recht auf Einschränkung der Verarbeitung</li>
                    <li>Recht auf jederzeitigen Widerruf der Einwilligung</li>
                    <li>Recht auf Beschwerde bei einer Aufsichtsbehörde</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Einwohner Kaliforniens (CCPA/CPRA):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Recht zu erfahren, welche personenbezogenen Daten erhoben werden</li>
                    <li>Recht auf Zugang zu bestimmten personenbezogenen Daten</li>
                    <li>Recht auf Löschung personenbezogener Daten</li>
                    <li>Recht auf Berichtigung unrichtiger personenbezogener Daten</li>
                    <li>Recht auf Widerspruch gegen den Verkauf/die Weitergabe personenbezogener Daten (falls zutreffend)</li>
                    <li>Recht auf Einschränkung der Nutzung sensibler personenbezogener Daten (falls zutreffend)</li>
                    <li>Recht auf Nichtdiskriminierung bei Ausübung Ihrer Rechte</li>
                  </ul>
                  <p className="text-sm text-ivory/70 mt-3">
                    <strong>So üben Sie diese Rechte aus:</strong> Sie können einen Antrag über die in Abschnitt 13 beschriebene Kontaktmethode stellen. 
                    Wir müssen möglicherweise Ihre Identität überprüfen, bevor wir Ihren Antrag erfüllen.
                  </p>
                  <p className="text-xs text-ivory/50 mt-2">
                    Hinweis: Wir verkaufen Ihre personenbezogenen Daten nicht und teilen sie nicht für kontextübergreifende verhaltensbasierte Werbung.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9: Sicherheit */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Lock className="h-5 w-5" />
              9. Sicherheitsmaßnahmen
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Wir implementieren angemessene technische und organisatorische Maßnahmen zum Schutz Ihrer Daten:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Verschlüsselung bei der Übertragung (TLS/SSL) und im Ruhezustand</li>
                <li>Zugangskontrollen und Authentifizierung</li>
                <li>Regelmäßige Sicherheitsbewertungen</li>
                <li>Mitarbeiterschulungen zum Datenschutz</li>
                <li>Verfahren zur Reaktion auf Vorfälle</li>
              </ul>
            </div>
          </section>

          {/* Section 10: Cookies */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              10. Cookies & Lokale Speicherung
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Wir verwenden technisch notwendige Cookies und lokale Speichermechanismen für:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Benutzerauthentifizierung und Sitzungsverwaltung</li>
                <li>Sprach- und Präferenzeinstellungen</li>
                <li>Sicherheitsfunktionen</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                Wir verwenden keine Tracking-Cookies zu Werbezwecken. Analysen, falls vorhanden, verwenden anonymisierte Daten.
              </p>
              <p className="mt-2 text-sm text-ivory/60">
                Wir respektieren gültige Global Privacy Control (GPC)-Signale, wo dies gesetzlich vorgeschrieben ist.
              </p>
            </div>
          </section>

          {/* Section 11: Minderjährige */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <AlertTriangle className="h-5 w-5" />
              11. Datenschutz für Minderjährige
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Unsere Dienste sind nicht für Personen unter 18 Jahren bestimmt. Wir erheben wissentlich keine 
                personenbezogenen Daten von Kindern. Wenn Sie glauben, dass ein Kind uns personenbezogene Daten 
                zur Verfügung gestellt hat, kontaktieren Sie uns bitte und wir werden diese umgehend löschen.
              </p>
            </div>
          </section>

          {/* Section 12: Änderungen */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              12. Änderungen dieser Erklärung
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren. Über wesentliche Änderungen 
                werden wir Sie über die App oder per E-Mail informieren. Das Datum „Zuletzt aktualisiert" oben zeigt 
                an, wann die Erklärung zuletzt überarbeitet wurde. Die weitere Nutzung unserer Dienste nach Änderungen 
                gilt als Annahme der aktualisierten Erklärung.
              </p>
            </div>
          </section>

          {/* Section 13: Kontakt */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Download className="h-5 w-5" />
              13. Kontakt
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Um Fragen zu dieser Datenschutzerklärung zu stellen oder Ihre Datenrechte auszuüben (einschließlich CCPA/CPRA-Anfragen), 
                kontaktieren Sie uns über das Kontaktformular auf unserer <Link to="/impressum" className="text-gold hover:underline">Impressum-Seite</Link>. 
                Bitte verwenden Sie die Betreffzeile: <strong>„Datenschutzanfrage"</strong>.
              </p>
              <p className="mt-3 text-sm text-ivory/60">
                EU-Einwohner können sich auch an ihre lokale Datenschutzbehörde wenden, wenn sie Bedenken bezüglich unserer Datenpraktiken haben.
              </p>
            </div>
          </section>
        </div>

        {/* Master version link */}
        <div className="mt-8 p-4 rounded-lg border border-gold/20 bg-ivory/5 text-center">
          <p className="text-sm text-ivory/60">
            <Link to="/privacy" className="text-gold hover:underline">
              View the English (legally binding) version →
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-ivory/50 hover:text-gold transition-colors">← Zurück zur Startseite</Link>
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
