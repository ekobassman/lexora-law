import { Badge } from '@/components/ui/badge';
import {
  Receipt,
  Scale,
  Plane,
  ShieldCheck,
  Home,
  Briefcase,
  FileWarning,
  CreditCard,
  Building2,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SupportedDocumentsSectionProps {
  id?: string;
}

export function SupportedDocumentsSection({ id }: SupportedDocumentsSectionProps) {
  const { t } = useLanguage();

  const documentTypes = [
    {
      icon: Receipt,
      title: t('landingSections.documents.types.0.title'),
      description: t('landingSections.documents.types.0.description'),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Scale,
      title: t('landingSections.documents.types.1.title'),
      description: t('landingSections.documents.types.1.description'),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: Plane,
      title: t('landingSections.documents.types.2.title'),
      description: t('landingSections.documents.types.2.description'),
      color: 'text-teal-500',
      bgColor: 'bg-teal-500/10',
    },
    {
      icon: ShieldCheck,
      title: t('landingSections.documents.types.3.title'),
      description: t('landingSections.documents.types.3.description'),
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Home,
      title: t('landingSections.documents.types.4.title'),
      description: t('landingSections.documents.types.4.description'),
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      icon: Briefcase,
      title: t('landingSections.documents.types.5.title'),
      description: t('landingSections.documents.types.5.description'),
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      icon: FileWarning,
      title: t('landingSections.documents.types.6.title'),
      description: t('landingSections.documents.types.6.description'),
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: CreditCard,
      title: t('landingSections.documents.types.7.title'),
      description: t('landingSections.documents.types.7.description'),
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      icon: Building2,
      title: t('landingSections.documents.types.8.title'),
      description: t('landingSections.documents.types.8.description'),
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
  ];

  return (
    <section id={id} className="py-16 md:py-24 bg-ivory">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="bg-gold/10 text-gold border-gold/30 mb-4">
            {t('landingSections.documents.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
            {t('landingSections.documents.title')}
          </h2>
          <p className="text-navy/70 max-w-2xl mx-auto">
            {t('landingSections.documents.subtitle')}
          </p>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
          {documentTypes.map((doc, index) => {
            const Icon = doc.icon;
            return (
              <div
                key={index}
                className="group p-4 md:p-6 rounded-xl border border-navy/10 bg-white hover:border-gold/30 hover:shadow-lg transition-all"
              >
                <div className={`h-12 w-12 rounded-lg ${doc.bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${doc.color}`} />
                </div>
                <h3 className="font-semibold text-navy mb-1 group-hover:text-gold transition-colors">
                  {doc.title}
                </h3>
                <p className="text-sm text-navy/60">
                  {doc.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Supported formats */}
        <div className="text-center mt-12 pt-8 border-t border-navy/10">
          <p className="text-sm text-navy/60 mb-3">{t('landingSections.documents.formatsTitle')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['PDF', 'JPG', 'PNG', 'WEBP', 'HEIC'].map((format) => (
              <Badge key={format} variant="outline" className="border-navy/20 text-navy/70">
                {format}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
