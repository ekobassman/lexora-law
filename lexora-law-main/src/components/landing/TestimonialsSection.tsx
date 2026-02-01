import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Quote } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TestimonialsSectionProps {
  id?: string;
}

export function TestimonialsSection({ id }: TestimonialsSectionProps) {
  const { t } = useLanguage();

  const testimonials = [
    {
      name: t('landingSections.testimonials.users.0.name'),
      location: t('landingSections.testimonials.users.0.location'),
      rating: 5,
      text: t('landingSections.testimonials.users.0.text'),
      useCase: t('landingSections.testimonials.users.0.useCase'),
      avatar: 'TM',
    },
    {
      name: t('landingSections.testimonials.users.1.name'),
      location: t('landingSections.testimonials.users.1.location'),
      rating: 5,
      text: t('landingSections.testimonials.users.1.text'),
      useCase: t('landingSections.testimonials.users.1.useCase'),
      avatar: 'MK',
    },
    {
      name: t('landingSections.testimonials.users.2.name'),
      location: t('landingSections.testimonials.users.2.location'),
      rating: 5,
      text: t('landingSections.testimonials.users.2.text'),
      useCase: t('landingSections.testimonials.users.2.useCase'),
      avatar: 'SB',
    },
    {
      name: t('landingSections.testimonials.users.3.name'),
      location: t('landingSections.testimonials.users.3.location'),
      rating: 4,
      text: t('landingSections.testimonials.users.3.text'),
      useCase: t('landingSections.testimonials.users.3.useCase'),
      avatar: 'AL',
    },
  ];

  return (
    <section id={id} className="py-16 md:py-24 bg-navy">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="bg-gold/20 text-gold border-gold/30 mb-4">
            {t('landingSections.testimonials.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-ivory mb-4">
            {t('landingSections.testimonials.title')}
          </h2>
          <p className="text-ivory/70 max-w-2xl mx-auto">
            {t('landingSections.testimonials.subtitle')}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="bg-navy/50 border-gold/20 hover:border-gold/40 transition-all"
            >
              <CardContent className="p-6">
                {/* Quote icon */}
                <Quote className="h-8 w-8 text-gold/30 mb-4" />
                
                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < testimonial.rating
                          ? 'text-gold fill-gold'
                          : 'text-gold/30'
                      }`}
                    />
                  ))}
                </div>
                
                {/* Text */}
                <p className="text-ivory/90 mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>
                
                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/30 flex items-center justify-center">
                    <span className="text-gold font-semibold text-sm">
                      {testimonial.avatar}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-ivory">{testimonial.name}</p>
                    <p className="text-sm text-ivory/60">{testimonial.location}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="ml-auto border-gold/30 text-gold/80 text-xs"
                  >
                    {testimonial.useCase}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-12 pt-8 border-t border-gold/10">
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-gold">
              {t('landingSections.testimonials.stats.satisfaction.value')}
            </p>
            <p className="text-sm text-ivory/60">{t('landingSections.testimonials.stats.satisfaction.label')}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-gold">
              {t('landingSections.testimonials.stats.rating.value')}
            </p>
            <p className="text-sm text-ivory/60">{t('landingSections.testimonials.stats.rating.label')}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-gold">
              {t('landingSections.testimonials.stats.documents.value')}
            </p>
            <p className="text-sm text-ivory/60">{t('landingSections.testimonials.stats.documents.label')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
