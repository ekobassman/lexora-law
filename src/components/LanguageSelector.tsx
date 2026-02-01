import { useLanguage, languages, countries, Language, Country } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Globe, Languages } from 'lucide-react';
import { useState } from 'react';

export function LanguageSelector() {
  const { language, setLanguage, languageInfo, country, setCountry, countryInfo } = useLanguage();
  const [showCountries, setShowCountries] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 text-ivory/70 hover:text-gold hover:bg-transparent"
        >
          <span className="text-xs uppercase leading-none">{languageInfo.code}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto z-50 bg-ivory border-gold/20">
        {!showCountries ? (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              <Languages className="h-3 w-3" />
              Lingua / Language
            </DropdownMenuLabel>
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`gap-3 cursor-pointer text-navy hover:bg-gold/10 ${language === lang.code ? 'bg-gold/20 font-medium' : ''}`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="text-sm">{lang.nativeName}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-navy/10" />
            <DropdownMenuItem
              onClick={() => setShowCountries(true)}
              className="gap-3 cursor-pointer text-navy/70 hover:bg-gold/10"
            >
              <Globe className="h-4 w-4" />
              <span className="text-sm">🌍 {countryInfo.nativeName}</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              Paese / Country
            </DropdownMenuLabel>
            {countries.filter(c => c.code !== 'OTHER').map((c) => (
              <DropdownMenuItem
                key={c.code}
                onClick={() => {
                  setCountry(c.code);
                  setShowCountries(false);
                }}
                className={`gap-3 cursor-pointer text-navy hover:bg-gold/10 ${country === c.code ? 'bg-gold/20 font-medium' : ''}`}
              >
                <span className="text-base">{c.flag}</span>
                <span className="text-sm">{c.nativeName}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-navy/10" />
            <DropdownMenuItem
              onClick={() => setShowCountries(false)}
              className="gap-3 cursor-pointer text-navy/70 hover:bg-gold/10"
            >
              <Languages className="h-4 w-4" />
              <span className="text-sm">← Back</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
