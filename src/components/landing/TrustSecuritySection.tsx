import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Server, Eye, ShieldCheck, CheckCircle, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TrustSecuritySectionProps {
  id?: string;
}

export function TrustSecuritySection({ id }: TrustSecuritySectionProps) {
  const { t } = useLanguage();

  const securityFeatures = [
    {
      icon: Shield,
      title: t('landingSections.trust.features.0.title'),
      description: t('landingSections.trust.features.0.description'),
    },
    {
      icon: Lock,
      title: t('landingSections.trust.features.1.title'),
      description: t('landingSections.trust.features.1.description'),
    },
    {
      icon: Server,
      title: t('landingSections.trust.features.2.title'),
      description: t('landingSections.trust.features.2.description'),
    },
    {
      icon: Eye,
      title: t('landingSections.trust.features.3.title'),
      description: t('landingSections.trust.features.3.description'),
    },
  ];

  const countries = [
    { code: 'US', name: t('landingSections.trust.countries.us'), flag: '🇺🇸' },
    { code: 'DE', name: t('landingSections.trust.countries.de'), flag: '🇩🇪' },
    { code: 'AT', name: t('landingSections.trust.countries.at'), flag: '🇦🇹' },
    { code: 'CH', name: t('landingSections.trust.countries.ch'), flag: '🇨🇭' },
    { code: 'IT', name: t('landingSections.trust.countries.it'), flag: '🇮🇹' },
    { code: 'FR', name: t('landingSections.trust.countries.fr'), flag: '🇫🇷' },
    { code: 'ES', name: t('landingSections.trust.countries.es'), flag: '🇪🇸' },
    { code: 'UK', name: t('landingSections.trust.countries.uk'), flag: '🇬🇧' },
    { code: 'UA', name: t('landingSections.trust.countries.ua'), flag: '🇺🇦' },
    { code: 'TR', name: t('landingSections.trust.countries.tr'), flag: '🇹🇷' },
    { code: 'LATAM', name: t('landingSections.trust.countries.latam'), flag: '🌎' },
  ];

  return (
    <section id={id} className="py-16 md:py-24 bg-navy">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="bg-gold/20 text-gold border-gold/30 mb-4">
            {t('landingSections.trust.badge')}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-ivory mb-4">
            {t('landingSections.trust.title')}
          </h2>
          <p className="text-ivory/70 max-w-2xl mx-auto">
            {t('landingSections.trust.subtitle')}
          </p>
        </div>

        {/* Security Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto mb-16">
          {securityFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="text-center p-6 rounded-xl border border-gold/20 bg-navy/50 hover:border-gold/40 transition-all"
              >
                <div className="h-14 w-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-7 w-7 text-gold" />
                </div>
                <h3 className="font-semibold text-ivory mb-2">{feature.title}</h3>
                <p className="text-sm text-ivory/60">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Certifications - flex wrap, centrato, gap uniforme, badge stessa dimensione */}
        <div className="flex flex-wrap justify-center items-center gap-4 mb-12">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-500/10 border border-green-500/30 min-h-[2.75rem]">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-400" />
            <span className="text-sm font-medium text-green-300">ISO 27001</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-500/10 border border-blue-500/30 min-h-[2.75rem]">
            <Shield className="h-5 w-5 shrink-0 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">{t('landingSections.trust.certifications.gdpr')}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-purple-500/10 border border-purple-500/30 min-h-[2.75rem]">
            <Lock className="h-5 w-5 shrink-0 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">SOC 2 Type II</span>
          </div>
        </div>

        {/* Supported Countries */}
        <div className="border-t border-gold/10 pt-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-gold" />
              <span className="text-ivory/80 font-medium">{t('landingSections.trust.countriesTitle')}</span>
            </div>
            <p className="text-sm text-ivory/60 max-w-xl mx-auto">
              {t('landingSections.trust.countriesSubtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-items-center max-w-4xl mx-auto">
            {countries.map((country) => (
              <div
                key={country.code}
                className="flex items-center gap-3 px-6 py-3 rounded-lg bg-ivory/5 border border-gold/20 hover:border-gold/40 transition-all w-full min-w-0"
              >
                <span className="text-3xl">{country.flag}</span>
                <span className="font-medium text-ivory">{country.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
