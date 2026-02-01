import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { FileText, Upload, CheckCircle2, AlertTriangle, Clock, Scale } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function OffizielleBriefeVerstehen() {
  return (
    <>
      <Helmet>
        <title>Offizielle Briefe verstehen – Bedeutung, Fristen & Antworten | Lexora</title>
        <meta name="description" content="Probleme mit offiziellen Briefen von Behörden oder Inkasso? Lexora hilft beim Verstehen von Bedeutung, Risiken und Fristen – Schritt für Schritt." />
        <link rel="canonical" href="https://lexora-law.com/offizielle-briefe-verstehen" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-12 md:py-16">
          <article className="mx-auto max-w-3xl">
            {/* Hero Section */}
            <header className="mb-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileText className="h-8 w-8" />
                </div>
              </div>
              <h1 className="mb-6 text-3xl font-bold text-foreground md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>
                Offizielle Briefe verstehen – einfach erklärt.
              </h1>
              <p className="text-lg text-muted-foreground">
                Praktische Anleitung für alle, die amtliche Schreiben in Deutschland erhalten und verstehen möchten.
              </p>
            </header>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Warum sind Behördenbriefe oft schwer zu verstehen?
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Ob <strong>Finanzamt</strong>, <strong>Jobcenter</strong>, <strong>Krankenkasse</strong> oder <strong>Gericht</strong> – amtliche Schreiben in Deutschland sind für ihre komplizierte Sprache bekannt. Selbst Muttersprachler haben oft Schwierigkeiten, den genauen Inhalt zu erfassen. Fachbegriffe, Gesetzesverweise und strenge Fristen machen die Sache nicht einfacher.
                </p>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Dabei ist es wichtig, jeden Brief richtig zu verstehen. Denn eine falsche Reaktion oder das Verpassen einer Frist kann ernste Folgen haben – von Mahngebühren über Bußgelder bis hin zu rechtlichen Konsequenzen.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Häufige Arten von Behördenbriefen
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Mahnung (Zahlungsaufforderung)</h3>
                      <p className="text-sm text-muted-foreground">Aufforderung zur Zahlung einer offenen Rechnung. Kann von Unternehmen oder Inkassofirmen stammen. Enthält meist eine Frist.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Scale className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Bescheid (Amtliche Entscheidung)</h3>
                      <p className="text-sm text-muted-foreground">Offizielle Entscheidung einer Behörde, z.B. Bewilligung oder Ablehnung eines Antrags. Gegen Bescheide kann oft Widerspruch eingelegt werden.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Clock className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Anhörung (Stellungnahme angefordert)</h3>
                      <p className="text-sm text-muted-foreground">Die Behörde möchte Ihre Sicht der Dinge hören, bevor sie eine Entscheidung trifft. Eine Reaktion ist meist dringend erforderlich.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <FileText className="h-5 w-5 text-purple-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Bußgeldbescheid (Geldbuße)</h3>
                      <p className="text-sm text-muted-foreground">Mitteilung über eine Ordnungswidrigkeit, z.B. Geschwindigkeitsüberschreitung. Enthält die Höhe des Bußgeldes und mögliche Punkte.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So gehen Sie mit amtlichen Schreiben um
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Eine strukturierte Vorgehensweise hilft Ihnen, Fehler zu vermeiden und rechtzeitig zu reagieren:
                </p>
                <ol className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">1</span>
                    <span className="text-muted-foreground"><strong>Absender prüfen:</strong> Wer hat den Brief geschickt? Behörde, Unternehmen oder Inkasso? Das bestimmt die Dringlichkeit.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">2</span>
                    <span className="text-muted-foreground"><strong>Frist identifizieren:</strong> Die meisten amtlichen Schreiben enthalten eine Frist. Notieren Sie sich diese sofort!</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">3</span>
                    <span className="text-muted-foreground"><strong>Kernaussage verstehen:</strong> Was wird von Ihnen verlangt? Zahlung, Unterlagen, Stellungnahme oder nur Kenntnisnahme?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">4</span>
                    <span className="text-muted-foreground"><strong>Aktenzeichen notieren:</strong> Das Aktenzeichen ist bei jeder Antwort wichtig. Ohne Aktenzeichen kann Ihre Antwort nicht zugeordnet werden.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">5</span>
                    <span className="text-muted-foreground"><strong>Schriftlich antworten:</strong> Antworten Sie immer schriftlich und bewahren Sie eine Kopie auf.</span>
                  </li>
                </ol>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Was passiert, wenn Sie nicht reagieren?
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Das Ignorieren amtlicher Schreiben kann ernste Folgen haben:
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-muted-foreground">Säumniszuschläge und Mahngebühren</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-muted-foreground">Vollstreckungsmaßnahmen (z.B. Kontopfändung)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-muted-foreground">Negative SCHUFA-Einträge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-muted-foreground">Rechtskräftige Bescheide ohne Ihre Stellungnahme</span>
                  </li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So hilft Ihnen Lexora
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  <strong>Lexora</strong> ist Ihr digitaler Assistent für amtliche Briefe. Laden Sie einfach Ihr Schreiben hoch und erhalten Sie:
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Verständliche Erklärung des Briefinhalts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Automatische Erkennung wichtiger Fristen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Handlungsempfehlungen für Ihre Situation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Entwurf für Ihre Antwort</span>
                  </li>
                </ul>
              </section>

              {/* CTA Section */}
              <section className="rounded-lg bg-primary/5 p-8 text-center">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Sie haben einen Brief erhalten und verstehen ihn nicht?
                </h2>
                <p className="mb-6 text-muted-foreground">
                  Laden Sie ihn bei Lexora hoch und erfahren Sie sofort, was zu tun ist.
                </p>
                <Link to="/auth">
                  <Button size="lg" className="gap-2">
                    <Upload className="h-5 w-5" />
                    Lexora öffnen und Brief hochladen
                  </Button>
                </Link>
              </section>
            </div>
          </article>
        </main>

        <LegalFooter />
      </div>
    </>
  );
}
