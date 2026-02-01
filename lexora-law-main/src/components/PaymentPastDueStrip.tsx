import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface PaymentPastDueStripProps {
  paymentStatus: string | null | undefined;
}

const content = {
  IT: {
    title: "Pagamento in Sospeso",
    button: "Aggiorna",
  },
  DE: {
    title: "Zahlung Ausstehend",
    button: "Aktualisieren",
  },
  EN: {
    title: "Payment Pending",
    button: "Update",
  },
  FR: {
    title: "Paiement en Attente",
    button: "Mettre à jour",
  },
  ES: {
    title: "Pago Pendiente",
    button: "Actualizar",
  },
  PL: {
    title: "Płatność Oczekuje",
    button: "Aktualizuj",
  },
  RO: {
    title: "Plată în Așteptare",
    button: "Actualizează",
  },
  TR: {
    title: "Ödeme Bekliyor",
    button: "Güncelle",
  },
  AR: {
    title: "الدفع معلق",
    button: "تحديث",
  },
  UK: {
    title: "Очікується Оплата",
    button: "Оновити",
  },
  RU: {
    title: "Ожидается Оплата",
    button: "Обновить",
  },
};

export function PaymentPastDueStrip({ paymentStatus }: PaymentPastDueStripProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  if (paymentStatus !== "past_due") return null;

  const lang = (language?.toUpperCase() || "EN") as keyof typeof content;
  const t = content[lang] || content.EN;

  const handleUpdatePayment = () => {
    navigate("/subscription");
  };

  return (
    <div className="w-full px-2">
      <div className="relative overflow-hidden rounded-xl border-2 border-[#C9A24D] bg-gradient-to-r from-[#0B1C2D] via-[#162D44] to-[#0B1C2D] shadow-[0_4px_16px_rgba(11,28,45,0.4)]">
        {/* Decorative gold corners */}
        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#C9A24D] rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#C9A24D] rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#C9A24D] rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#C9A24D] rounded-br-xl" />
        
        {/* Content */}
        <div className="px-4 py-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          {/* Icon + Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B2635] to-[#6B1D29] flex items-center justify-center border border-[#C9A24D]/50 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#C9A24D]" strokeWidth={2} />
            </div>
            <span className="text-[#C9A24D] font-bold text-sm sm:text-base uppercase tracking-wide whitespace-nowrap">
              {t.title}
            </span>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleUpdatePayment}
            size="sm"
            className="px-5 py-2 h-auto bg-gradient-to-r from-[#C9A24D] via-[#D4AF61] to-[#C9A24D] text-[#0B1C2D] font-bold uppercase tracking-wider rounded-lg shadow-[0_2px_8px_rgba(201,162,77,0.4)] hover:shadow-[0_4px_12px_rgba(201,162,77,0.6)] transition-all duration-300 hover:scale-[1.02] border border-[#E5C77D] text-xs sm:text-sm whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {t.button}
          </Button>
        </div>
      </div>
    </div>
  );
}
