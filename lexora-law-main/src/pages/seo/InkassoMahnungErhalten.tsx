import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { AlertCircle, Upload, CheckCircle2, AlertTriangle, XCircle, Shield } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function InkassoMahnungErhalten() {
  return (
    <>
      <Helmet>
        <title>Inkasso Mahnung erhalten? Was tun & richtig reagieren | Lexora</title>
        <meta name="description" content="Inkasso-Mahnung erhalten? Lexora erklärt, was sie bedeutet, welche Fristen gelten und wie Sie korrekt reagieren – einfach & rechtssicher." />
        <link rel="canonical" href="https://lexora-law.com/inkasso-mahnung-erhalten" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-12 md:py-16">
          <article className="mx-auto max-w-3xl">
            {/* Hero Section */}
            <header className="mb-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                  <AlertCircle className="h-8 w-8" />
                </div>
              </div>
              <h1 className="mb-6 text-3xl font-bold text-foreground md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>
                Inkasso-Mahnung erhalten? So reagieren Sie richtig.
              </h1>
              <p className="text-lg text-muted-foreground">
                Praktische Anleitung zum Umgang mit Mahnungen und Inkasso-Schreiben in Deutschland.
              </p>
            </header>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Was bedeuten Mahnung und Inkasso?
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Eine <strong>Mahnung</strong> ist eine Zahlungserinnerung für eine offene Rechnung. Wenn Sie nicht reagieren, folgen meist weitere Mahnungen mit steigenden Gebühren. Nach der dritten Mahnung wird die Forderung oft an ein <strong>Inkassobüro</strong> übergeben.
                </p>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  <strong>Inkasso</strong> bedeutet, dass ein spezialisiertes Unternehmen im Auftrag des Gläubigers die Schuld eintreibt. Dabei entstehen zusätzliche Kosten – manchmal berechtigt, manchmal überhöht.
                </p>
                <div className="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-4 my-6">
                  <p className="text-sm text-foreground font-medium">⚠️ Wichtig</p>
                  <p className="text-sm text-muted-foreground">Nicht jede Inkasso-Forderung ist berechtigt. Betrügerische Inkasso-Schreiben sind keine Seltenheit. Prüfen Sie jede Forderung sorgfältig!</p>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Die typischen Mahnstufen
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-600 font-bold text-sm">1</span>
                    <div>
                      <h3 className="font-medium text-foreground">1. Mahnung (Zahlungserinnerung)</h3>
                      <p className="text-sm text-muted-foreground">Freundliche Erinnerung an die offene Zahlung. Meist noch keine zusätzlichen Kosten.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-orange-600 font-bold text-sm">2</span>
                    <div>
                      <h3 className="font-medium text-foreground">2. Mahnung</h3>
                      <p className="text-sm text-muted-foreground">Ernsterer Ton, möglicherweise Mahngebühren und Verzugszinsen. Frist wird gesetzt.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-600 font-bold text-sm">3</span>
                    <div>
                      <h3 className="font-medium text-foreground">3. Mahnung / Letzte Mahnung</h3>
                      <p className="text-sm text-muted-foreground">Letzte Warnung vor Inkasso oder gerichtlichem Mahnverfahren. Kurze Zahlungsfrist.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Inkasso-Schreiben</h3>
                      <p className="text-sm text-muted-foreground">Die Forderung wurde an ein Inkassounternehmen übergeben. Deutlich höhere Kosten.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So prüfen Sie eine Inkasso-Forderung
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Bevor Sie zahlen, sollten Sie diese Punkte prüfen:
                </p>
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Existiert die Schuld?</span>
                      <p className="text-sm text-muted-foreground">Haben Sie tatsächlich etwas bestellt oder einen Vertrag abgeschlossen?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Wurde bereits gezahlt?</span>
                      <p className="text-sm text-muted-foreground">Suchen Sie nach Belegen oder Kontoauszügen. Doppelte Forderungen kommen vor.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Sind die Kosten angemessen?</span>
                      <p className="text-sm text-muted-foreground">Inkassokosten dürfen nicht willkürlich sein. Überhöhte Gebühren können Sie beanstanden.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <span className="font-medium text-foreground">Ist die Forderung verjährt?</span>
                      <p className="text-sm text-muted-foreground">Viele Forderungen verjähren nach 3 Jahren. Bei Verjährung müssen Sie nicht zahlen.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Ihre Rechte gegenüber Inkasso
                </h2>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground"><strong>Nachweis verlangen:</strong> Sie können einen Beleg für die Forderung anfordern</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground"><strong>Ratenzahlung vereinbaren:</strong> Bei echten Schulden können Sie Raten anbieten</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground"><strong>Kein Hausbesuch:</strong> Inkasso darf nicht unangemeldet erscheinen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-muted-foreground"><strong>Keine Drohungen:</strong> Einschüchterung ist verboten</span>
                  </li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So reagieren Sie auf Inkasso-Briefe
                </h2>
                <ol className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">1</span>
                    <span className="text-muted-foreground"><strong>Nicht ignorieren:</strong> Auch bei falschen Forderungen sollten Sie reagieren, um SCHUFA-Einträge zu vermeiden.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">2</span>
                    <span className="text-muted-foreground"><strong>Forderung prüfen:</strong> Ist sie berechtigt? Stimmt der Betrag? Sind Kosten angemessen?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">3</span>
                    <span className="text-muted-foreground"><strong>Schriftlich antworten:</strong> Bei Widerspruch immer schriftlich und per Einschreiben.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">4</span>
                    <span className="text-muted-foreground"><strong>Fristen beachten:</strong> Bei gerichtlichem Mahnbescheid haben Sie nur 2 Wochen für Widerspruch.</span>
                  </li>
                </ol>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So hilft Ihnen Lexora
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Laden Sie Ihre Mahnung oder Ihren Inkasso-Brief bei <strong>Lexora</strong> hoch und erhalten Sie:
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Prüfung der Rechtmäßigkeit der Forderung</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Analyse der berechneten Kosten und Zinsen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Musterschreiben für Widerspruch oder Antwort</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Handlungsempfehlungen für Ihre Situation</span>
                  </li>
                </ul>
              </section>

              {/* CTA Section */}
              <section className="rounded-lg bg-primary/5 p-8 text-center">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Mahnung oder Inkasso-Brief erhalten?
                </h2>
                <p className="mb-6 text-muted-foreground">
                  Laden Sie das Schreiben hoch und erfahren Sie, ob die Forderung berechtigt ist.
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
