import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';

const BASE_COUNT = 2450;
const ANIMATION_DURATION = 2000; // 2 seconds

// Translations for the counter section
const translations: Record<string, { title: string; subtitle: string }> = {
  IT: {
    title: 'Oltre {count} documenti analizzati con successo',
    subtitle: 'Aiutiamo cittadini e professionisti a comprendere la burocrazia ogni giorno.',
  },
  DE: {
    title: 'Über {count} Dokumente erfolgreich analysiert',
    subtitle: 'Wir helfen Bürgern und Fachleuten jeden Tag, die Bürokratie zu verstehen.',
  },
  EN: {
    title: 'Over {count} documents successfully analyzed',
    subtitle: 'We help citizens and professionals understand bureaucracy every day.',
  },
  FR: {
    title: 'Plus de {count} documents analysés avec succès',
    subtitle: 'Nous aidons les citoyens et les professionnels à comprendre la bureaucratie chaque jour.',
  },
  ES: {
    title: 'Más de {count} documentos analizados con éxito',
    subtitle: 'Ayudamos a ciudadanos y profesionales a entender la burocracia cada día.',
  },
  PL: {
    title: 'Ponad {count} dokumentów przeanalizowanych pomyślnie',
    subtitle: 'Pomagamy obywatelom i profesjonalistom zrozumieć biurokrację każdego dnia.',
  },
  RO: {
    title: 'Peste {count} documente analizate cu succes',
    subtitle: 'Ajutăm cetățenii și profesioniștii să înțeleagă birocrația în fiecare zi.',
  },
  TR: {
    title: '{count}\'dan fazla belge başarıyla analiz edildi',
    subtitle: 'Her gün vatandaşların ve profesyonellerin bürokrasiyi anlamasına yardımcı oluyoruz.',
  },
  AR: {
    title: 'تم تحليل أكثر من {count} وثيقة بنجاح',
    subtitle: 'نساعد المواطنين والمهنيين على فهم البيروقراطية كل يوم.',
  },
  UK: {
    title: 'Понад {count} документів успішно проаналізовано',
    subtitle: 'Ми допомагаємо громадянам і професіоналам розуміти бюрократію щодня.',
  },
  RU: {
    title: 'Более {count} документов успешно проанализировано',
    subtitle: 'Мы помогаем гражданам и профессионалам понять бюрократию каждый день.',
  },
};

function formatNumber(num: number, lang: string): string {
  // Use locale-specific formatting
  const localeMap: Record<string, string> = {
    IT: 'it-IT',
    DE: 'de-DE',
    EN: 'en-US',
    FR: 'fr-FR',
    ES: 'es-ES',
    PL: 'pl-PL',
    RO: 'ro-RO',
    TR: 'tr-TR',
    AR: 'ar-SA',
    UK: 'uk-UA',
    RU: 'ru-RU',
  };
  return num.toLocaleString(localeMap[lang] || 'en-US');
}

export function SocialProofCounter() {
  const { language } = useLanguage();
  const [dbCount, setDbCount] = useState<number>(0);
  const [displayCount, setDisplayCount] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const hasAnimated = useRef(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const totalCount = dbCount + BASE_COUNT;
  const text = translations[language] || translations.EN;

  // Coerce to number (PostgREST can return bigint as string)
  const toCount = (v: unknown): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') return parseInt(v, 10) || 0;
    return 0;
  };

  // Fetch count from DB (retries, then periodic refetch; also refetch when tab becomes visible)
  useEffect(() => {
    async function fetchCount(): Promise<boolean> {
      const { data, error } = await supabase
        .from('global_stats')
        .select('documents_processed')
        .eq('id', 'main')
        .maybeSingle();

      if (!error && data != null) {
        setDbCount(toCount(data.documents_processed));
        return true;
      }
      if (error) {
        console.warn('[SocialProofCounter] fetch count failed:', error.message);
      }
      return false;
    }

    let retries = 0;
    const maxRetries = 3;
    const tryFetch = () => {
      fetchCount().then((ok) => {
        if (!ok && retries < maxRetries) {
          retries += 1;
          setTimeout(tryFetch, 1500 * retries);
        }
      });
    };
    tryFetch();

    const interval = setInterval(fetchCount, 60_000);

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchCount();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Real-time subscription (optional: refetch covers if realtime is disabled)
  useEffect(() => {
    const channel = supabase
      .channel('global-stats-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'global_stats',
          filter: 'id=eq.main',
        },
        (payload) => {
          const raw = payload.new?.documents_processed;
          if (raw !== undefined && raw !== null) {
            setDbCount(toCount(raw));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Animate count from 0 to total when section becomes visible
  useEffect(() => {
    if (hasAnimated.current) {
      // If already animated, just update display count directly
      setDisplayCount(totalCount);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current && totalCount > 0) {
            hasAnimated.current = true;
            setIsAnimating(true);
            
            const startTime = Date.now();
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
              
              // Easing function (ease-out)
              const easeOut = 1 - Math.pow(1 - progress, 3);
              const current = Math.floor(easeOut * totalCount);
              
              setDisplayCount(current);
              
              if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
              } else {
                setDisplayCount(totalCount);
                setIsAnimating(false);
              }
            };
            
            animationRef.current = requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [totalCount]);

  // Update display count when dbCount changes after animation
  useEffect(() => {
    if (hasAnimated.current && !isAnimating) {
      setDisplayCount(totalCount);
    }
  }, [totalCount, isAnimating]);

  const formattedCount = formatNumber(displayCount, language);
  const titleText = text.title.replace('{count}', formattedCount);

  return (
    <section 
      ref={sectionRef}
      className="w-full py-12 md:py-16"
      style={{ backgroundColor: '#0B1C2D' }}
    >
      <div className="container mx-auto px-4 text-center">
        <h2 
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
          style={{ color: '#FFFFFF' }}
        >
          {titleText}
        </h2>
        <p 
          className="text-base md:text-lg max-w-2xl mx-auto opacity-90"
          style={{ color: '#FFFFFF' }}
        >
          {text.subtitle}
        </p>
      </div>
    </section>
  );
}
