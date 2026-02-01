import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Shield, Save, FileDown, ArrowRight } from 'lucide-react';

interface RegistrationGateProps {
  action: 'save' | 'export' | 'continue';
  caseId?: string;
  onClose: () => void;
}

export function RegistrationGate({ action, caseId, onClose }: RegistrationGateProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const getTitle = () => {
    switch (action) {
      case 'save':
        return t('registrationGate.saveTitle', 'Save your case');
      case 'export':
        return t('registrationGate.exportTitle', 'Export your document');
      case 'continue':
        return t('registrationGate.continueTitle', 'Continue with Lexora');
      default:
        return t('registrationGate.defaultTitle', 'Create a free account');
    }
  };

  const getDescription = () => {
    switch (action) {
      case 'save':
        return t('registrationGate.saveDesc', 'Create a free account to save this case to your personal dashboard. You can access it anytime and continue where you left off.');
      case 'export':
        return t('registrationGate.exportDesc', 'Create a free account to export your document as PDF or copy the text. Your cases are always accessible.');
      case 'continue':
        return t('registrationGate.continueDesc', 'Create a free account to unlock more features, save your progress, and manage multiple cases.');
      default:
        return t('registrationGate.defaultDesc', 'Create a free account to save your work and access it anytime.');
    }
  };

  const getIcon = () => {
    switch (action) {
      case 'save':
        return <Save className="h-6 w-6" />;
      case 'export':
        return <FileDown className="h-6 w-6" />;
      default:
        return <ArrowRight className="h-6 w-6" />;
    }
  };

  const handleSignup = () => {
    // Store the case ID to migrate after signup
    if (caseId) {
      try {
        sessionStorage.setItem('lexora_pending_case_migration', caseId);
      } catch {
        // Ignore storage errors
      }
    }
    navigate('/auth?mode=signup');
    onClose();
  };

  const handleLogin = () => {
    if (caseId) {
      try {
        sessionStorage.setItem('lexora_pending_case_migration', caseId);
      } catch {
        // Ignore
      }
    }
    navigate('/auth?mode=login');
    onClose();
  };

  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            {getIcon()}
          </div>
          <AlertDialogTitle className="text-xl">{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {getDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Benefits */}
        <div className="my-4 space-y-2">
          {[
            t('registrationGate.benefit1', 'Save and access your cases anytime'),
            t('registrationGate.benefit2', 'Export documents as PDF'),
            t('registrationGate.benefit3', 'Track deadlines and get reminders'),
          ].map((benefit, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleSignup} className="w-full" size="lg">
            {t('registrationGate.createAccount', 'Create free account')}
          </Button>
          <Button onClick={handleLogin} variant="outline" className="w-full">
            {t('registrationGate.login', 'I already have an account')}
          </Button>
          <AlertDialogCancel asChild>
            <Button variant="ghost" className="w-full text-muted-foreground">
              {t('registrationGate.later', 'Maybe later')}
            </Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
