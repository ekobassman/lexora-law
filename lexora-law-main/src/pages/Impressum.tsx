import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, Scale, MapPin, Building2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContactForm } from '@/components/ContactForm';
import { LegalPageLanguageSwitch } from '@/components/LegalPageLanguageSwitch';

export default function Impressum() {
  const { t, language, isRTL } = useLanguage();
  const location = useLocation();

  // Scroll to anchor on mount or hash change
  useEffect(() => {
    if (location.hash) {
      const element = document.querySelector(location.hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.hash]);

  // Content based on language - DE is legally binding
  const content = {
    de: {
      title: 'Impressum',
      lastUpdated: 'Zuletzt aktualisiert: 27.12.2025',
      contactFormTitle: 'Kontaktformular',
      sections: [
        {
          title: 'Angaben gemäß § 5 TMG',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Deutschland`
        },
        {
          title: 'Umsatzsteuer-ID',
          content: 'USt-IdNr.: DE283171773'
        },
        {
          title: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, Anschrift wie oben'
        },
        {
          title: 'Hinweis',
          content: 'Lexora ist ein digitales Assistenz-Tool zur Unterstützung bei der Erstellung von Entwürfen. Es ersetzt keine Rechtsberatung.'
        }
      ]
    },
    en: {
      title: 'Legal Notice',
      lastUpdated: 'Last updated: 2025-12-27',
      contactFormTitle: 'Contact Form',
      sections: [
        {
          title: 'Information according to § 5 TMG (German law)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Germany`
        },
        {
          title: 'VAT ID',
          content: 'VAT ID: DE283171773'
        },
        {
          title: 'Responsible for content according to § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, address as above'
        },
        {
          title: 'Notice',
          content: 'Lexora is a digital assistance tool for creating drafts. It does not replace legal advice.'
        }
      ]
    },
    it: {
      title: 'Note Legali',
      lastUpdated: 'Ultimo aggiornamento: 27.12.2025',
      contactFormTitle: 'Modulo di Contatto',
      sections: [
        {
          title: 'Informazioni secondo § 5 TMG (legge tedesca)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Germania`
        },
        {
          title: 'Partita IVA',
          content: 'P.IVA: DE283171773'
        },
        {
          title: 'Responsabile del contenuto secondo § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, indirizzo come sopra'
        },
        {
          title: 'Avviso',
          content: 'Lexora è uno strumento di assistenza digitale per la creazione di bozze. Non sostituisce la consulenza legale.'
        }
      ]
    },
    fr: {
      title: 'Mentions Légales',
      lastUpdated: 'Dernière mise à jour : 27.12.2025',
      contactFormTitle: 'Formulaire de Contact',
      sections: [
        {
          title: 'Informations selon § 5 TMG (loi allemande)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Allemagne`
        },
        {
          title: 'Numéro de TVA',
          content: 'N° TVA : DE283171773'
        },
        {
          title: 'Responsable du contenu selon § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, adresse ci-dessus'
        },
        {
          title: 'Avis',
          content: 'Lexora est un outil d\'assistance numérique pour la création de brouillons. Il ne remplace pas le conseil juridique.'
        }
      ]
    },
    es: {
      title: 'Aviso Legal',
      lastUpdated: 'Última actualización: 27.12.2025',
      contactFormTitle: 'Formulario de Contacto',
      sections: [
        {
          title: 'Información según § 5 TMG (ley alemana)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Alemania`
        },
        {
          title: 'NIF/IVA',
          content: 'NIF: DE283171773'
        },
        {
          title: 'Responsable del contenido según § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, dirección como arriba'
        },
        {
          title: 'Aviso',
          content: 'Lexora es una herramienta de asistencia digital para la creación de borradores. No sustituye el asesoramiento legal.'
        }
      ]
    },
    pl: {
      title: 'Nota Prawna',
      lastUpdated: 'Ostatnia aktualizacja: 27.12.2025',
      contactFormTitle: 'Formularz Kontaktowy',
      sections: [
        {
          title: 'Informacje zgodnie z § 5 TMG (prawo niemieckie)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Niemcy`
        },
        {
          title: 'NIP',
          content: 'NIP: DE283171773'
        },
        {
          title: 'Odpowiedzialny za treść zgodnie z § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, adres jak powyżej'
        },
        {
          title: 'Uwaga',
          content: 'Lexora jest narzędziem cyfrowej pomocy do tworzenia projektów. Nie zastępuje porady prawnej.'
        }
      ]
    },
    ro: {
      title: 'Informații Legale',
      lastUpdated: 'Ultima actualizare: 27.12.2025',
      contactFormTitle: 'Formular de Contact',
      sections: [
        {
          title: 'Informații conform § 5 TMG (legea germană)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Germania`
        },
        {
          title: 'CUI/TVA',
          content: 'CUI: DE283171773'
        },
        {
          title: 'Responsabil pentru conținut conform § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, adresa ca mai sus'
        },
        {
          title: 'Notă',
          content: 'Lexora este un instrument de asistență digitală pentru crearea proiectelor. Nu înlocuiește consultanța juridică.'
        }
      ]
    },
    tr: {
      title: 'Yasal Bildirim',
      lastUpdated: 'Son güncelleme: 27.12.2025',
      contactFormTitle: 'İletişim Formu',
      sections: [
        {
          title: '§ 5 TMG\'ye göre bilgiler (Alman hukuku)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Almanya`
        },
        {
          title: 'KDV Numarası',
          content: 'KDV No: DE283171773'
        },
        {
          title: '§ 18 Abs. 2 MStV\'ye göre içerikten sorumlu',
          content: 'Roberto Imbimbo, yukarıdaki adres'
        },
        {
          title: 'Uyarı',
          content: 'Lexora, taslak oluşturmak için dijital bir yardım aracıdır. Hukuki danışmanlığın yerini tutmaz.'
        }
      ]
    },
    ru: {
      title: 'Юридическая Информация',
      lastUpdated: 'Последнее обновление: 27.12.2025',
      contactFormTitle: 'Контактная Форма',
      sections: [
        {
          title: 'Информация согласно § 5 TMG (немецкое законодательство)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Германия`
        },
        {
          title: 'ИНН',
          content: 'ИНН: DE283171773'
        },
        {
          title: 'Ответственный за содержание согласно § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, адрес как указано выше'
        },
        {
          title: 'Примечание',
          content: 'Lexora — это инструмент цифровой помощи для создания черновиков. Он не заменяет юридическую консультацию.'
        }
      ]
    },
    uk: {
      title: 'Юридична Інформація',
      lastUpdated: 'Останнє оновлення: 27.12.2025',
      contactFormTitle: 'Контактна Форма',
      sections: [
        {
          title: 'Інформація згідно з § 5 TMG (німецьке законодавство)',
          content: `Roberto Imbimbo
Mörikestraße 10
72202 Nagold
Німеччина`
        },
        {
          title: 'ІПН',
          content: 'ІПН: DE283171773'
        },
        {
          title: 'Відповідальний за вміст згідно з § 18 Abs. 2 MStV',
          content: 'Roberto Imbimbo, адреса як вказано вище'
        },
        {
          title: 'Примітка',
          content: 'Lexora — це інструмент цифрової допомоги для створення чернеток. Він не замінює юридичну консультацію.'
        }
      ]
    },
    ar: {
      title: 'الإشعار القانوني',
      lastUpdated: 'آخر تحديث: 27.12.2025',
      contactFormTitle: 'نموذج الاتصال',
      sections: [
        {
          title: 'المعلومات وفقاً لـ § 5 TMG (القانون الألماني)',
          content: `روبرتو إيمبيمبو
Mörikestraße 10
72202 Nagold
ألمانيا`
        },
        {
          title: 'الرقم الضريبي',
          content: 'رقم ضريبة القيمة المضافة: DE283171773'
        },
        {
          title: 'المسؤول عن المحتوى وفقاً لـ § 18 Abs. 2 MStV',
          content: 'روبرتو إيمبيمبو، العنوان كما هو مذكور أعلاه'
        },
        {
          title: 'ملاحظة',
          content: 'Lexora هي أداة مساعدة رقمية لإنشاء المسودات. لا تحل محل الاستشارة القانونية.'
        }
      ]
    }
  };

  // Fallback to DE (not EN) per requirements
  // Convert uppercase language code to lowercase for content lookup
  const langKey = language.toLowerCase();
  const currentContent = content[langKey as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-navy" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b border-gold/20">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              <span className="relative font-display text-sm font-semibold text-gold">L</span>
            </div>
            <span className="font-display text-lg font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </Link>
          <div className="flex items-center gap-4">
            <LegalPageLanguageSwitch variant="dark" />
            <Button variant="ghost" size="sm" asChild className="text-ivory/70 hover:text-gold hover:bg-transparent">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('common.back')}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-12 px-4">
        {/* Title */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <Scale className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-medium text-ivory">{currentContent.title}</h1>
            <p className="text-sm text-ivory/50 mt-1">{currentContent.lastUpdated}</p>
          </div>
        </div>

        {/* Content sections */}
        <div className="space-y-6">
          {currentContent.sections.map((section, index) => (
            <section key={index} className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
                {index === 0 && <Building2 className="h-5 w-5" />}
                {index === 1 && <Scale className="h-5 w-5" />}
                {index > 1 && <MapPin className="h-5 w-5" />}
                {section.title}
              </h2>
              <p className="text-ivory/80 whitespace-pre-line leading-relaxed">{section.content}</p>
            </section>
          ))}

          {/* Contact Form Section */}
          <section id="contact-form" className="rounded-lg border border-gold/20 bg-ivory/5 p-6 scroll-mt-24">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gold">
              <MessageSquare className="h-5 w-5" />
              {currentContent.contactFormTitle}
            </h2>
            <ContactForm />
          </section>
        </div>

        {/* Back link */}
        <div className="mt-12 text-center">
          <Link to="/" className="text-sm text-ivory/50 hover:text-gold transition-colors">
            ← {t('common.back')}
          </Link>
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t border-gold/20 py-6">
        <div className="container text-center">
          <p className="text-sm text-ivory/40">© {new Date().getFullYear()} LEXORA</p>
        </div>
      </footer>
    </div>
  );
}
