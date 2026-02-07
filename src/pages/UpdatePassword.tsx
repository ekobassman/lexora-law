import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Loader2, Lock, CheckCircle } from 'lucide-react';

// Translations for 12 languages
const translations: Record<string, {
  title: string;
  subtitle: string;
  newPassword: string;
  confirmPassword: string;
  updateBtn: string;
  successTitle: string;
  successMsg: string;
  goToLogin: string;
  errorMismatch: string;
  errorShort: string;
  errorGeneric: string;
}> = {
  de: {
    title: 'Neues Passwort festlegen',
    subtitle: 'Geben Sie Ihr neues Passwort ein.',
    newPassword: 'Neues Passwort',
    confirmPassword: 'Passwort bestätigen',
    updateBtn: 'Passwort aktualisieren',
    successTitle: 'Passwort aktualisiert',
    successMsg: 'Sie können sich jetzt mit Ihrem neuen Passwort anmelden.',
    goToLogin: 'Zum Login',
    errorMismatch: 'Die Passwörter stimmen nicht überein',
    errorShort: 'Das Passwort muss mindestens 6 Zeichen lang sein',
    errorGeneric: 'Fehler beim Aktualisieren. Bitte versuchen Sie es erneut.',
  },
  en: {
    title: 'Set new password',
    subtitle: 'Enter your new password below.',
    newPassword: 'New password',
    confirmPassword: 'Confirm password',
    updateBtn: 'Update password',
    successTitle: 'Password updated',
    successMsg: 'You can now log in with your new password.',
    goToLogin: 'Go to login',
    errorMismatch: 'Passwords do not match',
    errorShort: 'Password must be at least 6 characters',
    errorGeneric: 'Error updating password. Please try again.',
  },
  it: {
    title: 'Imposta nuova password',
    subtitle: 'Inserisci la tua nuova password.',
    newPassword: 'Nuova password',
    confirmPassword: 'Conferma password',
    updateBtn: 'Aggiorna password',
    successTitle: 'Password aggiornata',
    successMsg: 'Ora puoi accedere con la tua nuova password.',
    goToLogin: 'Vai al login',
    errorMismatch: 'Le password non corrispondono',
    errorShort: 'La password deve contenere almeno 6 caratteri',
    errorGeneric: 'Errore nell\'aggiornamento. Riprova.',
  },
  fr: {
    title: 'Définir un nouveau mot de passe',
    subtitle: 'Entrez votre nouveau mot de passe.',
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    updateBtn: 'Mettre à jour',
    successTitle: 'Mot de passe mis à jour',
    successMsg: 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
    goToLogin: 'Aller à la connexion',
    errorMismatch: 'Les mots de passe ne correspondent pas',
    errorShort: 'Le mot de passe doit contenir au moins 6 caractères',
    errorGeneric: 'Erreur lors de la mise à jour. Veuillez réessayer.',
  },
  es: {
    title: 'Establecer nueva contraseña',
    subtitle: 'Introduce tu nueva contraseña.',
    newPassword: 'Nueva contraseña',
    confirmPassword: 'Confirmar contraseña',
    updateBtn: 'Actualizar contraseña',
    successTitle: 'Contraseña actualizada',
    successMsg: 'Ahora puedes iniciar sesión con tu nueva contraseña.',
    goToLogin: 'Ir al login',
    errorMismatch: 'Las contraseñas no coinciden',
    errorShort: 'La contraseña debe tener al menos 6 caracteres',
    errorGeneric: 'Error al actualizar. Por favor, inténtalo de nuevo.',
  },
  tr: {
    title: 'Yeni şifre belirle',
    subtitle: 'Yeni şifrenizi girin.',
    newPassword: 'Yeni şifre',
    confirmPassword: 'Şifreyi onayla',
    updateBtn: 'Şifreyi güncelle',
    successTitle: 'Şifre güncellendi',
    successMsg: 'Artık yeni şifrenizle giriş yapabilirsiniz.',
    goToLogin: 'Girişe git',
    errorMismatch: 'Şifreler eşleşmiyor',
    errorShort: 'Şifre en az 6 karakter olmalı',
    errorGeneric: 'Güncelleme hatası. Lütfen tekrar deneyin.',
  },
  ro: {
    title: 'Setează parolă nouă',
    subtitle: 'Introduceți noua parolă.',
    newPassword: 'Parolă nouă',
    confirmPassword: 'Confirmă parola',
    updateBtn: 'Actualizează parola',
    successTitle: 'Parolă actualizată',
    successMsg: 'Acum vă puteți conecta cu noua parolă.',
    goToLogin: 'Mergi la login',
    errorMismatch: 'Parolele nu se potrivesc',
    errorShort: 'Parola trebuie să aibă cel puțin 6 caractere',
    errorGeneric: 'Eroare la actualizare. Vă rugăm să încercați din nou.',
  },
  ru: {
    title: 'Установить новый пароль',
    subtitle: 'Введите ваш новый пароль.',
    newPassword: 'Новый пароль',
    confirmPassword: 'Подтвердите пароль',
    updateBtn: 'Обновить пароль',
    successTitle: 'Пароль обновлён',
    successMsg: 'Теперь вы можете войти с новым паролем.',
    goToLogin: 'Перейти к входу',
    errorMismatch: 'Пароли не совпадают',
    errorShort: 'Пароль должен содержать минимум 6 символов',
    errorGeneric: 'Ошибка обновления. Попробуйте снова.',
  },
  uk: {
    title: 'Встановити новий пароль',
    subtitle: 'Введіть ваш новий пароль.',
    newPassword: 'Новий пароль',
    confirmPassword: 'Підтвердіть пароль',
    updateBtn: 'Оновити пароль',
    successTitle: 'Пароль оновлено',
    successMsg: 'Тепер ви можете увійти з новим паролем.',
    goToLogin: 'Перейти до входу',
    errorMismatch: 'Паролі не співпадають',
    errorShort: 'Пароль має містити щонайменше 6 символів',
    errorGeneric: 'Помилка оновлення. Спробуйте ще раз.',
  },
  pl: {
    title: 'Ustaw nowe hasło',
    subtitle: 'Wprowadź swoje nowe hasło.',
    newPassword: 'Nowe hasło',
    confirmPassword: 'Potwierdź hasło',
    updateBtn: 'Zaktualizuj hasło',
    successTitle: 'Hasło zaktualizowane',
    successMsg: 'Możesz teraz zalogować się nowym hasłem.',
    goToLogin: 'Przejdź do logowania',
    errorMismatch: 'Hasła nie są zgodne',
    errorShort: 'Hasło musi mieć co najmniej 6 znaków',
    errorGeneric: 'Błąd aktualizacji. Spróbuj ponownie.',
  },
  ar: {
    title: 'تعيين كلمة مرور جديدة',
    subtitle: 'أدخل كلمة المرور الجديدة.',
    newPassword: 'كلمة المرور الجديدة',
    confirmPassword: 'تأكيد كلمة المرور',
    updateBtn: 'تحديث كلمة المرور',
    successTitle: 'تم تحديث كلمة المرور',
    successMsg: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    goToLogin: 'الذهاب لتسجيل الدخول',
    errorMismatch: 'كلمات المرور غير متطابقة',
    errorShort: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل',
    errorGeneric: 'خطأ في التحديث. يرجى المحاولة مرة أخرى.',
  },
  pt: {
    title: 'Definir nova senha',
    subtitle: 'Digite sua nova senha.',
    newPassword: 'Nova senha',
    confirmPassword: 'Confirmar senha',
    updateBtn: 'Atualizar senha',
    successTitle: 'Senha atualizada',
    successMsg: 'Você já pode fazer login com sua nova senha.',
    goToLogin: 'Ir para login',
    errorMismatch: 'As senhas não coincidem',
    errorShort: 'A senha deve ter pelo menos 6 caracteres',
    errorGeneric: 'Erro ao atualizar. Por favor, tente novamente.',
  },
};

export default function UpdatePassword() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const langKey = language.toLowerCase();
  const t = translations[langKey] || translations.de;

  // Check if user came from password reset link
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (type === 'recovery' && accessToken) {
      // Token is automatically handled by Supabase client
      console.log('Password recovery session detected');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error(t.errorShort);
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t.errorMismatch);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setSuccess(true);
      toast.success(t.successMsg);

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate('/app');
      }, 3000);
    } catch (error) {
      console.error('Update password error:', error);
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
            {success ? (
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
                  <Lock className="h-8 w-8 text-navy" />
                </div>
                <CardTitle className="text-2xl text-navy">{t.title}</CardTitle>
                <CardDescription className="text-navy/60">
                  {t.subtitle}
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {success ? (
              <Link to="/auth">
                <Button className="w-full bg-navy text-gold hover:bg-navy/90">
                  {t.goToLogin}
                </Button>
              </Link>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-navy">{t.newPassword}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-navy/20 text-navy"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-navy">{t.confirmPassword}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-white border-navy/20 text-navy"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-navy text-gold hover:bg-navy/90"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.updateBtn}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}