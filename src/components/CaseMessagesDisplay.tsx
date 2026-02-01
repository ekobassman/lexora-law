import { Badge } from '@/components/ui/badge';
import { MessageCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CaseMessagesDisplayProps {
  messagesUsed: number;
  messagesLimit: number;
  compact?: boolean;
}

/**
 * Displays per-case AI message usage.
 * This is SEPARATE from monthly cases - messages are per-case, not global.
 */
export function CaseMessagesDisplay({ 
  messagesUsed, 
  messagesLimit, 
  compact = false 
}: CaseMessagesDisplayProps) {
  const { t } = useTranslation();
  
  const isUnlimited = messagesLimit >= 999999;
  const atLimit = !isUnlimited && messagesUsed >= messagesLimit;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={atLimit ? 'destructive' : 'outline'} 
              className="gap-1 cursor-help text-xs"
            >
              <MessageCircle className="h-3 w-3" />
              <span>
                {t('credits.caseMessagesLabel', 'Messaggi AI')}: {isUnlimited ? '∞' : `${messagesUsed}/${messagesLimit}`}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium">{t('credits.caseMessagesTitle', 'Messaggi AI per questa pratica')}</p>
            <p className="text-xs text-muted-foreground">
              {t('credits.caseMessagesTooltip', 'Questo limite vale SOLO dentro questa pratica. Non consuma le pratiche mensili.')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {t('credits.caseMessagesLabel', 'Messaggi AI per questa pratica')}:
        </span>
        <Badge variant={atLimit ? 'destructive' : 'secondary'} className="text-xs">
          {isUnlimited ? '∞' : `${messagesUsed}/${messagesLimit}`}
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              {t('credits.caseMessagesTooltip', 'Questo limite vale SOLO dentro questa pratica. Non consuma le pratiche mensili.')}
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}