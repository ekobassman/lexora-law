import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, AlertTriangle, Bot, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ConsentDialogProps {
  open: boolean;
  onAccept: () => void;
}

export function ConsentDialog({ open, onAccept }: ConsentDialogProps) {
  const { t, isRTL } = useLanguage();
  const [consents, setConsents] = useState({
    aiSystem: false,
    mayContainErrors: false,
    userResponsibility: false,
    notLegalAdvice: false,
  });

  const allChecked = Object.values(consents).every(Boolean);

  const handleAccept = () => {
    if (allChecked) {
      onAccept();
    }
  };

  const consentItems = [
    {
      key: 'aiSystem',
      icon: Bot,
      text: t('consent.aiSystem'),
    },
    {
      key: 'mayContainErrors',
      icon: AlertTriangle,
      text: t('consent.mayContainErrors'),
    },
    {
      key: 'userResponsibility',
      icon: FileCheck,
      text: t('consent.userResponsibility'),
    },
    {
      key: 'notLegalAdvice',
      icon: Shield,
      text: t('consent.notLegalAdvice'),
    },
  ];

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            {t('consent.title')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t('consent.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {consentItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  id={item.key}
                  checked={consents[item.key as keyof typeof consents]}
                  onCheckedChange={(checked) =>
                    setConsents((prev) => ({ ...prev, [item.key]: checked === true }))
                  }
                />
                <div className="flex flex-1 items-start gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <Label
                    htmlFor={item.key}
                    className="cursor-pointer text-sm leading-relaxed"
                  >
                    {item.text}
                  </Label>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          {t('consent.readMore')}{' '}
          <Link to="/privacy" className="text-primary hover:underline">
            {t('consent.privacyLink')}
          </Link>{' '}
          &{' '}
          <Link to="/terms" className="text-primary hover:underline">
            {t('consent.tosLink')}
          </Link>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!allChecked}
            className="w-full"
            size="lg"
          >
            {t('consent.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
