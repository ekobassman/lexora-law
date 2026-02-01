import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage, languages, Language } from '@/contexts/LanguageContext';
import { Globe, Check, X } from 'lucide-react';

interface ChatLanguageSuggestionProps {
  /** Current AI response language (from chat context) */
  currentAiLanguage?: string;
  /** Called when user selects a new language */
  onLanguageChange: (language: Language) => void;
}

export function ChatLanguageSuggestion({ 
  currentAiLanguage, 
  onLanguageChange 
}: ChatLanguageSuggestionProps) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Find current language info
  const currentLangInfo = languages.find(l => l.code === language);
  const displayLang = currentAiLanguage?.toUpperCase() || language;
  const displayLangInfo = languages.find(l => l.code === displayLang) || currentLangInfo;

  if (dismissed) return null;

  const handleSelect = (lang: Language) => {
    onLanguageChange(lang);
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground flex-1">
        {t('chat.responseLanguage') || 'AI responds in'}: 
        <span className="ml-1 font-medium text-foreground">
          {displayLangInfo?.flag} {displayLangInfo?.nativeName || displayLang}
        </span>
      </span>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2">
            {t('common.change') || 'Change'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              {t('chat.selectLanguage') || 'Select response language'}
            </p>
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant={language === lang.code ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start h-8"
                onClick={() => handleSelect(lang.code)}
              >
                <span className="mr-2">{lang.flag}</span>
                <span className="flex-1 text-left">{lang.nativeName}</span>
                {language === lang.code && <Check className="h-3 w-3" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
