import { CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { LegalLoader } from '@/components/LegalLoader';

export type AnalysisStep = 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'completed' | 'error';

interface AnalysisStatusProps {
  step: AnalysisStep;
  progress?: number;
  error?: string | null;
}

export function AnalysisStatus({ step, progress = 0, error }: AnalysisStatusProps) {
  const { t } = useLanguage();

  if (step === 'idle') return null;

  const stepConfig: Record<AnalysisStep, { icon: React.ReactNode; label: string; color: string }> = {
    idle: { icon: null, label: '', color: '' },
    uploading: { 
      icon: <LegalLoader size="sm" message="" subtitle="" />, 
      label: t('analysis.uploading'),
      color: 'text-primary'
    },
    extracting: { 
      icon: <LegalLoader size="sm" message="" subtitle="" />, 
      label: t('analysis.extracting'),
      color: 'text-primary'
    },
    analyzing: { 
      icon: <Sparkles className="h-5 w-5 animate-pulse" />, 
      label: t('analysis.analyzing'),
      color: 'text-primary'
    },
    completed: { 
      icon: <CheckCircle className="h-5 w-5" />, 
      label: t('analysis.completed'),
      color: 'text-success'
    },
    error: { 
      icon: <AlertCircle className="h-5 w-5" />, 
      label: error || t('analysis.error'),
      color: 'text-destructive'
    },
  };

  const config = stepConfig[step];

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className={`flex items-center gap-3 ${config.color}`}>
        {config.icon}
        <span className="font-medium">{config.label}</span>
      </div>
      
      {(step === 'uploading' || step === 'extracting' || step === 'analyzing') && (
        <Progress value={progress} className="h-2" />
      )}
      
      {step === 'analyzing' && (
        <p className="text-sm text-muted-foreground">
          {t('analysis.analyzingHint')}
        </p>
      )}
    </div>
  );
}
