import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, FileText, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AnonymousTermsDialogProps {
  open: boolean;
  onAccept: () => void;
}

export function AnonymousTermsDialog({ open, onAccept }: AnonymousTermsDialogProps) {
  const { t, language, isRTL } = useLanguage();
  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    ageConfirm: false,
  });

  const allChecked = Object.values(consents).every(Boolean);

  const handleAccept = () => {
    if (allChecked) {
      onAccept();
    }
  };

  // Localized labels
  const labels: Record<string, {
    title: string;
    subtitle: string;
    terms: string;
    privacy: string;
    age: string;
    accept: string;
    termsLink: string;
    privacyLink: string;
  }> = {
    de: {
      title: 'Nutzungsbedingungen',
      subtitle: 'Bitte akzeptieren Sie die folgenden Bedingungen, um fortzufahren.',
      terms: 'Ich akzeptiere die Nutzungsbedingungen',
      privacy: 'Ich akzeptiere die Datenschutzerklärung',
      age: 'Ich bestätige, dass ich mindestens 18 Jahre alt bin',
      accept: 'Akzeptieren & Fortfahren',
      termsLink: 'Nutzungsbedingungen',
      privacyLink: 'Datenschutz',
    },
    en: {
      title: 'Terms of Use',
      subtitle: 'Please accept the following terms to continue.',
      terms: 'I accept the Terms of Service',
      privacy: 'I accept the Privacy Policy',
      age: 'I confirm that I am at least 18 years old',
      accept: 'Accept & Continue',
      termsLink: 'Terms of Service',
      privacyLink: 'Privacy Policy',
    },
    it: {
      title: 'Condizioni d\'uso',
      subtitle: 'Accetta le seguenti condizioni per continuare.',
      terms: 'Accetto i Termini di Servizio',
      privacy: 'Accetto l\'Informativa sulla Privacy',
      age: 'Confermo di avere almeno 18 anni',
      accept: 'Accetta e continua',
      termsLink: 'Termini di Servizio',
      privacyLink: 'Privacy',
    },
    fr: {
      title: 'Conditions d\'utilisation',
      subtitle: 'Veuillez accepter les conditions suivantes pour continuer.',
      terms: 'J\'accepte les Conditions d\'utilisation',
      privacy: 'J\'accepte la Politique de confidentialité',
      age: 'Je confirme avoir au moins 18 ans',
      accept: 'Accepter et continuer',
      termsLink: 'Conditions',
      privacyLink: 'Confidentialité',
    },
    es: {
      title: 'Condiciones de uso',
      subtitle: 'Por favor, acepta las siguientes condiciones para continuar.',
      terms: 'Acepto los Términos de Servicio',
      privacy: 'Acepto la Política de Privacidad',
      age: 'Confirmo que tengo al menos 18 años',
      accept: 'Aceptar y continuar',
      termsLink: 'Términos',
      privacyLink: 'Privacidad',
    },
    pl: {
      title: 'Warunki korzystania',
      subtitle: 'Zaakceptuj poniższe warunki, aby kontynuować.',
      terms: 'Akceptuję Regulamin',
      privacy: 'Akceptuję Politykę Prywatności',
      age: 'Potwierdzam, że mam co najmniej 18 lat',
      accept: 'Akceptuję i kontynuuję',
      termsLink: 'Regulamin',
      privacyLink: 'Prywatność',
    },
    ro: {
      title: 'Condiții de utilizare',
      subtitle: 'Vă rugăm să acceptați următoarele condiții pentru a continua.',
      terms: 'Accept Termenii și Condițiile',
      privacy: 'Accept Politica de Confidențialitate',
      age: 'Confirm că am cel puțin 18 ani',
      accept: 'Accept și continuă',
      termsLink: 'Termeni',
      privacyLink: 'Confidențialitate',
    },
    tr: {
      title: 'Kullanım Koşulları',
      subtitle: 'Devam etmek için aşağıdaki koşulları kabul edin.',
      terms: 'Kullanım Koşullarını kabul ediyorum',
      privacy: 'Gizlilik Politikasını kabul ediyorum',
      age: 'En az 18 yaşında olduğumu onaylıyorum',
      accept: 'Kabul Et ve Devam Et',
      termsLink: 'Koşullar',
      privacyLink: 'Gizlilik',
    },
    ar: {
      title: 'شروط الاستخدام',
      subtitle: 'يرجى قبول الشروط التالية للمتابعة.',
      terms: 'أوافق على شروط الخدمة',
      privacy: 'أوافق على سياسة الخصوصية',
      age: 'أؤكد أن عمري 18 عامًا على الأقل',
      accept: 'قبول ومتابعة',
      termsLink: 'الشروط',
      privacyLink: 'الخصوصية',
    },
    uk: {
      title: 'Умови використання',
      subtitle: 'Будь ласка, прийміть наступні умови для продовження.',
      terms: 'Я приймаю Умови використання',
      privacy: 'Я приймаю Політику конфіденційності',
      age: 'Підтверджую, що мені є щонайменше 18 років',
      accept: 'Прийняти і продовжити',
      termsLink: 'Умови',
      privacyLink: 'Конфіденційність',
    },
    ru: {
      title: 'Условия использования',
      subtitle: 'Пожалуйста, примите следующие условия для продолжения.',
      terms: 'Я принимаю Условия использования',
      privacy: 'Я принимаю Политику конфиденциальности',
      age: 'Подтверждаю, что мне исполнилось 18 лет',
      accept: 'Принять и продолжить',
      termsLink: 'Условия',
      privacyLink: 'Конфиденциальность',
    },
  };

  const lang = language.toLowerCase();
  const txt = labels[lang] || labels.de;

  const consentItems = [
    {
      key: 'terms',
      icon: FileText,
      text: txt.terms,
      link: '/terms',
      linkText: txt.termsLink,
    },
    {
      key: 'privacy',
      icon: Shield,
      text: txt.privacy,
      link: '/privacy',
      linkText: txt.privacyLink,
    },
    {
      key: 'ageConfirm',
      icon: UserCheck,
      text: txt.age,
      link: null,
      linkText: null,
    },
  ];

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{txt.title}</DialogTitle>
          <DialogDescription className="text-center">{txt.subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {consentItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  id={`anon-${item.key}`}
                  checked={consents[item.key as keyof typeof consents]}
                  onCheckedChange={(checked) =>
                    setConsents((prev) => ({ ...prev, [item.key]: checked === true }))
                  }
                />
                <div className="flex flex-1 items-start gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <Label
                    htmlFor={`anon-${item.key}`}
                    className="cursor-pointer text-sm leading-relaxed"
                  >
                    {item.text}
                    {item.link && (
                      <>
                        {' '}
                        <Link
                          to={item.link}
                          target="_blank"
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ({item.linkText})
                        </Link>
                      </>
                    )}
                  </Label>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={handleAccept} disabled={!allChecked} className="w-full" size="lg">
            {txt.accept}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
