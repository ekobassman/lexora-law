import { useLanguage, languages, Language } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';

interface LegalPageLanguageSwitchProps {
  variant?: 'light' | 'dark';
}

export function LegalPageLanguageSwitch({ variant = 'dark' }: LegalPageLanguageSwitchProps) {
  const { language, setLanguage } = useLanguage();

  const textColor = variant === 'dark' ? 'text-ivory' : 'text-foreground';
  const borderColor = variant === 'dark' ? 'border-gold/30' : 'border-border';
  const bgColor = variant === 'dark' ? 'bg-transparent' : 'bg-background';
  const hoverBg = variant === 'dark' ? 'hover:bg-ivory/10' : 'hover:bg-accent';

  return (
    <div className="flex items-center gap-2">
      <Globe className={`h-4 w-4 ${variant === 'dark' ? 'text-gold' : 'text-muted-foreground'}`} />
      <Select
        value={language}
        onValueChange={(value) => setLanguage(value as Language)}
      >
        <SelectTrigger 
          className={`w-[140px] ${textColor} ${borderColor} ${bgColor} ${hoverBg}`}
        >
          <SelectValue>
            {languages.find(l => l.code === language)?.flag}{' '}
            {languages.find(l => l.code === language)?.nativeName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
