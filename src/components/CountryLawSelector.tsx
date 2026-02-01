import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage, countries, Country } from '@/contexts/LanguageContext';
import { getLegalRules } from '@/lib/legalRulesEngine';
import { Check, Globe, Scale } from 'lucide-react';

interface CountryLawSelectorProps {
  /** Render as button (default) or just the trigger content */
  variant?: 'button' | 'compact';
  /** Optional class name */
  className?: string;
}

export function CountryLawSelector({ variant = 'button', className }: CountryLawSelectorProps) {
  const { country, setCountry, t, countryInfo } = useLanguage();
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(country);

  const rules = getLegalRules(selectedCountry);
  
  const popularCountries = ['DE', 'AT', 'CH', 'IT', 'FR', 'ES', 'GB'];
  const otherCountries = countries.filter(
    (c) => !popularCountries.includes(c.code) && c.code !== 'OTHER'
  );

  const handleApply = () => {
    setCountry(selectedCountry);
    setOpen(false);
  };

  const triggerContent = (
    <div className="flex items-center gap-2">
      <span className="text-lg">{countryInfo.flag}</span>
      <span className="hidden sm:inline text-sm">{countryInfo.nativeName}</span>
      <Scale className="h-4 w-4 text-muted-foreground" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'button' ? (
          <Button variant="outline" size="sm" className={className}>
            {triggerContent}
          </Button>
        ) : (
          <button className={`flex items-center gap-2 hover:opacity-80 ${className}`}>
            {triggerContent}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Globe className="h-5 w-5 text-primary" />
            {t('settings.lawCountry.title') || 'Legal Jurisdiction'}
          </DialogTitle>
          <DialogDescription>
            {t('settings.lawCountry.desc') || 'Select the country whose laws apply to your cases. This affects legal context, formatting, and AI advice.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Popular countries */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t('common.popular') || 'Popular'}
            </p>
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

          {/* Other countries */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t('common.otherCountries') || 'Other Countries'}
            </p>
            <ScrollArea className="h-32">
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

          {/* Legal context preview */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-medium">{t('common.legalContextPreview') || 'Legal Context'}:</p>
            <p className="text-muted-foreground">
              • {t('common.letterFormat') || 'Letter format'}: <span className="text-foreground">{rules.letterFormat.toUpperCase()}</span>
            </p>
            <p className="text-muted-foreground">
              • {t('common.authorityTerm') || 'Authority term'}: <span className="text-foreground">{rules.authorityTerm}</span>
            </p>
            <p className="text-muted-foreground">
              • {t('common.privacyLaw') || 'Privacy law'}: <span className="text-foreground">{rules.privacyLaw}</span>
            </p>
            {rules.requiresImpressum && (
              <p className="text-muted-foreground">
                • Impressum: <span className="text-foreground">{rules.impressumLaw}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button onClick={handleApply}>
            {t('common.apply') || 'Apply'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
