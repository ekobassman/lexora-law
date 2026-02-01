import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export function BlitzerBanner() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  // Determine template based on language
  const isItalian = language === 'IT';
  const template = isItalian ? 'autovelox' : 'blitzer';

  const handleClick = () => {
    if (user) {
      navigate(`/new-case?template=${template}`);
    } else {
      navigate(`/auth?template=${template}`);
    }
  };

  // Italian text
  const italianContent = (
    <span className="inline-flex items-center gap-3 text-sm md:text-base font-medium px-8">
      <span className="text-lg">🚨</span>
      <span className="font-semibold">Ti è arrivata una multa da autovelox?</span>
      <span className="mx-2">—</span>
      <span className="text-white/90">Carica il verbale e crea subito il ricorso.</span>
      <span className="mx-2">—</span>
      <span className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
        👉 Clicca qui
      </span>
    </span>
  );

  // German text
  const germanContent = (
    <span className="inline-flex items-center gap-3 text-sm md:text-base font-medium px-8">
      <span className="text-lg">🚨</span>
      <span className="font-semibold">Geblitzt worden?</span>
      <span className="mx-2">—</span>
      <span className="text-white/90">Messgeräte müssen regelmäßig geeicht sein.</span>
      <span className="mx-2">—</span>
      <span>Lexora erstellt Ihren Einspruch automatisch.</span>
      <span className="mx-2">—</span>
      <span className="inline-flex items-center gap-1 font-semibold underline underline-offset-2">
        👉 Jetzt klicken
      </span>
    </span>
  );

  const content = isItalian ? italianContent : germanContent;

  return (
    <div 
      onClick={handleClick}
      className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white py-3 cursor-pointer hover:from-red-700 hover:via-red-600 hover:to-red-700 transition-all overflow-hidden"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className="animate-marquee whitespace-nowrap items-center gap-12">
        {/* Duplicate content for seamless loop */}
        {[...Array(6)].map((_, i) => (
          <span key={i}>{content}</span>
        ))}
      </div>
    </div>
  );
}
