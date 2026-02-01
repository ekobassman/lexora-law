import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldAlert,
  HelpCircle,
  XCircle
} from 'lucide-react';

interface LegalClassification {
  document_type: string;
  legal_domain: string[];
  authority_or_sender: string;
  aktenzeichen: string | null;
  document_date: string | null;
  deadlines_detected: boolean;
  deadline_date: string | null;
  deadline_type: string | null;
  risk_level: 'low' | 'medium' | 'high';
  classification_confidence: 'high' | 'medium' | 'low';
}

interface ExtractedFacts {
  main_claim: string;
  monetary_amount: string | null;
  legal_basis_cited: string | null;
  required_action: string;
}

interface LegalClassificationCardProps {
  classification: LegalClassification;
  extractedFacts?: ExtractedFacts;
  missingInformation?: string[];
  canProceed?: boolean;
  stopReason?: string | null;
}

export function LegalClassificationCard({
  classification,
  extractedFacts,
  missingInformation,
  canProceed = true,
  stopReason,
}: LegalClassificationCardProps) {
  const { t } = useLanguage();

  const getRiskBadgeVariant = (level: string): 'destructive' | 'secondary' | 'default' => {
    switch (level) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <XCircle className="h-3 w-3" />;
      case 'medium':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <CheckCircle2 className="h-3 w-3" />;
    }
  };

  const getConfidenceBadgeVariant = (level: string): 'destructive' | 'secondary' | 'default' => {
    switch (level) {
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'destructive';
    }
  };

  if (!canProceed) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            {t('legalClassification.cannotProceed')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{stopReason || t('legalClassification.classificationFailed')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5 text-primary" />
          {t('legalClassification.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Classification */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('legalClassification.documentType')}
            </p>
            <Badge variant="outline" className="text-sm">
              {classification.document_type}
            </Badge>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('legalClassification.riskLevel')}
            </p>
            <Badge variant={getRiskBadgeVariant(classification.risk_level)} className="gap-1">
              {getRiskIcon(classification.risk_level)}
              {t(`legalClassification.risk.${classification.risk_level}`)}
            </Badge>
          </div>
        </div>

        {/* Authority */}
        {classification.authority_or_sender && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('legalClassification.authority')}
            </p>
            <p className="text-sm">{classification.authority_or_sender}</p>
          </div>
        )}

        {/* Legal Domains */}
        {classification.legal_domain && classification.legal_domain.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t('legalClassification.legalDomain')}
            </p>
            <div className="flex flex-wrap gap-1">
              {classification.legal_domain.map((domain, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {domain}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Deadline Warning */}
        {classification.deadlines_detected && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
            <Clock className="h-4 w-4 text-warning mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">
                {t('legalClassification.deadlineDetected')}
              </p>
              {classification.deadline_date && (
                <p className="text-sm">{classification.deadline_date}</p>
              )}
              {classification.deadline_type && (
                <p className="text-xs text-muted-foreground">{classification.deadline_type}</p>
              )}
            </div>
          </div>
        )}

        {/* Extracted Facts */}
        {extractedFacts && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t('legalClassification.extractedFacts')}
            </p>
            <ul className="space-y-1 text-sm">
              {extractedFacts.main_claim && (
                <li className="flex items-start gap-2">
                  <FileText className="h-3 w-3 mt-1 text-muted-foreground" />
                  <span>{extractedFacts.main_claim}</span>
                </li>
              )}
              {extractedFacts.monetary_amount && (
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">€</span>
                  <span>{extractedFacts.monetary_amount}</span>
                </li>
              )}
              {extractedFacts.legal_basis_cited && (
                <li className="flex items-start gap-2">
                  <Scale className="h-3 w-3 mt-1 text-muted-foreground" />
                  <span>{extractedFacts.legal_basis_cited}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Missing Information Warning */}
        {missingInformation && missingInformation.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700">
                {t('legalClassification.missingInfo')}
              </p>
              <ul className="text-xs text-amber-600 list-disc list-inside mt-1">
                {missingInformation.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Confidence Indicator */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {t('legalClassification.confidence')}
          </span>
          <Badge variant={getConfidenceBadgeVariant(classification.classification_confidence)}>
            {t(`legalClassification.confidenceLevel.${classification.classification_confidence}`)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
