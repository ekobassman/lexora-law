import { Badge } from '@/components/ui/badge';
import { Upload, Brain, FileCheck, Send, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface HowItWorksSectionProps {
  id?: string;
}

export function HowItWorksSection({ id }: HowItWorksSectionProps) {
  const { t } = useLanguage();

  const steps = [
    {
      icon: Upload,
      number: '01',
      title: t('landingSections.howItWorks.steps.1.title'),
      description: t('landingSections.howItWorks.steps.1.description'),
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Brain,
      number: '02',
      title: t('landingSections.howItWorks.steps.2.title'),
      description: t('landingSections.howItWorks.steps.2.description'),
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: FileCheck,
      number: '03',
      title: t('landingSections.howItWorks.steps.3.title'),
      description: t('landingSections.howItWorks.steps.3.description'),
      color: 'from-gold to-amber-500',
    },
    {
      icon: Send,
      number: '04',
      title: t('landingSections.howItWorks.steps.4.title'),
      description: t('landingSections.howItWorks.steps.4.description'),
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <section id={id} className="py-16 md:py-24 bg-navy overflow-hidden">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="bg-gold/20 text-gold border-gold/30 mb-4">
            {t('landingSections.howItWorks.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-ivory mb-4">
            {t('landingSections.howItWorks.title')}
          </h2>
          <p className="text-ivory/70 max-w-2xl mx-auto">
            {t('landingSections.howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6 md:gap-4 relative">
            {/* Connection line (desktop) */}
            <div className="hidden md:block absolute top-20 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-gold/20 via-gold/40 to-gold/20" />
            
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="relative flex flex-col items-center text-center overflow-hidden min-w-0">
                  {/* Step number badge */}
                  <div className="absolute -top-2 -right-2 md:relative md:top-0 md:right-0 z-10">
                    <span className="text-xs font-bold text-gold/60 md:hidden">{step.number}</span>
                  </div>
                  
                  {/* Icon container */}
                  <div className={`relative h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 shadow-lg shadow-gold/10 z-10`}>
                    <Icon className="h-10 w-10 text-white" />
                    {/* Step number */}
                    <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-navy border-2 border-gold flex items-center justify-center">
                      <span className="text-xs font-bold text-gold">{step.number}</span>
                    </div>
                  </div>
                  
                  {/* Arrow (mobile) */}
                  {index < steps.length - 1 && (
                    <div className="md:hidden my-2">
                      <ArrowRight className="h-5 w-5 text-gold/40 rotate-90" />
                    </div>
                  )}
                  
                  {/* Content */}
                  <h3 className="text-lg font-semibold text-ivory mb-2 line-clamp-2 break-words">{step.title}</h3>
                  <p className="text-sm text-ivory/60 leading-relaxed line-clamp-3 break-words">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Time indicator */}
        <div className="text-center mt-12 pt-8 border-t border-gold/10">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold/10 border border-gold/30">
            <span className="text-gold font-semibold">{t('landingSections.howItWorks.timeIndicator')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
