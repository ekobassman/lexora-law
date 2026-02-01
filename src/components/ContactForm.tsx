import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Loader2, CheckCircle, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().trim().email('Invalid email').max(255, 'Email too long'),
  message: z.string().trim().min(10, 'Message too short').max(2000, 'Message too long'),
});

export function ContactForm() {
  const { t, language } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const translations = {
    de: {
      title: 'Kontakt',
      name: 'Name',
      namePlaceholder: 'Ihr Name',
      email: 'E-Mail',
      emailPlaceholder: 'ihre@email.de',
      message: 'Nachricht',
      messagePlaceholder: 'Ihre Nachricht...',
      send: 'Senden',
      sending: 'Wird gesendet...',
      success: 'Nachricht gesendet!',
      successDesc: 'Wir melden uns in Kürze bei Ihnen.',
      error: 'Fehler beim Senden. Bitte versuchen Sie es erneut.',
      validationError: 'Bitte überprüfen Sie Ihre Eingaben.',
    },
    en: {
      title: 'Contact',
      name: 'Name',
      namePlaceholder: 'Your name',
      email: 'Email',
      emailPlaceholder: 'your@email.com',
      message: 'Message',
      messagePlaceholder: 'Your message...',
      send: 'Send',
      sending: 'Sending...',
      success: 'Message sent!',
      successDesc: 'We will get back to you soon.',
      error: 'Error sending. Please try again.',
      validationError: 'Please check your input.',
    },
    it: {
      title: 'Contatto',
      name: 'Nome',
      namePlaceholder: 'Il tuo nome',
      email: 'Email',
      emailPlaceholder: 'tua@email.it',
      message: 'Messaggio',
      messagePlaceholder: 'Il tuo messaggio...',
      send: 'Invia',
      sending: 'Invio in corso...',
      success: 'Messaggio inviato!',
      successDesc: 'Ti risponderemo presto.',
      error: 'Errore durante l\'invio. Riprova.',
      validationError: 'Controlla i tuoi dati.',
    },
    fr: {
      title: 'Contact',
      name: 'Nom',
      namePlaceholder: 'Votre nom',
      email: 'Email',
      emailPlaceholder: 'votre@email.fr',
      message: 'Message',
      messagePlaceholder: 'Votre message...',
      send: 'Envoyer',
      sending: 'Envoi en cours...',
      success: 'Message envoyé !',
      successDesc: 'Nous vous répondrons bientôt.',
      error: 'Erreur lors de l\'envoi. Veuillez réessayer.',
      validationError: 'Veuillez vérifier vos données.',
    },
    es: {
      title: 'Contacto',
      name: 'Nombre',
      namePlaceholder: 'Tu nombre',
      email: 'Email',
      emailPlaceholder: 'tu@email.es',
      message: 'Mensaje',
      messagePlaceholder: 'Tu mensaje...',
      send: 'Enviar',
      sending: 'Enviando...',
      success: '¡Mensaje enviado!',
      successDesc: 'Te responderemos pronto.',
      error: 'Error al enviar. Por favor, inténtalo de nuevo.',
      validationError: 'Por favor, verifica tus datos.',
    },
    pl: {
      title: 'Kontakt',
      name: 'Imię',
      namePlaceholder: 'Twoje imię',
      email: 'Email',
      emailPlaceholder: 'twoj@email.pl',
      message: 'Wiadomość',
      messagePlaceholder: 'Twoja wiadomość...',
      send: 'Wyślij',
      sending: 'Wysyłanie...',
      success: 'Wiadomość wysłana!',
      successDesc: 'Odpowiemy wkrótce.',
      error: 'Błąd wysyłania. Spróbuj ponownie.',
      validationError: 'Sprawdź swoje dane.',
    },
    ro: {
      title: 'Contact',
      name: 'Nume',
      namePlaceholder: 'Numele tău',
      email: 'Email',
      emailPlaceholder: 'email@tau.ro',
      message: 'Mesaj',
      messagePlaceholder: 'Mesajul tău...',
      send: 'Trimite',
      sending: 'Se trimite...',
      success: 'Mesaj trimis!',
      successDesc: 'Îți vom răspunde în curând.',
      error: 'Eroare la trimitere. Te rugăm să încerci din nou.',
      validationError: 'Verifică datele introduse.',
    },
    tr: {
      title: 'İletişim',
      name: 'İsim',
      namePlaceholder: 'Adınız',
      email: 'E-posta',
      emailPlaceholder: 'email@adresiniz.tr',
      message: 'Mesaj',
      messagePlaceholder: 'Mesajınız...',
      send: 'Gönder',
      sending: 'Gönderiliyor...',
      success: 'Mesaj gönderildi!',
      successDesc: 'En kısa sürede size dönüş yapacağız.',
      error: 'Gönderme hatası. Lütfen tekrar deneyin.',
      validationError: 'Lütfen bilgilerinizi kontrol edin.',
    },
    ru: {
      title: 'Контакт',
      name: 'Имя',
      namePlaceholder: 'Ваше имя',
      email: 'Email',
      emailPlaceholder: 'ваш@email.ru',
      message: 'Сообщение',
      messagePlaceholder: 'Ваше сообщение...',
      send: 'Отправить',
      sending: 'Отправка...',
      success: 'Сообщение отправлено!',
      successDesc: 'Мы свяжемся с вами в ближайшее время.',
      error: 'Ошибка отправки. Пожалуйста, попробуйте снова.',
      validationError: 'Пожалуйста, проверьте введённые данные.',
    },
    uk: {
      title: 'Контакт',
      name: 'Ім\'я',
      namePlaceholder: 'Ваше ім\'я',
      email: 'Email',
      emailPlaceholder: 'ваш@email.ua',
      message: 'Повідомлення',
      messagePlaceholder: 'Ваше повідомлення...',
      send: 'Надіслати',
      sending: 'Надсилання...',
      success: 'Повідомлення надіслано!',
      successDesc: 'Ми зв\'яжемося з вами найближчим часом.',
      error: 'Помилка надсилання. Будь ласка, спробуйте знову.',
      validationError: 'Будь ласка, перевірте введені дані.',
    },
    ar: {
      title: 'اتصل بنا',
      name: 'الاسم',
      namePlaceholder: 'اسمك',
      email: 'البريد الإلكتروني',
      emailPlaceholder: 'بريدك@الإلكتروني.com',
      message: 'الرسالة',
      messagePlaceholder: 'رسالتك...',
      send: 'إرسال',
      sending: 'جاري الإرسال...',
      success: 'تم إرسال الرسالة!',
      successDesc: 'سنرد عليك قريباً.',
      error: 'خطأ في الإرسال. يرجى المحاولة مرة أخرى.',
      validationError: 'يرجى التحقق من بياناتك.',
    },
  };

  const txt = translations[language as keyof typeof translations] || translations.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const result = contactSchema.safeParse({ name, email, message });
    if (!result.success) {
      toast({
        title: txt.validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: { name, email, message, language },
      });

      if (error) throw error;

      setIsSuccess(true);
      setName('');
      setEmail('');
      setMessage('');
      
      toast({
        title: txt.success,
        description: txt.successDesc,
      });

      // Reset success state after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (error) {
      console.error('Contact form error:', error);
      toast({
        title: txt.error,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle className="h-10 w-10 text-green-500" />
        <p className="text-ivory/80 text-center">{txt.success}</p>
        <p className="text-sm text-ivory/50 text-center">{txt.successDesc}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-gold" />
        <h3 className="text-lg font-semibold text-ivory">{txt.title}</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact-name" className="text-ivory/70">{txt.name}</Label>
          <Input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={txt.namePlaceholder}
            required
            maxLength={100}
            className="bg-ivory/10 border-gold/30 text-ivory placeholder:text-ivory/40 focus:border-gold"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email" className="text-ivory/70">{txt.email}</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={txt.emailPlaceholder}
            required
            maxLength={255}
            className="bg-ivory/10 border-gold/30 text-ivory placeholder:text-ivory/40 focus:border-gold"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="contact-message" className="text-ivory/70">{txt.message}</Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={txt.messagePlaceholder}
          required
          rows={4}
          maxLength={2000}
          className="bg-ivory/10 border-gold/30 text-ivory placeholder:text-ivory/40 focus:border-gold resize-none"
        />
      </div>
      
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gold hover:bg-gold/90 text-navy font-medium"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {txt.sending}
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {txt.send}
          </>
        )}
      </Button>
    </form>
  );
}
