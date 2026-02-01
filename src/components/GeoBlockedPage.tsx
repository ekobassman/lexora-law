import { useLanguage } from '@/contexts/LanguageContext';
import { Globe, AlertTriangle, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GeoBlockedPageProps {
  countryCode?: string;
}

export function GeoBlockedPage({ countryCode }: GeoBlockedPageProps) {
  const { language, isRTL } = useLanguage();

  // Updated legal text as per requirements
  const content: Record<string, { title: string; message: string; termsLink: string; contact: string }> = {
    de: {
      title: 'Lexora ist in Ihrer Gerichtsbarkeit nicht verfügbar',
      message: 'Aus rechtlichen und regulatorischen Gründen ist Lexora in Ihrer Gerichtsbarkeit nicht verfügbar. Der Zugang und die Nutzung des Dienstes sind von diesem Standort aus nicht gestattet.',
      termsLink: 'Nutzungsbedingungen lesen',
      contact: 'Bei Fragen kontaktieren Sie uns über das Impressum.'
    },
    en: {
      title: 'Lexora is not available in your jurisdiction',
      message: 'For legal and regulatory compliance reasons, Lexora is not available in your jurisdiction. Access and use of the service are not authorized from this location.',
      termsLink: 'Read Terms of Service',
      contact: 'For questions, contact us via the Impressum.'
    },
    it: {
      title: 'Lexora non è disponibile nella tua giurisdizione',
      message: 'Per motivi legali e di conformità normativa, Lexora non è disponibile nella tua giurisdizione. L\'accesso e l\'uso del servizio non sono autorizzati da questa località.',
      termsLink: 'Leggi i Termini di Servizio',
      contact: 'Per domande, contattaci tramite l\'Impressum.'
    },
    fr: {
      title: 'Lexora n\'est pas disponible dans votre juridiction',
      message: 'Pour des raisons légales et de conformité réglementaire, Lexora n\'est pas disponible dans votre juridiction. L\'accès et l\'utilisation du service ne sont pas autorisés depuis cet emplacement.',
      termsLink: 'Lire les Conditions d\'Utilisation',
      contact: 'Pour toute question, contactez-nous via l\'Impressum.'
    },
    es: {
      title: 'Lexora no está disponible en tu jurisdicción',
      message: 'Por motivos legales y de cumplimiento normativo, Lexora no está disponible en tu jurisdicción. El acceso y uso del servicio no están autorizados desde esta ubicación.',
      termsLink: 'Leer Términos de Servicio',
      contact: 'Para preguntas, contáctenos a través del Impressum.'
    },
    tr: {
      title: 'Lexora yargı bölgenizde kullanılamıyor',
      message: 'Yasal ve düzenleyici uyumluluk nedenleriyle Lexora yargı bölgenizde kullanılamıyor. Bu konumdan hizmete erişim ve kullanım yetkisi verilmemiştir.',
      termsLink: 'Kullanım Koşullarını Oku',
      contact: 'Sorularınız için Impressum üzerinden bizimle iletişime geçin.'
    },
    pl: {
      title: 'Lexora nie jest dostępna w Twojej jurysdykcji',
      message: 'Ze względów prawnych i zgodności z przepisami Lexora nie jest dostępna w Twojej jurysdykcji. Dostęp i korzystanie z usługi nie są autoryzowane z tej lokalizacji.',
      termsLink: 'Przeczytaj Regulamin',
      contact: 'W przypadku pytań skontaktuj się z nami przez Impressum.'
    },
    ro: {
      title: 'Lexora nu este disponibilă în jurisdicția ta',
      message: 'Din motive legale și de conformitate reglementară, Lexora nu este disponibilă în jurisdicția ta. Accesul și utilizarea serviciului nu sunt autorizate din această locație.',
      termsLink: 'Citește Termenii și Condițiile',
      contact: 'Pentru întrebări, contactați-ne prin Impressum.'
    },
    ru: {
      title: 'Lexora недоступна в вашей юрисдикции',
      message: 'По юридическим и нормативным причинам Lexora недоступна в вашей юрисдикции. Доступ и использование сервиса не разрешены с этого местоположения.',
      termsLink: 'Читать Условия использования',
      contact: 'По вопросам обращайтесь через Impressum.'
    },
    uk: {
      title: 'Lexora недоступна у вашій юрисдикції',
      message: 'З правових та регуляторних причин Lexora недоступна у вашій юрисдикції. Доступ та використання сервісу не дозволені з цієї локації.',
      termsLink: 'Читати Умови використання',
      contact: 'З питань звертайтеся через Impressum.'
    },
    ar: {
      title: 'Lexora غير متوفرة في ولايتك القضائية',
      message: 'لأسباب قانونية وتنظيمية، Lexora غير متوفرة في ولايتك القضائية. الوصول إلى الخدمة واستخدامها غير مصرح بهما من هذا الموقع.',
      termsLink: 'قراءة شروط الخدمة',
      contact: 'للاستفسارات، تواصل معنا عبر Impressum.'
    },
  };

  const langKey = language.toLowerCase() as keyof typeof content;
  const texts = content[langKey] || content.en;

  return (
    <div 
      className="min-h-screen bg-navy flex items-center justify-center p-4"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              <span className="relative font-display text-lg font-semibold text-gold">L</span>
            </div>
            <span className="font-display text-xl font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </div>
        </div>

        {/* Block Card */}
        <div className="bg-navy border-2 border-destructive/50 rounded-2xl p-8 shadow-xl">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border-2 border-destructive/30">
              <Globe className="h-10 w-10 text-destructive" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-display font-semibold text-ivory text-center mb-4">
            {texts.title}
          </h1>

          {/* Message */}
          <p className="text-ivory/70 text-center text-sm leading-relaxed mb-6">
            {texts.message}
          </p>

          {/* Warning with country code */}
          {countryCode && countryCode !== 'unknown' && (
            <div className="flex items-center justify-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20 mb-6">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive font-medium">
                HTTP 451 · Country: {countryCode}
              </span>
            </div>
          )}

          {/* Links */}
          <div className="space-y-3">
            <Link 
              to="/terms" 
              className="flex items-center justify-center gap-2 w-full p-3 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/10 transition-colors text-gold"
            >
              <Scale className="h-4 w-4" />
              {texts.termsLink}
            </Link>
            
            <p className="text-center text-xs text-ivory/40">
              {texts.contact}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ivory/30 mt-6">
          © {new Date().getFullYear()} LEXORA
        </p>
      </div>
    </div>
  );
}
