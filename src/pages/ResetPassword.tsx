import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

// Translations for 12 languages
const translations: Record<string, {
  title: string;
  subtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  sendBtn: string;
  backToLogin: string;
  successTitle: string;
  successMsg: string;
  errorInvalid: string;
  errorGeneric: string;
}> = {
  de: {
    title: 'Passwort zurücksetzen',
    subtitle: 'Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen.',
    emailLabel: 'E-Mail',
    emailPlaceholder: 'ihre@email.de',
    sendBtn: 'Link senden',
    backToLogin: 'Zurück zum Login',
    successTitle: 'E-Mail gesendet',
    successMsg: 'Wir haben dir einen Link zum Zurücksetzen gesendet.',
    errorInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    errorGeneric: 'Fehler beim Senden. Bitte versuchen Sie es erneut.',
  },
  en: {
    title: 'Reset password',
    subtitle: 'Enter your email address and we\'ll send you a link to reset it.',
    emailLabel: 'Email',
    emailPlaceholder: 'your@email.com',
    sendBtn: 'Send link',
    backToLogin: 'Back to login',
    successTitle: 'Email sent',
    successMsg: 'We sent you a password reset link.',
    errorInvalid: 'Please enter a valid email address',
    errorGeneric: 'Error sending link. Please try again.',
  },
  it: {
    title: 'Recupera password',
    subtitle: 'Inserisci la tua email e ti invieremo un link per reimpostarla.',
    emailLabel: 'Email',
    emailPlaceholder: 'tua@email.it',
    sendBtn: 'Invia link',
    backToLogin: 'Torna al login',
    successTitle: 'Email inviata',
    successMsg: 'Ti abbiamo inviato un link per reimpostare la password.',
    errorInvalid: 'Inserisci un indirizzo email valido',
    errorGeneric: 'Errore nell\'invio. Riprova.',
  },
  fr: {
    title: 'Réinitialiser le mot de passe',
    subtitle: 'Entrez votre email et nous vous enverrons un lien de réinitialisation.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'votre@email.fr',
    sendBtn: 'Envoyer le lien',
    backToLogin: 'Retour à la connexion',
    successTitle: 'Email envoyé',
    successMsg: 'Nous avons envoyé un lien de réinitialisation.',
    errorInvalid: 'Veuillez entrer une adresse email valide',
    errorGeneric: 'Erreur lors de l\'envoi. Veuillez réessayer.',
  },
  es: {
    title: 'Restablecer contraseña',
    subtitle: 'Introduce tu email y te enviaremos un enlace para restablecerla.',
    emailLabel: 'Correo',
    emailPlaceholder: 'tu@email.es',
    sendBtn: 'Enviar enlace',
    backToLogin: 'Volver al login',
    successTitle: 'Email enviado',
    successMsg: 'Te enviamos un enlace para restablecerla.',
    errorInvalid: 'Por favor, introduce un email válido',
    errorGeneric: 'Error al enviar. Por favor, inténtalo de nuevo.',
  },
  tr: {
    title: 'Şifre sıfırlama',
    subtitle: 'E-postanızı girin, size sıfırlama bağlantısı gönderelim.',
    emailLabel: 'E-posta',
    emailPlaceholder: 'sizin@email.com',
    sendBtn: 'Bağlantı gönder',
    backToLogin: 'Girişe dön',
    successTitle: 'E-posta gönderildi',
    successMsg: 'Şifre sıfırlama bağlantısı gönderdik.',
    errorInvalid: 'Lütfen geçerli bir e-posta adresi girin',
    errorGeneric: 'Gönderme hatası. Lütfen tekrar deneyin.',
  },
  ro: {
    title: 'Resetare parolă',
    subtitle: 'Introduceți emailul și vă vom trimite un link de resetare.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'al-tau@email.ro',
    sendBtn: 'Trimite link',
    backToLogin: 'Înapoi la login',
    successTitle: 'Email trimis',
    successMsg: 'Am trimis un link de resetare.',
    errorInvalid: 'Vă rugăm să introduceți o adresă de email validă',
    errorGeneric: 'Eroare la trimitere. Vă rugăm să încercați din nou.',
  },
  ru: {
    title: 'Сброс пароля',
    subtitle: 'Введите email, и мы отправим вам ссылку для сброса.',
    emailLabel: 'Email',
    emailPlaceholder: 'ваш@email.ru',
    sendBtn: 'Отправить ссылку',
    backToLogin: 'Вернуться к входу',
    successTitle: 'Email отправлен',
    successMsg: 'Мы отправили ссылку для сброса.',
    errorInvalid: 'Пожалуйста, введите действительный email',
    errorGeneric: 'Ошибка отправки. Попробуйте снова.',
  },
  uk: {
    title: 'Скидання пароля',
    subtitle: 'Введіть email, і ми надішлемо посилання для скидання.',
    emailLabel: 'Email',
    emailPlaceholder: 'ваш@email.ua',
    sendBtn: 'Надіслати посилання',
    backToLogin: 'Повернутися до входу',
    successTitle: 'Email надіслано',
    successMsg: 'Ми надіслали посилання для скидання.',
    errorInvalid: 'Будь ласка, введіть дійсний email',
    errorGeneric: 'Помилка надсилання. Спробуйте ще раз.',
  },
  pl: {
    title: 'Zresetuj hasło',
    subtitle: 'Wpisz swój email, a wyślemy Ci link do zresetowania.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'twoj@email.pl',
    sendBtn: 'Wyślij link',
    backToLogin: 'Powrót do logowania',
    successTitle: 'Email wysłany',
    successMsg: 'Wysłaliśmy link do resetu.',
    errorInvalid: 'Proszę podać prawidłowy adres email',
    errorGeneric: 'Błąd wysyłania. Spróbuj ponownie.',
  },
  ar: {
    title: 'إعادة تعيين كلمة المرور',
    subtitle: 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'your@email.com',
    sendBtn: 'إرسال الرابط',
    backToLogin: 'العودة لتسجيل الدخول',
    successTitle: 'تم إرسال البريد',
    successMsg: 'أرسلنا لك رابط إعادة تعيين كلمة المرور.',
    errorInvalid: 'يرجى إدخال بريد إلكتروني صالح',
    errorGeneric: 'خطأ في الإرسال. يرجى المحاولة مرة أخرى.',
  },
  pt: {
    title: 'Redefinir senha',
    subtitle: 'Digite seu email e enviaremos um link de redefinição.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'seu@email.pt',
    sendBtn: 'Enviar link',
    backToLogin: 'Voltar ao login',
    successTitle: 'Email enviado',
    successMsg: 'Enviamos um link de redefinição.',
    errorInvalid: 'Por favor, insira um email válido',
    errorGeneric: 'Erro ao enviar. Por favor, tente novamente.',
  },
};

export default function ResetPassword() {
  const { language, isRTL } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const langKey = language.toLowerCase();
  const t = translations[langKey] || translations.de;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !email.includes('@')) {
      toast.error(t.errorInvalid);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setSent(true);
      toast.success(t.successMsg);
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error(t.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b border-gold/20">
        <div className="container flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              <div className="absolute inset-1 rounded-full border border-gold/30" />
              <span className="relative font-display text-lg font-semibold text-gold" style={{ fontFamily: 'Georgia, serif' }}>L</span>
            </div>
            <span className="font-display text-xl font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </Link>
          <LanguageSelector />
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      </header>

      <main className="container flex flex-col items-center justify-center py-16">
        <Card className="w-full max-w-md bg-ivory border-gold/20 shadow-premium">
          <CardHeader className="text-center">
            {sent ? (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-navy">{t.successTitle}</CardTitle>
                <CardDescription className="text-navy/60">
                  {t.successMsg}
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-navy/10">
                  <Mail className="h-8 w-8 text-navy" />
                </div>
                <CardTitle className="text-2xl text-navy">{t.title}</CardTitle>
                <CardDescription className="text-navy/60">
                  {t.subtitle}
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {sent ? (
              <Link to="/auth">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t.backToLogin}
                </Button>
              </Link>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-navy">{t.emailLabel}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="bg-white border-navy/20 text-navy"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-navy text-gold hover:bg-navy/90"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.sendBtn}
                </Button>

                <Link to="/auth" className="block">
                  <Button variant="ghost" className="w-full text-navy/60 hover:text-navy">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {t.backToLogin}
                  </Button>
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}