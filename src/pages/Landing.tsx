import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { DemoChatSection } from '@/components/DemoChatSection';
import { SocialProofCounter } from '@/components/SocialProofCounter';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Clock, Globe, Sparkles, Shield, FolderOpen, Calendar, ArrowRight } from 'lucide-react';

// Landing page sections
import {
  PricingSection,
  TestimonialsSection,
  SupportedDocumentsSection,
  FAQSection,
  TrustSecuritySection,
  HowItWorksSection,
} from '@/components/landing';

// Hero images
import heroDesktop from '@/assets/hero-desktop.png';
import heroMobile from '@/assets/hero-mobile.png';

// Safe translation helper
function getSafeText(t: (key: string) => string, key: string, fallback: string): string {
  const result = t(key);
  if (!result || result === key || (result.includes('.') && !result.includes(' '))) {
    return fallback;
  }
  return result;
}

export default function Landing() {
  const { t, isRTL } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to /app
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/app', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const txt = {
    heroTitle: getSafeText(t, 'landing.hero.title', 'Behördenschreiben verstehen.\nSouverän antworten.'),
    heroSubtitle: getSafeText(t, 'landing.hero.subtitle', 'KI-gestützte Analyse von Behördenbriefen für Deutschland, Österreich und die Schweiz. Verstehen Sie offizielle Schreiben und erstellen Sie rechtssichere Antworten – in Minuten, nicht Stunden.'),
    ctaUpload: getSafeText(t, 'landing.cta.upload', 'Brief hochladen'),
    ctaStart: getSafeText(t, 'landing.cta.start', 'Kostenlos testen'),
    ctaLogin: getSafeText(t, 'landing.cta.login', 'Anmelden'),
    badgeEurope: getSafeText(t, 'landing.badge.europe', 'DE · AT · CH'),
    badgeLaws: getSafeText(t, 'landing.badge.laws', 'KI basiert auf nationalen Gesetzen'),
    badgeFast: getSafeText(t, 'landing.badge.fast', 'Vom Brief zur Antwort in Minuten'),
    archiveTitle: getSafeText(t, 'home.archive.title', 'Ihr sicheres Aktenarchiv'),
    archiveSubtitle: getSafeText(t, 'home.archive.subtitle', 'Alle Ihre Fälle, Dokumente und rechtlichen Vorgänge an einem sicheren Ort.'),
    archiveCard1Title: getSafeText(t, 'home.archive.card1.title', 'Sicheres Archiv'),
    archiveCard1Text: getSafeText(t, 'home.archive.card1.text', 'Ihre Fälle werden sicher und organisiert gespeichert.'),
    archiveCard2Title: getSafeText(t, 'home.archive.card2.title', 'Immer erreichbar'),
    archiveCard2Text: getSafeText(t, 'home.archive.card2.text', 'Greifen Sie jederzeit auf Ihre Fälle zu – mobil oder am Desktop.'),
    archiveCard3Title: getSafeText(t, 'home.archive.card3.title', 'Verlauf & Exporte'),
    archiveCard3Text: getSafeText(t, 'home.archive.card3.text', 'Entwürfe, Exporte und Aktionen an einem Ort verfolgen.'),
    archiveCard4Title: getSafeText(t, 'home.archive.card4.title', 'Fristen im Blick'),
    archiveCard4Text: getSafeText(t, 'home.archive.card4.text', 'Behalten Sie Fristen im Blick, damit nichts verpasst wird.'),
  };

  const archiveCards = [
    { icon: Shield, title: txt.archiveCard1Title, text: txt.archiveCard1Text },
    { icon: FolderOpen, title: txt.archiveCard2Title, text: txt.archiveCard2Text },
    { icon: Sparkles, title: txt.archiveCard3Title, text: txt.archiveCard3Text },
    { icon: Calendar, title: txt.archiveCard4Title, text: txt.archiveCard4Text },
  ];

  // JSON-LD structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Lexora",
    "applicationCategory": "LegalApplication",
    "operatingSystem": "Web",
    "description": "KI-gestützte Analyse von Behördenbriefen für Deutschland, Österreich und die Schweiz. Verstehen Sie offizielle Schreiben und erstellen Sie rechtssichere Antworten.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "EUR",
      "description": "Kostenloser Plan verfügbar"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "250",
      "bestRating": "5"
    },
    "featureList": [
      "KI-Dokumentenanalyse",
      "Automatische Antwortgenerierung",
      "Fristenverwaltung",
      "PDF-Export",
      "DSGVO-konform"
    ]
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>Lexora - KI-Assistent für Behördenschreiben | Deutschland, Österreich, Schweiz</title>
        <meta name="description" content="Verstehen Sie Behördenbriefe und erstellen Sie rechtssichere Antworten mit KI. Für Steuerbescheide, Bußgelder, Mietrecht und mehr. Kostenlos testen." />
        <meta name="keywords" content="Behördenbrief, KI, Steuerbescheid, Bußgeld, Einspruch, Widerspruch, Deutschland, Österreich, Schweiz, DSGVO" />
        <meta property="og:title" content="Lexora - KI-Assistent für Behördenschreiben" />
        <meta property="og:description" content="Verstehen Sie Behördenbriefe und erstellen Sie rechtssichere Antworten mit KI. Kostenlos testen." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://lexora-law.com" />
        <link rel="canonical" href="https://lexora-law.com" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <Header />
      
      {/* Hero Section - PREMIUM DESIGN */}
      <section className="relative overflow-hidden bg-navy">
        {/* Premium framed hero image - FULL WIDTH */}
        <div className="relative w-full">
          {/* Outer gold border frame */}
          <div className="relative mx-0 md:mx-auto md:max-w-5xl">
            {/* Gold frame decoration */}
            <div className="absolute inset-0 border-4 border-gold/60 rounded-none md:rounded-xl md:m-4 pointer-events-none z-10" />
            <div className="absolute inset-0 border-2 border-gold/30 rounded-none md:rounded-lg md:m-6 pointer-events-none z-10" />
            
            {/* Inner gold corner accents */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-gold z-20 md:m-4 md:rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-gold z-20 md:m-4 md:rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-gold z-20 md:m-4 md:rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-gold z-20 md:m-4 md:rounded-br-xl" />
            
            {/* Image container */}
            <picture>
              <source media="(min-width: 768px)" srcSet={heroDesktop} />
              <img
                src={heroMobile}
                alt="Lexora KI-Assistent für Behördenschreiben"
                className="w-full h-auto object-cover md:rounded-lg md:m-4 md:w-[calc(100%-2rem)]"
                style={{ maxHeight: '70vh' }}
              />
            </picture>
          </div>
        </div>
      </section>

      {/* Content Section - LIGHT BACKGROUND (cream/ivory) */}
      <section className="bg-ivory py-10 md:py-14">
        <div className="container">
          <div className="text-center space-y-6">
            {/* Badges - Navy on light */}
            <div className="flex flex-wrap justify-center gap-2">
              <Badge className="bg-navy border border-navy/20 text-ivory gap-1.5 px-3 py-1.5">
                <Globe className="h-3.5 w-3.5" />
                {txt.badgeEurope}
              </Badge>
              <Badge className="bg-navy border border-navy/20 text-ivory gap-1.5 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {txt.badgeLaws}
              </Badge>
              <Badge className="bg-navy border border-navy/20 text-ivory gap-1.5 px-3 py-1.5">
                <Clock className="h-3.5 w-3.5" />
                {txt.badgeFast}
              </Badge>
            </div>

            {/* Title - Larger and more impactful */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-navy leading-tight whitespace-pre-line max-w-4xl mx-auto">
              {txt.heroTitle}
            </h1>

            {/* Subtitle - Improved with country specifics */}
            <p className="text-lg md:text-xl text-navy/70 max-w-2xl mx-auto leading-relaxed">
              {txt.heroSubtitle}
            </p>

            {/* CTAs - Premium buttons with clear hierarchy */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button size="lg" variant="premium" asChild className="gap-2 text-base px-8 py-6">
                <Link to="/auth?mode=signup">
                  <Upload className="h-5 w-5" />
                  {txt.ctaStart}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-2 border-navy text-navy hover:bg-navy hover:text-ivory text-base px-8 py-6">
                <Link to="/auth">
                  {txt.ctaLogin}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Counter - Below hero CTA */}
      <SocialProofCounter />

      {/* Demo Chat Section - ALWAYS VISIBLE on ALL devices */}
      {/* Note: Terms dialog only shows when user interacts with the chat, not on page load */}
      <DemoChatSection />

      {/* How It Works Section */}
      <HowItWorksSection id="how-it-works" />

      {/* Supported Documents Section */}
      <SupportedDocumentsSection id="documents" />

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Pricing Section */}
      <PricingSection id="pricing" />

      {/* Trust & Security Section */}
      <TrustSecuritySection />

      {/* Archive Section - PREMIUM NAVY/GOLD DESIGN */}
      <section className="py-12 md:py-16 bg-navy">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-ivory mb-2">
              {txt.archiveTitle}
            </h2>
            <p className="text-gold/80 max-w-2xl mx-auto">
              {txt.archiveSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {archiveCards.map((card, i) => (
              <div 
                key={i} 
                className="bg-navy/50 border-2 border-gold/30 rounded-xl p-4 md:p-6 text-center hover:border-gold/60 transition-all hover:shadow-[0_0_20px_rgba(201,162,77,0.2)]"
              >
                {/* Premium icon container */}
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold/40 flex items-center justify-center mx-auto mb-4 shadow-[inset_0_2px_4px_rgba(201,162,77,0.3)]">
                  <card.icon className="h-7 w-7 md:h-8 md:w-8 text-gold" />
                </div>
                <h3 className="font-semibold text-ivory text-sm md:text-base mb-1">
                  {card.title}
                </h3>
                <p className="text-xs md:text-sm text-ivory/60">
                  {card.text}
                </p>
              </div>
            ))}
          </div>

          {/* CTA to sign up - Premium Gold button */}
          <div className="text-center mt-10">
            <Button size="lg" variant="premium" asChild className="gap-2">
              <Link to="/auth?mode=signup">
                {txt.ctaStart}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQSection id="faq" />

      {/* Footer - Expanded version for landing page */}
      <LegalFooter expanded />
    </div>
  );
}
