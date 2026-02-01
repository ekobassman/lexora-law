import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentPastDueBannerProps {
  paymentStatus: string | null | undefined;
}

export function PaymentPastDueBanner({ paymentStatus }: PaymentPastDueBannerProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  if (paymentStatus !== "past_due") return null;

  const content = {
    it: {
      title: "Pagamento in Sospeso",
      description: "Il pagamento del tuo piano non è andato a buon fine. Aggiorna il metodo di pagamento per continuare ad usufruire di tutti i servizi premium.",
      button: "Aggiorna Pagamento",
    },
    de: {
      title: "Zahlung Ausstehend",
      description: "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Aktualisieren Sie Ihre Zahlungsmethode, um weiterhin alle Premium-Dienste nutzen zu können.",
      button: "Zahlung Aktualisieren",
    },
    en: {
      title: "Payment Pending",
      description: "Your plan payment has failed. Update your payment method to continue enjoying all premium services.",
      button: "Update Payment",
    },
    fr: {
      title: "Paiement en Attente",
      description: "Le paiement de votre abonnement a échoué. Mettez à jour votre méthode de paiement pour continuer à profiter de tous les services premium.",
      button: "Mettre à Jour",
    },
    es: {
      title: "Pago Pendiente",
      description: "El pago de tu plan ha fallado. Actualiza tu método de pago para seguir disfrutando de todos los servicios premium.",
      button: "Actualizar Pago",
    },
  };

  const lang = (language?.toLowerCase().slice(0, 2) || "en") as keyof typeof content;
  const t = content[lang] || content.en;

  const handleUpdatePayment = () => {
    navigate("/subscription");
  };

  return (
    <div className="mb-6 mx-auto max-w-lg">
      {/* Luxury card with navy background and gold accents */}
      <div className="relative overflow-hidden rounded-xl border-2 border-[#C9A24D] bg-gradient-to-b from-[#0B1C2D] to-[#162D44] shadow-[0_8px_32px_rgba(11,28,45,0.4)]">
        {/* Decorative gold corners */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#C9A24D] rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#C9A24D] rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#C9A24D] rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#C9A24D] rounded-br-xl" />
        
        {/* Content */}
        <div className="px-6 py-6 flex flex-col items-center text-center">
          {/* Icon container - centered at top */}
          <div className="mb-4 relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B2635] to-[#6B1D29] flex items-center justify-center shadow-lg border-2 border-[#C9A24D]/50">
              <AlertTriangle className="w-8 h-8 text-[#C9A24D]" strokeWidth={2} />
            </div>
            {/* Subtle glow effect */}
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-[#8B2635]/30 blur-md -z-10" />
          </div>
          
          {/* Title */}
          <h3 className="text-xl font-bold text-[#C9A24D] mb-2 tracking-wide uppercase">
            {t.title}
          </h3>
          
          {/* Decorative line */}
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent mb-4" />
          
          {/* Description */}
          <p className="text-[#F5F0E6]/80 text-sm leading-relaxed mb-6 max-w-sm">
            {t.description}
          </p>
          
          {/* CTA Button - Premium style */}
          <Button
            onClick={handleUpdatePayment}
            className="relative px-8 py-3 h-auto bg-gradient-to-r from-[#C9A24D] via-[#D4AF61] to-[#C9A24D] text-[#0B1C2D] font-bold uppercase tracking-wider rounded-lg shadow-[0_4px_16px_rgba(201,162,77,0.4)] hover:shadow-[0_6px_20px_rgba(201,162,77,0.6)] transition-all duration-300 hover:scale-[1.02] border border-[#E5C77D]"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {t.button}
          </Button>
        </div>
      </div>
    </div>
  );
}
