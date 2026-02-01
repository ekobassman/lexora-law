import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { CreditCard, Upload, CheckCircle2, AlertTriangle, HelpCircle, Shield } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function SchufaBriefVerstehen() {
  return (
    <>
      <Helmet>
        <title>SCHUFA Brief erhalten? Bedeutung verstehen & richtig reagieren | Lexora</title>
        <meta name="description" content="Haben Sie einen SCHUFA-Brief erhalten? Lexora erklärt Bedeutung, Risiken und Fristen und hilft bei der richtigen Antwort – einfach & verständlich." />
        <link rel="canonical" href="https://lexora-law.com/schufa-brief-verstehen" />
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
                  <CreditCard className="h-8 w-8" />
                </div>
              </div>
              <h1 className="mb-6 text-3xl font-bold text-foreground md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>
                SCHUFA-Brief erhalten? Das bedeutet es.
              </h1>
              <p className="text-lg text-muted-foreground">
                Alles Wichtige über SCHUFA-Schreiben, Ihren Bonitätsscore und Ihre Rechte bei negativen Einträgen.
              </p>
            </header>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Was ist die SCHUFA und warum ist sie wichtig?
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Die <strong>SCHUFA</strong> (Schutzgemeinschaft für allgemeine Kreditsicherung) ist Deutschlands größte Auskunftei. Sie sammelt Daten über Ihr Zahlungsverhalten und berechnet daraus einen Score, der Ihre Kreditwürdigkeit widerspiegelt.
                </p>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Dieser Score beeinflusst viele Bereiche Ihres Lebens: <strong>Wohnungssuche</strong>, <strong>Handyverträge</strong>, <strong>Kredite</strong>, <strong>Kontoeröffnung</strong> und vieles mehr. Ein schlechter SCHUFA-Score kann Türen verschließen – deshalb ist es wichtig, Ihre SCHUFA-Daten zu kennen und zu verstehen.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Welche SCHUFA-Schreiben gibt es?
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <HelpCircle className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">SCHUFA-Auskunft (Datenkopie)</h3>
                      <p className="text-sm text-muted-foreground">Übersicht aller über Sie gespeicherten Daten. Einmal pro Jahr kostenlos erhältlich. Zeigt alle Einträge und Ihren Score.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Mitteilung über neue Eintragung</h3>
                      <p className="text-sm text-muted-foreground">Information, dass ein neuer Datensatz in Ihrem Profil eingetragen wurde – positiv oder negativ.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Shield className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Löschungsmitteilung</h3>
                      <p className="text-sm text-muted-foreground">Bestätigung, dass ein Eintrag nach Ablauf der Speicherfrist gelöscht wurde.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So lesen Sie Ihren SCHUFA-Score
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Der SCHUFA-Score wird als Prozentwert angegeben. Je höher der Wert, desto besser Ihre Bonität:
                </p>
                <div className="rounded-lg border overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium text-foreground">Score</th>
                        <th className="text-left p-3 font-medium text-foreground">Bewertung</th>
                        <th className="text-left p-3 font-medium text-foreground">Bedeutung</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-3 text-muted-foreground">97% – 100%</td>
                        <td className="p-3 text-green-600 font-medium">Sehr gut</td>
                        <td className="p-3 text-muted-foreground">Sehr geringes Ausfallrisiko</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-3 text-muted-foreground">90% – 96%</td>
                        <td className="p-3 text-blue-600 font-medium">Gut</td>
                        <td className="p-3 text-muted-foreground">Geringes bis überschaubares Risiko</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-3 text-muted-foreground">80% – 89%</td>
                        <td className="p-3 text-amber-600 font-medium">Befriedigend</td>
                        <td className="p-3 text-muted-foreground">Erhöhtes Risiko, Einschränkungen möglich</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-3 text-muted-foreground">Unter 80%</td>
                        <td className="p-3 text-red-600 font-medium">Kritisch</td>
                        <td className="p-3 text-muted-foreground">Hohes Risiko, viele Ablehnungen wahrscheinlich</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Was tun bei negativem Eintrag?
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Ein negativer SCHUFA-Eintrag ist ärgerlich, aber nicht das Ende. Sie haben Rechte und Handlungsmöglichkeiten:
                </p>
                <ol className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">1</span>
                    <span className="text-muted-foreground"><strong>Prüfen Sie die Richtigkeit:</strong> Stimmen alle Daten? Fehlerhafte Einträge kommen häufiger vor als gedacht.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">2</span>
                    <span className="text-muted-foreground"><strong>Korrektur beantragen:</strong> Bei Fehlern können Sie eine Berichtigung direkt bei der SCHUFA verlangen.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">3</span>
                    <span className="text-muted-foreground"><strong>Schulden begleichen:</strong> Nach vollständiger Zahlung können Sie eine vorzeitige Löschung beantragen.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">4</span>
                    <span className="text-muted-foreground"><strong>Automatische Löschung abwarten:</strong> Die meisten Einträge werden nach 3 Jahren automatisch gelöscht.</span>
                  </li>
                </ol>
                <div className="rounded-lg bg-muted/30 p-6 mb-6">
                  <h3 className="font-medium text-foreground mb-2">💡 Gut zu wissen</h3>
                  <p className="text-sm text-muted-foreground">Seit 2023 gilt: Bezahlte Schulden unter 2.000 € werden nach nur 6 Monaten gelöscht, nicht erst nach 3 Jahren.</p>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So hilft Ihnen Lexora bei SCHUFA-Themen
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Mit <strong>Lexora</strong> laden Sie Ihr SCHUFA-Schreiben hoch und erhalten:
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Verständliche Erklärung aller Einträge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Bewertung Ihres Scores und dessen Bedeutung</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Hinweise auf mögliche fehlerhafte Einträge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Musterschreiben für Korrekturen oder Widerspruch</span>
                  </li>
                </ul>
              </section>

              {/* CTA Section */}
              <section className="rounded-lg bg-primary/5 p-8 text-center">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Sie haben Post von der SCHUFA?
                </h2>
                <p className="mb-6 text-muted-foreground">
                  Laden Sie das Schreiben hoch und erfahren Sie, was es für Sie bedeutet.
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
