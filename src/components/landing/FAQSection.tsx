import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface FAQSectionProps {
  id?: string;
}

export function FAQSection({ id }: FAQSectionProps) {
  const { t } = useLanguage();

  const faqs = [
    {
      question: t('landingSections.faq.items.0.question'),
      answer: t('landingSections.faq.items.0.answer'),
    },
    {
      question: t('landingSections.faq.items.1.question'),
      answer: t('landingSections.faq.items.1.answer'),
    },
    {
      question: t('landingSections.faq.items.2.question'),
      answer: t('landingSections.faq.items.2.answer'),
    },
    {
      question: t('landingSections.faq.items.3.question'),
      answer: t('landingSections.faq.items.3.answer'),
    },
    {
      question: t('landingSections.faq.items.4.question'),
      answer: t('landingSections.faq.items.4.answer'),
    },
    {
      question: t('landingSections.faq.items.5.question'),
      answer: t('landingSections.faq.items.5.answer'),
    },
    {
      question: t('landingSections.faq.items.6.question'),
      answer: t('landingSections.faq.items.6.answer'),
    },
    {
      question: t('landingSections.faq.items.7.question'),
      answer: t('landingSections.faq.items.7.answer'),
    },
  ];

  return (
    <section id={id} className="py-16 md:py-24 bg-ivory">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="bg-gold/10 text-gold border-gold/30 mb-4">
            {t('landingSections.faq.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
            {t('landingSections.faq.title')}
          </h2>
          <p className="text-navy/70 max-w-2xl mx-auto">
            {t('landingSections.faq.subtitle')}
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-navy/10 rounded-lg px-6 bg-white shadow-sm"
              >
                <AccordionTrigger className="text-left text-navy font-semibold hover:text-gold hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-navy/70 pb-4 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12">
          <p className="text-navy/60">
            {t('landingSections.faq.contactCta')}{' '}
            <a href="/support" className="text-gold hover:underline font-medium">
              {t('landingSections.faq.contactLink')}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
