import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage, countries, languages, Country, Language } from '@/contexts/LanguageContext';
import { getLegalRules } from '@/lib/legalRulesEngine';
import { Check, Globe } from 'lucide-react';
import i18n from '@/i18n';

interface CountryOnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function CountryOnboardingDialog({ open, onComplete }: CountryOnboardingDialogProps) {
  const { country, setCountry, language, setLanguage } = useLanguage();
  const [selectedCountry, setSelectedCountry] = useState<Country>(country);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [step, setStep] = useState<'country' | 'language'>('country');

  // When country changes, suggest matching language
  useEffect(() => {
    const countryInfo = countries.find((c) => c.code === selectedCountry);
    if (countryInfo) {
      const defaultLang = countryInfo.defaultLanguage;
      if (languages.find((l) => l.code === defaultLang)) {
        setSelectedLanguage(defaultLang);
      }
    }
  }, [selectedCountry]);

  const handleContinue = () => {
    if (step === 'country') {
      setStep('language');
    } else {
      // Apply selections
      setCountry(selectedCountry);
      setLanguage(selectedLanguage);
      // Mark onboarding complete
      localStorage.setItem('lexora-onboarding-complete', 'true');
      onComplete();
    }
  };

  const rules = getLegalRules(selectedCountry);

  // Group countries by region for better UX
  const popularCountries = ['DE', 'AT', 'CH', 'IT', 'FR', 'ES', 'GB'];
  const otherCountries = countries.filter((c) => !popularCountries.includes(c.code) && c.code !== 'OTHER');

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Globe className="h-5 w-5 text-primary" />
            {step === 'country' ? 'Select Your Country' : 'Select Your Language'}
          </DialogTitle>
          <DialogDescription>
            {step === 'country'
              ? 'This helps us show the correct legal context and formatting for your documents.'
              : 'Choose the language for the Lexora interface.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'country' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Popular</p>
              <div className="grid grid-cols-2 gap-2">
                {countries
                  .filter((c) => popularCountries.includes(c.code))
                  .map((c) => (
                    <Button
                      key={c.code}
                      variant={selectedCountry === c.code ? 'default' : 'outline'}
                      className="justify-start h-auto py-3 px-4"
                      onClick={() => setSelectedCountry(c.code)}
                    >
                      <span className="text-lg mr-2">{c.flag}</span>
                      <span className="flex-1 text-left">{c.nativeName}</span>
                      {selectedCountry === c.code && <Check className="h-4 w-4 ml-2" />}
                    </Button>
                  ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Other Countries</p>
              <ScrollArea className="h-40">
                <div className="grid grid-cols-2 gap-2 pr-4">
                  {otherCountries.map((c) => (
                    <Button
                      key={c.code}
                      variant={selectedCountry === c.code ? 'default' : 'outline'}
                      className="justify-start h-auto py-2 px-3 text-sm"
                      onClick={() => setSelectedCountry(c.code)}
                    >
                      <span className="mr-2">{c.flag}</span>
                      <span className="flex-1 text-left truncate">{c.nativeName}</span>
                      {selectedCountry === c.code && <Check className="h-3 w-3 ml-1" />}
                    </Button>
                  ))}
                  <Button
                    variant={selectedCountry === 'OTHER' ? 'default' : 'outline'}
                    className="justify-start h-auto py-2 px-3 text-sm"
                    onClick={() => setSelectedCountry('OTHER')}
                  >
                    <span className="mr-2">🌍</span>
                    <span className="flex-1 text-left">Other</span>
                    {selectedCountry === 'OTHER' && <Check className="h-3 w-3 ml-1" />}
                  </Button>
                </div>
              </ScrollArea>
            </div>

            {/* Preview legal context */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium">Legal Context Preview:</p>
              <p className="text-muted-foreground">
                • Letter format: <span className="text-foreground">{rules.letterFormat.toUpperCase()}</span>
              </p>
              <p className="text-muted-foreground">
                • Authority term: <span className="text-foreground">{rules.authorityTerm}</span>
              </p>
              <p className="text-muted-foreground">
                • Privacy law: <span className="text-foreground">{rules.privacyLaw}</span>
              </p>
              {rules.requiresImpressum && (
                <p className="text-muted-foreground">
                  • Impressum required: <span className="text-foreground">{rules.impressumLaw}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {languages.map((lang) => (
                <Button
                  key={lang.code}
                  variant={selectedLanguage === lang.code ? 'default' : 'outline'}
                  className="justify-start h-auto py-3 px-4"
                  onClick={() => setSelectedLanguage(lang.code)}
                >
                  <span className="text-lg mr-2">{lang.flag}</span>
                  <span className="flex-1 text-left">{lang.nativeName}</span>
                  {selectedLanguage === lang.code && <Check className="h-4 w-4 ml-2" />}
                </Button>
              ))}
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                The interface will be displayed in <span className="font-medium text-foreground">{languages.find((l) => l.code === selectedLanguage)?.nativeName}</span>.
                You can change this anytime in Settings.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-4">
          {step === 'language' && (
            <Button variant="ghost" onClick={() => setStep('country')}>
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button onClick={handleContinue}>
            {step === 'country' ? 'Continue' : 'Get Started'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
