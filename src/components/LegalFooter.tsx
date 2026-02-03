import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, FileText, Scale, AlertTriangle, HeadsetIcon, Linkedin, Twitter } from 'lucide-react';
import { ContactForm } from './ContactForm';

interface LegalFooterProps {
  compact?: boolean;
  variant?: 'light' | 'dark';
  showContactForm?: boolean;
  expanded?: boolean;
}

export const LegalFooter = forwardRef<HTMLElement, LegalFooterProps>(function LegalFooter(
  { compact = false, variant = 'light', showContactForm = false, expanded = false },
  ref
) {
  const { t, country } = useLanguage();

  // Show Impressum link only for DE users (or always show for legal compliance)
  const showImpressum = country === 'DE' || country === 'AT' || country === 'CH';

  const textColor = variant === 'dark' ? 'text-ivory/60' : 'text-muted-foreground';
  const hoverColor = variant === 'dark' ? 'hover:text-gold' : 'hover:text-primary';
  const borderColor = variant === 'dark' ? 'border-gold/20' : 'border-border';
  const bgMuted = variant === 'dark' ? 'bg-ivory/5' : 'bg-muted/50';

  if (compact) {
    return (
      <footer ref={ref} className={`border-t ${borderColor} py-4`}>
        <div className="container">
          <div className={`flex flex-wrap items-center justify-center gap-4 text-xs ${textColor}`}>
            <Link to="/privacy" className={hoverColor}>
              {t('footer.privacy')}
            </Link>
            <span>•</span>
            <Link to="/terms" className={hoverColor}>
              {t('footer.terms')}
            </Link>
            <span>•</span>
            <Link to="/disclaimer" className={hoverColor}>
              {t('footer.disclaimer')}
            </Link>
            <span>•</span>
            <Link to="/support" className={hoverColor}>
              {t('nav.support')}
            </Link>
            {showImpressum && (
              <>
                <span>•</span>
                <Link to="/impressum" className={hoverColor}>
                  {t('footer.impressum')}
                </Link>
              </>
            )}
            <span>•</span>
            <span>© {new Date().getFullYear()} LEXORA</span>
          </div>
        </div>
      </footer>
    );
  }

  // Expanded footer for landing page
  if (expanded) {
    return (
      <footer ref={ref} className="bg-navy border-t border-gold/20 py-12 md:py-16">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
            {/* Product */}
            <div>
              <h4 className="font-semibold text-ivory mb-4">{t('footer.product')}</h4>
              <ul className="space-y-3">
                <li>
                  <a href="#how-it-works" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.howItWorks')}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.pricing')}
                  </a>
                </li>
                <li>
                  <a href="#documents" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.supportedDocuments')}
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.faq')}
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold text-ivory mb-4">{t('footer.company')}</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/support" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.aboutUs')}
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.contact')}
                  </Link>
                </li>
                {showImpressum && (
                  <li>
                    <Link to="/impressum" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                      {t('footer.impressum')}
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-ivory mb-4">{t('footer.legal')}</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/privacy" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.privacy')}
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.terms')}
                  </Link>
                </li>
                <li>
                  <Link to="/disclaimer" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.disclaimer')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-semibold text-ivory mb-4">{t('footer.support')}</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/support" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    {t('footer.helpCenter')}
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@lexora-law.com" className="text-ivory/60 hover:text-gold text-sm transition-colors">
                    support@lexora-law.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gold/10 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Logo & Copyright */}
              <div className="flex items-center gap-3">
                <div className="relative flex h-8 w-8 items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
                  <span className="relative font-display text-sm font-semibold text-gold" style={{ fontFamily: 'Georgia, serif' }}>L</span>
                </div>
                <span className="font-display text-lg font-medium tracking-widest text-ivory uppercase">LEXORA</span>
                <span className="text-ivory/40 text-sm">© {new Date().getFullYear()}</span>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-4">
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full border border-gold/20 flex items-center justify-center text-ivory/60 hover:text-gold hover:border-gold/40 transition-all"
                >
                  <Linkedin className="h-4 w-4" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 w-10 rounded-full border border-gold/20 flex items-center justify-center text-ivory/60 hover:text-gold hover:border-gold/40 transition-all"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* AI Disclaimer */}
          <div className="mt-8 pt-6 border-t border-gold/10">
            <div className="flex items-start gap-3 rounded-lg bg-ivory/5 p-4 max-w-3xl mx-auto">
              <Shield className="h-5 w-5 flex-shrink-0 text-gold/60 mt-0.5" />
              <p className="text-xs text-ivory/50 leading-relaxed">
                {t('footer.disclaimerText')}
              </p>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer ref={ref} className={`border-t ${borderColor} py-8`}>
      <div className="container">
        <div className="flex flex-col items-center gap-6">
          {/* Contact Form */}
          {showContactForm && (
            <div className={`w-full max-w-lg rounded-lg ${bgMuted} p-6 border ${borderColor}`}>
              <ContactForm />
            </div>
          )}

          {/* Disclaimer */}
          <div className={`flex items-start gap-2 rounded-lg ${bgMuted} p-4 text-center max-w-2xl`}>
            <Shield className={`h-5 w-5 flex-shrink-0 ${textColor} mt-0.5`} />
            <p className={`text-sm ${textColor} leading-relaxed`}>
              {t('footer.disclaimer')}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <Link to="/privacy" className={`flex items-center gap-1.5 ${textColor} ${hoverColor}`}>
              <Shield className="h-4 w-4" />
              {t('footer.privacy')}
            </Link>
            <Link to="/terms" className={`flex items-center gap-1.5 ${textColor} ${hoverColor}`}>
              <FileText className="h-4 w-4" />
              {t('footer.terms')}
            </Link>
            <Link to="/disclaimer" className={`flex items-center gap-1.5 ${textColor} ${hoverColor}`}>
              <AlertTriangle className="h-4 w-4" />
              {t('footer.disclaimer')}
            </Link>
            <Link to="/support" className={`flex items-center gap-1.5 ${textColor} ${hoverColor}`}>
              <HeadsetIcon className="h-4 w-4" />
              {t('nav.support')}
            </Link>
            {showImpressum && (
              <Link to="/impressum" className={`flex items-center gap-1.5 ${textColor} ${hoverColor}`}>
                <Scale className="h-4 w-4" />
                {t('footer.impressum')}
              </Link>
            )}
          </div>

          {/* Copyright */}
          <div className={`flex items-center gap-2 text-sm ${textColor}`}>
            <Scale className="h-4 w-4" />
            <span className="font-semibold">LEXORA</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  );
});
