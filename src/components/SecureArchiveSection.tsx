import { useLanguage } from '@/contexts/LanguageContext';
import { ShieldCheck, FolderOpen, History, CalendarCheck } from 'lucide-react';

const archiveCards = [
  {
    icon: ShieldCheck,
    titleKey: 'home.archive.card1.title',
    textKey: 'home.archive.card1.text',
  },
  {
    icon: FolderOpen,
    titleKey: 'home.archive.card2.title',
    textKey: 'home.archive.card2.text',
  },
  {
    icon: History,
    titleKey: 'home.archive.card3.title',
    textKey: 'home.archive.card3.text',
  },
  {
    icon: CalendarCheck,
    titleKey: 'home.archive.card4.title',
    textKey: 'home.archive.card4.text',
  },
];

export function SecureArchiveSection() {
  const { t } = useLanguage();

  return (
    <section className="py-12 md:py-16 bg-secondary/30 border-t">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
            {t('home.archive.title')}
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            {t('home.archive.subtitle')}
          </p>
        </div>

        {/* Cards Grid - 1 column mobile (stacked), 2 on sm, 4 on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {archiveCards.map((card) => {
            const Icon = card.icon;
            const title = t(card.titleKey);
            
            return (
              <div 
                key={card.titleKey} 
                className="flex flex-col items-center text-center p-5 md:p-6 bg-card rounded-xl border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group"
              >
                {/* Icon Container - Navy circle with gold icon */}
                <div className="mb-4 flex items-center justify-center rounded-full bg-primary w-14 h-14 md:w-16 md:h-16 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl">
                  <Icon 
                    className="text-accent w-7 h-7 md:w-8 md:h-8"
                    strokeWidth={1.8}
                    aria-label={title}
                    role="img"
                  />
                </div>
                
                {/* Title */}
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-1 leading-tight">
                  {title}
                </h3>
                
                {/* Text */}
                <p className="text-xs md:text-sm text-muted-foreground leading-snug">
                  {t(card.textKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
