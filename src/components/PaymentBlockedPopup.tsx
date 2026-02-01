import { AlertTriangle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentBlockedPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const content = {
  IT: {
    title: "Pagamento in Sospeso",
    description: "Il pagamento del tuo piano non è andato a buon fine. Aggiorna il metodo di pagamento per continuare.",
    button: "Aggiorna Pagamento",
  },
  DE: {
    title: "Zahlung Ausstehend",
    description: "Die Zahlung für Ihr Abonnement ist fehlgeschlagen. Aktualisieren Sie Ihre Zahlungsmethode.",
    button: "Zahlung Aktualisieren",
  },
  EN: {
    title: "Payment Pending",
    description: "Your plan payment has failed. Update your payment method to continue.",
    button: "Update Payment",
  },
  FR: {
    title: "Paiement en Attente",
    description: "Le paiement de votre abonnement a échoué. Mettez à jour votre méthode de paiement.",
    button: "Mettre à Jour",
  },
  ES: {
    title: "Pago Pendiente",
    description: "El pago de tu plan ha fallado. Actualiza tu método de pago para continuar.",
    button: "Actualizar Pago",
  },
  PL: {
    title: "Płatność Oczekuje",
    description: "Płatność za Twój plan nie powiodła się. Zaktualizuj metodę płatności.",
    button: "Zaktualizuj Płatność",
  },
  RO: {
    title: "Plată în Așteptare",
    description: "Plata pentru planul tău a eșuat. Actualizează metoda de plată.",
    button: "Actualizează Plata",
  },
  TR: {
    title: "Ödeme Bekliyor",
    description: "Plan ödemeniz başarısız oldu. Devam etmek için ödeme yönteminizi güncelleyin.",
    button: "Ödemeyi Güncelle",
  },
  AR: {
    title: "الدفع معلق",
    description: "فشل الدفع لخطتك. قم بتحديث طريقة الدفع للمتابعة.",
    button: "تحديث الدفع",
  },
  UK: {
    title: "Очікується Оплата",
    description: "Оплата вашого плану не вдалася. Оновіть спосіб оплати.",
    button: "Оновити Оплату",
  },
  RU: {
    title: "Ожидается Оплата",
    description: "Оплата вашего плана не прошла. Обновите способ оплаты.",
    button: "Обновить Оплату",
  },
};

export function PaymentBlockedPopup({ isOpen, onClose }: PaymentBlockedPopupProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  if (!isOpen) return null;

  const lang = (language?.toUpperCase() || "EN") as keyof typeof content;
  const t = content[lang] || content.EN;

  const handleUpdatePayment = () => {
    onClose();
    navigate("/subscription");
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(11, 28, 45, 0.7)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Popup Card - Centered */}
      <div className="relative w-full max-w-sm animate-in zoom-in-95 fade-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-[#0B1C2D] border-2 border-[#C9A24D] flex items-center justify-center shadow-lg hover:bg-[#162D44] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-[#C9A24D]" />
        </button>

        {/* Premium Card */}
        <div className="relative overflow-hidden rounded-xl border-2 border-[#C9A24D] bg-gradient-to-b from-[#0B1C2D] to-[#162D44] shadow-[0_12px_40px_rgba(11,28,45,0.8)]">
          {/* Decorative gold corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#C9A24D] rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#C9A24D] rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#C9A24D] rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#C9A24D] rounded-br-xl" />

          {/* Content */}
          <div className="px-6 py-8 flex flex-col items-center text-center">
            {/* Icon */}
            <div className="mb-4 relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B2635] to-[#6B1D29] flex items-center justify-center shadow-lg border-2 border-[#C9A24D]/50">
                <AlertTriangle className="w-8 h-8 text-[#C9A24D]" strokeWidth={2} />
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full bg-[#8B2635]/30 blur-md -z-10" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-[#C9A24D] mb-2 tracking-wide uppercase">
              {t.title}
            </h3>

            {/* Decorative line */}
            <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent mb-4" />

            {/* Description */}
            <p className="text-[#F5F0E6]/80 text-sm leading-relaxed mb-6 max-w-xs">
              {t.description}
            </p>

            {/* CTA Button */}
            <Button
              onClick={handleUpdatePayment}
              className="relative px-8 py-3 h-auto bg-gradient-to-r from-[#C9A24D] via-[#D4AF61] to-[#C9A24D] text-[#0B1C2D] font-bold uppercase tracking-wider rounded-lg shadow-[0_4px_16px_rgba(201,162,77,0.4)] hover:shadow-[0_6px_20px_rgba(201,162,77,0.6)] transition-all duration-300 hover:scale-[1.02] border border-[#E5C77D] text-sm"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {t.button}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
