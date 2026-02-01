import { useLanguage } from '@/contexts/LanguageContext';

// Custom Nano Banana icons - 3 images with pairs of icons
import processIcons12 from '@/assets/process-icons-1-2.jpeg';
import processIcons34 from '@/assets/process-icons-3-4.jpeg';
import processIcons56 from '@/assets/process-icons-5-6.jpeg';

const steps = [
  {
    titleKey: 'process.step1.title',
    descKey: 'process.step1.desc',
    image: processIcons12,
    bgPosition: '0% 50%',
    stepNumber: 1,
  },
  {
    titleKey: 'process.step2.title',
    descKey: 'process.step2.desc',
    image: processIcons12,
    bgPosition: '100% 50%',
    stepNumber: 2,
  },
  {
    titleKey: 'process.step3.title',
    descKey: 'process.step3.desc',
    image: processIcons34,
    bgPosition: '0% 50%',
    stepNumber: 3,
  },
  {
    titleKey: 'process.step4.title',
    descKey: 'process.step4.desc',
    image: processIcons34,
    bgPosition: '100% 50%',
    stepNumber: 4,
  },
  {
    titleKey: 'process.step5.title',
    descKey: 'process.step5.desc',
    image: processIcons56,
    bgPosition: '0% 50%',
    stepNumber: 5,
  },
  {
    titleKey: 'process.step6.title',
    descKey: 'process.step6.desc',
    image: processIcons56,
    bgPosition: '100% 50%',
    stepNumber: 6,
  },
];

export function ProcessSteps() {
  const { t } = useLanguage();

  return (
    <section className="py-12 md:py-16 bg-background border-t">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step) => {
            const title = t(step.titleKey);
            
            return (
              <div 
                key={step.titleKey} 
                className="flex flex-col items-center text-center group"
              >
                {/* Custom Nano Banana Icon */}
                <div 
                  className="mb-4 w-24 h-24 md:w-28 md:h-28 transition-transform duration-300 group-hover:scale-105"
                  role="img"
                  aria-label={title}
                  style={{
                    backgroundImage: `url(${step.image})`,
                    backgroundPosition: step.bgPosition,
                    backgroundSize: '200% auto',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
                
                {/* Title */}
                <h3 className="text-sm md:text-base font-semibold text-foreground mb-1 leading-tight">
                  {title}
                </h3>
                
                {/* Description */}
                <p className="text-xs md:text-sm text-muted-foreground leading-snug max-w-[160px] md:max-w-[180px]">
                  {t(step.descKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
