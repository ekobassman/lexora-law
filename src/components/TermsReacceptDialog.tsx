import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Shield, AlertTriangle, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { TERMS_VERSION, PRIVACY_VERSION, AGE_POLICY_VERSION } from '@/lib/legalVersions';
import { toast } from 'sonner';

interface TermsReacceptDialogProps {
  userId: string;
  onAccepted: () => void;
  termsOutdated: boolean;
  privacyOutdated: boolean;
  ageNotConfirmed: boolean;
}

export function TermsReacceptDialog({ 
  userId, 
  onAccepted, 
  termsOutdated, 
  privacyOutdated,
  ageNotConfirmed
}: TermsReacceptDialogProps) {
  const { t, isRTL, language } = useLanguage();
  const [accepted, setAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  // If only age needs confirmation, we still need the age checkbox
  const needsAgeCheck = ageNotConfirmed;
  const needsTermsCheck = termsOutdated || privacyOutdated;

  const handleAccept = async () => {
    // Must accept terms if outdated, and must confirm age if needed
    if (needsTermsCheck && !accepted) return;
    if (needsAgeCheck && !ageConfirmed) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updates: Record<string, string | boolean> = {};

      if (termsOutdated) {
        updates.terms_version = TERMS_VERSION;
        updates.terms_accepted_at = now;
      }
      if (privacyOutdated) {
        updates.privacy_version = PRIVACY_VERSION;
        updates.privacy_accepted_at = now;
      }
      if (ageNotConfirmed) {
        updates.age_confirmed = true;
        updates.age_policy_version = AGE_POLICY_VERSION;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        console.error('[TermsReaccept] Update failed:', error);
        toast.error(t('termsReaccept.error') || 'Errore durante il salvataggio. Riprova.');
        setSaving(false);
        return;
      }

      // Insert audit event for legal acceptance
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
      await supabase
        .from('legal_acceptance_events')
        .insert({
          user_id: userId,
          event_type: 'terms_privacy_reaccept',
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          age_policy_version: AGE_POLICY_VERSION,
          user_agent: userAgent,
        });

      toast.success(t('termsReaccept.success') || 'Termini accettati!');
      onAccepted();
    } catch (err) {
      console.error('[TermsReaccept] Exception:', err);
      toast.error(t('termsReaccept.error') || 'Errore durante il salvataggio. Riprova.');
      setSaving(false);
    }
  };

  // i18n content
  const content = {
    de: {
      title: 'Nutzungsbedingungen aktualisiert',
      titleAgeOnly: 'Altersbestätigung erforderlich',
      subtitle: 'Wir haben unsere Bedingungen aktualisiert. Um fortzufahren, lesen und akzeptieren Sie bitte die neuen Versionen.',
      subtitleAgeOnly: 'Lexora ist nicht für Minderjährige bestimmt. Bitte bestätigen Sie, dass Sie mindestens 18 Jahre alt sind.',
      termsLink: 'Nutzungsbedingungen lesen',
      privacyLink: 'Datenschutzerklärung lesen',
      checkbox: 'Ich habe die Nutzungsbedingungen und die Datenschutzerklärung gelesen und akzeptiert.',
      ageCheckbox: 'Ich bestätige, dass ich mindestens 18 Jahre alt bin.',
      button: 'Akzeptieren und fortfahren',
      ageNote: 'Lexora ist nicht für Minderjährige bestimmt. Die Nutzung ist nur Personen ab 18 Jahren gestattet.',
    },
    en: {
      title: 'Terms Updated',
      titleAgeOnly: 'Age Confirmation Required',
      subtitle: 'We have updated our terms. To continue, please read and accept the new versions.',
      subtitleAgeOnly: 'Lexora is not intended for minors. Please confirm that you are at least 18 years old.',
      termsLink: 'Read Terms of Service',
      privacyLink: 'Read Privacy Policy',
      checkbox: 'I have read and accept the Terms of Service and Privacy Policy.',
      ageCheckbox: 'I confirm that I am at least 18 years old.',
      button: 'Accept and Continue',
      ageNote: 'Lexora is not intended for minors. Use is only permitted for persons aged 18 and over.',
    },
    it: {
      title: 'Termini aggiornati',
      titleAgeOnly: 'Conferma età richiesta',
      subtitle: 'Abbiamo aggiornato i nostri termini. Per continuare, leggi e accetta le nuove versioni.',
      subtitleAgeOnly: 'Lexora non è destinata ai minori. Conferma di avere almeno 18 anni.',
      termsLink: 'Leggi i Termini di Servizio',
      privacyLink: 'Leggi l\'Informativa Privacy',
      checkbox: 'Ho letto e accetto i Termini di Servizio e l\'Informativa Privacy.',
      ageCheckbox: 'Confermo di avere almeno 18 anni.',
      button: 'Accetta e continua',
      ageNote: 'Lexora non è destinata ai minori. L\'utilizzo è consentito solo a persone maggiorenni (18+).',
    },
    fr: {
      title: 'Conditions mises à jour',
      titleAgeOnly: 'Confirmation d\'âge requise',
      subtitle: 'Nous avons mis à jour nos conditions. Pour continuer, veuillez lire et accepter les nouvelles versions.',
      subtitleAgeOnly: 'Lexora n\'est pas destiné aux mineurs. Veuillez confirmer que vous avez au moins 18 ans.',
      termsLink: 'Lire les Conditions d\'Utilisation',
      privacyLink: 'Lire la Politique de Confidentialité',
      checkbox: 'J\'ai lu et j\'accepte les Conditions d\'Utilisation et la Politique de Confidentialité.',
      ageCheckbox: 'Je confirme avoir au moins 18 ans.',
      button: 'Accepter et continuer',
      ageNote: 'Lexora n\'est pas destiné aux mineurs. L\'utilisation est réservée aux personnes majeures (18+).',
    },
    es: {
      title: 'Términos actualizados',
      titleAgeOnly: 'Se requiere confirmación de edad',
      subtitle: 'Hemos actualizado nuestros términos. Para continuar, lea y acepte las nuevas versiones.',
      subtitleAgeOnly: 'Lexora no está destinada a menores. Por favor confirme que tiene al menos 18 años.',
      termsLink: 'Leer Términos de Servicio',
      privacyLink: 'Leer Política de Privacidad',
      checkbox: 'He leído y acepto los Términos de Servicio y la Política de Privacidad.',
      ageCheckbox: 'Confirmo que tengo al menos 18 años.',
      button: 'Aceptar y continuar',
      ageNote: 'Lexora no está destinada a menores. El uso está permitido solo para personas de 18 años o más.',
    },
    tr: {
      title: 'Koşullar Güncellendi',
      titleAgeOnly: 'Yaş Onayı Gerekli',
      subtitle: 'Koşullarımızı güncelledik. Devam etmek için lütfen yeni sürümleri okuyun ve kabul edin.',
      subtitleAgeOnly: 'Lexora reşit olmayanlar için tasarlanmamıştır. Lütfen en az 18 yaşında olduğunuzu onaylayın.',
      termsLink: 'Kullanım Koşullarını Oku',
      privacyLink: 'Gizlilik Politikasını Oku',
      checkbox: 'Kullanım Koşullarını ve Gizlilik Politikasını okudum ve kabul ediyorum.',
      ageCheckbox: 'En az 18 yaşında olduğumu onaylıyorum.',
      button: 'Kabul et ve devam et',
      ageNote: 'Lexora reşit olmayanlar için tasarlanmamıştır. Kullanım yalnızca 18 yaş ve üzeri kişilere açıktır.',
    },
    pl: {
      title: 'Warunki zaktualizowane',
      titleAgeOnly: 'Wymagane potwierdzenie wieku',
      subtitle: 'Zaktualizowaliśmy nasze warunki. Aby kontynuować, przeczytaj i zaakceptuj nowe wersje.',
      subtitleAgeOnly: 'Lexora nie jest przeznaczona dla nieletnich. Potwierdź, że masz co najmniej 18 lat.',
      termsLink: 'Przeczytaj Regulamin',
      privacyLink: 'Przeczytaj Politykę Prywatności',
      checkbox: 'Przeczytałem i akceptuję Regulamin i Politykę Prywatności.',
      ageCheckbox: 'Potwierdzam, że mam co najmniej 18 lat.',
      button: 'Zaakceptuj i kontynuuj',
      ageNote: 'Lexora nie jest przeznaczona dla nieletnich. Korzystanie dozwolone tylko dla osób pełnoletnich (18+).',
    },
    ro: {
      title: 'Termeni actualizați',
      titleAgeOnly: 'Se necesită confirmarea vârstei',
      subtitle: 'Am actualizat termenii noștri. Pentru a continua, citiți și acceptați noile versiuni.',
      subtitleAgeOnly: 'Lexora nu este destinată minorilor. Vă rugăm să confirmați că aveți cel puțin 18 ani.',
      termsLink: 'Citește Termenii și Condițiile',
      privacyLink: 'Citește Politica de Confidențialitate',
      checkbox: 'Am citit și accept Termenii și Condițiile și Politica de Confidențialitate.',
      ageCheckbox: 'Confirm că am cel puțin 18 ani.',
      button: 'Acceptă și continuă',
      ageNote: 'Lexora nu este destinată minorilor. Utilizarea este permisă doar persoanelor de peste 18 ani.',
    },
    ru: {
      title: 'Условия обновлены',
      titleAgeOnly: 'Требуется подтверждение возраста',
      subtitle: 'Мы обновили наши условия. Чтобы продолжить, пожалуйста, прочитайте и примите новые версии.',
      subtitleAgeOnly: 'Lexora не предназначена для несовершеннолетних. Пожалуйста, подтвердите, что вам не менее 18 лет.',
      termsLink: 'Читать Условия использования',
      privacyLink: 'Читать Политику конфиденциальности',
      checkbox: 'Я прочитал и принимаю Условия использования и Политику конфиденциальности.',
      ageCheckbox: 'Подтверждаю, что мне не менее 18 лет.',
      button: 'Принять и продолжить',
      ageNote: 'Lexora не предназначена для несовершеннолетних. Использование разрешено только лицам старше 18 лет.',
    },
    uk: {
      title: 'Умови оновлено',
      titleAgeOnly: 'Потрібне підтвердження віку',
      subtitle: 'Ми оновили наші умови. Щоб продовжити, будь ласка, прочитайте та прийміть нові версії.',
      subtitleAgeOnly: 'Lexora не призначена для неповнолітніх. Будь ласка, підтвердіть, що вам не менше 18 років.',
      termsLink: 'Читати Умови використання',
      privacyLink: 'Читати Політику конфіденційності',
      checkbox: 'Я прочитав та приймаю Умови використання та Політику конфіденційності.',
      ageCheckbox: 'Підтверджую, що мені не менше 18 років.',
      button: 'Прийняти та продовжити',
      ageNote: 'Lexora не призначена для неповнолітніх. Використання дозволено лише особам старше 18 років.',
    },
    ar: {
      title: 'تم تحديث الشروط',
      titleAgeOnly: 'مطلوب تأكيد العمر',
      subtitle: 'لقد قمنا بتحديث شروطنا. للمتابعة، يرجى قراءة الإصدارات الجديدة والموافقة عليها.',
      subtitleAgeOnly: 'Lexora غير مخصصة للقاصرين. يرجى تأكيد أن عمرك 18 عامًا على الأقل.',
      termsLink: 'قراءة شروط الخدمة',
      privacyLink: 'قراءة سياسة الخصوصية',
      checkbox: 'لقد قرأت ووافقت على شروط الخدمة وسياسة الخصوصية.',
      ageCheckbox: 'أؤكد أن عمري 18 عامًا على الأقل.',
      button: 'قبول والمتابعة',
      ageNote: 'Lexora غير مخصصة للقاصرين. الاستخدام مسموح فقط للأشخاص الذين تبلغ أعمارهم 18 عامًا أو أكثر.',
    },
  };

  const langKey = language.toLowerCase() as keyof typeof content;
  const texts = content[langKey] || content.it;

  // Determine which title/subtitle to show
  const showTitle = needsAgeCheck && !needsTermsCheck ? texts.titleAgeOnly : texts.title;
  const showSubtitle = needsAgeCheck && !needsTermsCheck ? texts.subtitleAgeOnly : texts.subtitle;

  // Button is enabled when:
  // - If terms/privacy need update: accepted must be true
  // - If age needs confirmation: ageConfirmed must be true
  const canSubmit = 
    (!needsTermsCheck || accepted) && 
    (!needsAgeCheck || ageConfirmed);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/95 backdrop-blur-sm"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md mx-4 p-8 rounded-2xl border border-gold/30 bg-navy shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/10 border-2 border-gold/30">
            <AlertTriangle className="h-8 w-8 text-gold" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-display font-semibold text-ivory text-center mb-3">
          {showTitle}
        </h1>

        {/* Subtitle */}
        <p className="text-ivory/70 text-center mb-6 text-sm leading-relaxed">
          {showSubtitle}
        </p>

        {/* Links to read terms/privacy */}
        {needsTermsCheck && (
          <div className="space-y-3 mb-6">
            {termsOutdated && (
              <Link 
                to="/terms" 
                target="_blank"
                className="flex items-center gap-3 p-4 rounded-lg border border-gold/20 bg-ivory/5 hover:bg-gold/10 transition-colors group"
              >
                <FileText className="h-5 w-5 text-gold" />
                <span className="text-ivory group-hover:text-gold transition-colors">{texts.termsLink}</span>
              </Link>
            )}
            {privacyOutdated && (
              <Link 
                to="/privacy" 
                target="_blank"
                className="flex items-center gap-3 p-4 rounded-lg border border-gold/20 bg-ivory/5 hover:bg-gold/10 transition-colors group"
              >
                <Shield className="h-5 w-5 text-gold" />
                <span className="text-ivory group-hover:text-gold transition-colors">{texts.privacyLink}</span>
              </Link>
            )}
          </div>
        )}

        {/* Age confirmation checkbox */}
        {needsAgeCheck && (
          <div className="flex items-start gap-3 mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Checkbox
              id="confirm-age"
              checked={ageConfirmed}
              onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
              className="mt-0.5 border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
            />
            <div className="flex-1">
              <label 
                htmlFor="confirm-age" 
                className="text-sm text-ivory font-medium cursor-pointer leading-relaxed flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4 text-amber-400" />
                {texts.ageCheckbox}
              </label>
              <p className="mt-1 text-xs text-amber-300/70">
                {texts.ageNote}
              </p>
            </div>
          </div>
        )}

        {/* Terms/Privacy acceptance checkbox */}
        {needsTermsCheck && (
          <div className="flex items-start gap-3 mb-6 p-4 rounded-lg bg-ivory/5 border border-gold/10">
            <Checkbox
              id="accept-terms"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
              className="mt-0.5 border-gold/50 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
            />
            <label 
              htmlFor="accept-terms" 
              className="text-sm text-ivory/80 cursor-pointer leading-relaxed"
            >
              {texts.checkbox}
            </label>
          </div>
        )}

        {/* Accept Button */}
        <Button
          onClick={handleAccept}
          disabled={!canSubmit || saving}
          className="w-full h-12 bg-gold hover:bg-gold/90 text-navy font-semibold text-base"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            texts.button
          )}
        </Button>

        {/* Version info (small) */}
        <p className="text-center text-ivory/30 text-xs mt-4">
          Terms v{TERMS_VERSION} • Privacy v{PRIVACY_VERSION} • Age Policy v{AGE_POLICY_VERSION}
        </p>
      </div>
    </div>
  );
}