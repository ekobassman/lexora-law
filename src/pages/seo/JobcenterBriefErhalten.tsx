import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { Building2, Upload, CheckCircle2, AlertTriangle, Clock, FileText, XCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function JobcenterBriefErhalten() {
  return (
    <>
      <Helmet>
        <title>Brief vom Jobcenter erhalten? Bedeutung, Fristen & was jetzt tun | Lexora</title>
        <meta name="description" content="Brief vom Jobcenter bekommen und unsicher? Lexora erklärt Bedeutung, Fristen und nächste Schritte – verständlich, ruhig und Schritt für Schritt." />
        <link rel="canonical" href="https://lexora-law.com/jobcenter-brief-erhalten" />
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
                  <Building2 className="h-8 w-8" />
                </div>
              </div>
              <h1 className="mb-6 text-3xl font-bold text-foreground md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>
                Brief vom Jobcenter erhalten? Das bedeutet es – und was Sie jetzt tun sollten
              </h1>
              <p className="text-lg text-muted-foreground">
                Verstehen Sie Jobcenter-Schreiben, erkennen Sie wichtige Fristen und reagieren Sie richtig.
              </p>
            </header>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Warum ein Brief vom Jobcenter verunsichert
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Ein Brief vom Jobcenter sorgt bei vielen Menschen sofort für Stress. Oft geht es um Geld, Pflichten oder mögliche Konsequenzen. Viele fragen sich: Habe ich etwas falsch gemacht? Muss ich sofort reagieren?
                </p>
                <div className="rounded-lg bg-muted/30 p-6 mb-6">
                  <p className="text-muted-foreground">
                    <strong>Wichtig ist:</strong> Nicht jeder Brief bedeutet ein Problem, aber ignorieren sollte man ihn nie.
                  </p>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Welche Arten von Schreiben verschickt das Jobcenter?
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Bewilligungs- oder Ablehnungsbescheide</h3>
                      <p className="text-sm text-muted-foreground">Information über die Gewährung oder Ablehnung von Leistungen.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <FileText className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Aufforderungen zur Mitwirkung</h3>
                      <p className="text-sm text-muted-foreground">Aufforderung, Unterlagen einzureichen oder Angaben zu machen.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Clock className="h-5 w-5 text-amber-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Termineinladungen</h3>
                      <p className="text-sm text-muted-foreground">Einladung zu Beratungsgesprächen oder Maßnahmen.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Änderungsmitteilungen</h3>
                      <p className="text-sm text-muted-foreground">Information über Änderungen bei Ihren Leistungen.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <XCircle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Anhörungen oder Rückforderungen</h3>
                      <p className="text-sm text-muted-foreground">Hinweis auf mögliche Rückzahlungen oder Gelegenheit zur Stellungnahme.</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-muted-foreground">
                  Jeder dieser Briefe hat eine andere Bedeutung und unterschiedliche Fristen.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Welche Fristen sind besonders wichtig?
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Fast jeder Jobcenter-Brief enthält Fristen. Diese sind sehr wichtig, denn bei Fristversäumnis kann es zu Kürzung von Leistungen, Rückforderungen oder Sanktionen kommen.
                </p>
                <div className="rounded-lg bg-primary/5 p-6 mb-6">
                  <h3 className="font-medium text-foreground mb-3">💡 Tipp: Immer sofort prüfen</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">Bis wann muss ich reagieren?</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">Was wird konkret von mir verlangt?</span>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Was sollten Sie nach Erhalt eines Jobcenter-Briefs tun?
                </h2>
                <ol className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">1</span>
                    <span className="text-muted-foreground"><strong>Brief vollständig lesen</strong> (auch das Kleingedruckte)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">2</span>
                    <span className="text-muted-foreground"><strong>Fristen markieren</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">3</span>
                    <span className="text-muted-foreground"><strong>Nicht vorschnell antworten</strong>, wenn Sie unsicher sind</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">4</span>
                    <span className="text-muted-foreground"><strong>Prüfen</strong>, ob der Inhalt verständlich und logisch ist</span>
                  </li>
                </ol>
                <div className="rounded-lg bg-muted/30 p-6">
                  <p className="text-sm text-muted-foreground">
                    <strong>Hinweis:</strong> Unverständliche Formulierungen sind häufig und kein persönlicher Fehler.
                  </p>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Häufige Fehler vermeiden
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <span className="text-muted-foreground">Den Brief ignorieren</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <span className="text-muted-foreground">Zu spät reagieren</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <span className="text-muted-foreground">Unüberlegt antworten</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <span className="text-muted-foreground">Fristen falsch einschätzen</span>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Wie Lexora Ihnen helfen kann
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Lexora hilft dabei, Jobcenter-Briefe zu verstehen. Die Plattform erklärt den Inhalt in einfacher Sprache, zeigt wichtige Fristen auf und hilft bei der nächsten Entscheidung.
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Verständliche Erklärung des Briefinhalts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Automatische Erkennung von Fristen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Hinweise auf mögliche Risiken</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Hilfe bei der Formulierung einer Antwort</span>
                  </li>
                </ul>
                <p className="text-muted-foreground">
                  So behalten Sie den Überblick und reagieren sicher.
                </p>
              </section>

              {/* CTA Section */}
              <section className="rounded-lg bg-primary/5 p-8 text-center">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Brief vom Jobcenter erhalten?
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
