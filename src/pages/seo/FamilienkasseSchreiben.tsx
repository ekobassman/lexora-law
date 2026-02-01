import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { Baby, Upload, CheckCircle2, AlertTriangle, Euro, FileCheck } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function FamilienkasseSchreiben() {
  return (
    <>
      <Helmet>
        <title>Brief von der Familienkasse erhalten? Erklärung & Hilfe | Lexora</title>
        <meta name="description" content="Brief von der Familienkasse bekommen? Lexora erklärt Bedeutung, Fristen und nächste Schritte – verständlich und sicher." />
        <link rel="canonical" href="https://lexora-law.com/familienkasse-schreiben" />
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
                  <Baby className="h-8 w-8" />
                </div>
              </div>
              <h1 className="mb-6 text-3xl font-bold text-foreground md:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>
                Schreiben von der Familienkasse erhalten?
              </h1>
              <p className="text-lg text-muted-foreground">
                Alles über Bescheide der Familienkasse, Kindergeld-Anträge und was bei Problemen zu tun ist.
              </p>
            </header>

            {/* Content */}
            <div className="prose prose-lg max-w-none">
              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Was ist die Familienkasse?
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Die <strong>Familienkasse</strong> gehört zur Bundesagentur für Arbeit und ist für die Auszahlung des <strong>Kindergeldes</strong> zuständig. Sie bearbeitet Anträge, prüft die Voraussetzungen und informiert Sie über Änderungen.
                </p>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Briefe von der Familienkasse können verschiedene Themen betreffen: Bewilligung, Änderung, Aufforderung zur Mitwirkung oder auch Rückforderungen. Es ist wichtig, jeden Brief genau zu lesen und fristgerecht zu reagieren.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Typische Schreiben der Familienkasse
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <Euro className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Bewilligungsbescheid</h3>
                      <p className="text-sm text-muted-foreground">Gute Nachricht: Ihr Kindergeld-Antrag wurde genehmigt. Der Bescheid zeigt den Betrag und ab wann gezahlt wird.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Aufhebungs- oder Änderungsbescheid</h3>
                      <p className="text-sm text-muted-foreground">Die Familienkasse ändert oder beendet Ihre Kindergeldzahlung. Gründe können Volljährigkeit, Ende der Ausbildung oder fehlende Nachweise sein.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <FileCheck className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Mitwirkungsaufforderung</h3>
                      <p className="text-sm text-muted-foreground">Die Familienkasse benötigt Unterlagen von Ihnen – z.B. Schulbescheinigung, Ausbildungsnachweis oder Einkommensnachweise.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border p-4">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-medium text-foreground">Rückforderungsbescheid</h3>
                      <p className="text-sm text-muted-foreground">Sie sollen Kindergeld zurückzahlen, das zu Unrecht gezahlt wurde. Prüfen Sie den Bescheid genau – Widerspruch ist möglich.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  Aktuelles Kindergeld 2024
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Seit 2023 beträgt das Kindergeld einheitlich <strong>250 € pro Monat und Kind</strong>. Es wird unabhängig von der Kinderzahl gezahlt – vom ersten bis zum letzten Kind derselbe Betrag.
                </p>
                <div className="rounded-lg bg-muted/30 p-6 mb-6">
                  <h3 className="font-medium text-foreground mb-3">Voraussetzungen für Kindergeld:</h3>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Wohnsitz oder Arbeitsplatz in Deutschland</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Kind lebt im eigenen Haushalt</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Kind ist unter 18 Jahren (oder bis 25 bei Ausbildung/Studium)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Steuer-ID des Kindes wurde mitgeteilt</span>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So reagieren Sie auf Familienkasse-Schreiben
                </h2>
                <ol className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">1</span>
                    <span className="text-muted-foreground"><strong>Brief sorgfältig lesen:</strong> Was genau wird von Ihnen verlangt? Gibt es eine Frist?</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">2</span>
                    <span className="text-muted-foreground"><strong>Kindergeld-Nummer notieren:</strong> Diese Nummer finden Sie oben im Brief – sie ist für jede Kommunikation wichtig.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">3</span>
                    <span className="text-muted-foreground"><strong>Unterlagen sammeln:</strong> Stellen Sie alle angeforderten Nachweise zusammen.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">4</span>
                    <span className="text-muted-foreground"><strong>Fristgerecht antworten:</strong> Senden Sie Ihre Antwort vor Ablauf der Frist – am besten per Einschreiben.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium flex-shrink-0">5</span>
                    <span className="text-muted-foreground"><strong>Bei Problemen Widerspruch einlegen:</strong> Sie haben einen Monat Zeit für einen Widerspruch gegen Bescheide.</span>
                  </li>
                </ol>
              </section>

              <section className="mb-10">
                <h2 className="mb-4 text-2xl font-semibold text-foreground">
                  So unterstützt Sie Lexora
                </h2>
                <p className="mb-4 text-muted-foreground leading-relaxed">
                  Laden Sie Ihren Familienkasse-Brief bei <strong>Lexora</strong> hoch und erhalten Sie:
                </p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Klare Erklärung, was von Ihnen verlangt wird</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Liste der benötigten Unterlagen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Entwurf für Ihre Antwort oder Ihren Widerspruch</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-muted-foreground">Erinnerung an wichtige Fristen</span>
                  </li>
                </ul>
              </section>

              {/* CTA Section */}
              <section className="rounded-lg bg-primary/5 p-8 text-center">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Brief von der Familienkasse erhalten?
                </h2>
                <p className="mb-6 text-muted-foreground">
                  Laden Sie ihn bei Lexora hoch und erfahren Sie, was zu tun ist.
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
