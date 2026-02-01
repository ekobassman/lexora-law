import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  FileText, 
  Shield, 
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

interface LegalAnalysis {
  zustellung: string;
  rechtsgrundlage: string;
  rechtsgrundlage_detail?: string;
  forderung: string;
  forderung_detail?: string;
  beweislast: string;
  frist_vorhanden: boolean;
  frist_datum?: string | null;
  risiken: string[];
}

interface TemplateInfo {
  template_type: string;
  template_justification: string;
}

interface Drafts {
  version_standard: string;
  version_reinforced: string;
}

interface QualityCheck {
  no_invented_laws?: boolean;
  no_invented_facts?: boolean;
  template_respected?: boolean;
  din_5008_compliant?: boolean;
  deadline_included_if_required?: boolean;
  server_no_invented_laws?: boolean;
  server_no_forbidden_phrases?: boolean;
  server_structure_valid?: boolean;
  server_deadline_included?: boolean;
}

interface LegalDraftSelectorProps {
  legalAnalysis?: LegalAnalysis;
  templateInfo?: TemplateInfo;
  drafts?: Drafts;
  qualityCheck?: QualityCheck;
  qualityPassed?: boolean;
  warnings?: string[];
  aiDisclaimer?: string;
  onSelectDraft?: (draft: string, version: 'standard' | 'reinforced') => void;
  onApplyDraft?: (draft: string, version: 'standard' | 'reinforced') => void;
  previousDraft?: string | null;
  onUndo?: () => void;
}

export function LegalDraftSelector({
  legalAnalysis,
  templateInfo,
  drafts,
  qualityCheck,
  qualityPassed = true,
  warnings,
  aiDisclaimer,
  onSelectDraft,
  onApplyDraft,
  previousDraft,
  onUndo,
}: LegalDraftSelectorProps) {
  const { t } = useLanguage();
  const [selectedVersion, setSelectedVersion] = useState<'standard' | 'reinforced'>('standard');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t('actions.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(t('actions.copyError'));
    }
  };

  const handleSelectVersion = (version: 'standard' | 'reinforced') => {
    setSelectedVersion(version);
    const draft = version === 'standard' ? drafts?.version_standard : drafts?.version_reinforced;
    if (draft && onSelectDraft) {
      onSelectDraft(draft, version);
    }
  };

  const handleApply = () => {
    const draft = selectedVersion === 'standard' ? drafts?.version_standard : drafts?.version_reinforced;
    if (draft && onApplyDraft) {
      onApplyDraft(draft, selectedVersion);
    }
  };

  const getAnalysisIcon = (value: string) => {
    const positiveValues = ['bewiesen', 'genannt', 'bestätigt'];
    const negativeValues = ['nicht bewiesen', 'nicht genannt', 'bestritten'];
    
    if (positiveValues.some(v => value?.toLowerCase().includes(v))) {
      return <CheckCircle2 className="h-3 w-3 text-green-600" />;
    }
    if (negativeValues.some(v => value?.toLowerCase().includes(v))) {
      return <AlertTriangle className="h-3 w-3 text-amber-600" />;
    }
    return <AlertTriangle className="h-3 w-3 text-muted-foreground" />;
  };

  const getQualityIcon = (passed?: boolean) => {
    if (passed === undefined) return null;
    return passed 
      ? <CheckCircle2 className="h-3 w-3 text-green-600" />
      : <XCircle className="h-3 w-3 text-red-600" />;
  };

  const currentDraft = selectedVersion === 'standard' 
    ? drafts?.version_standard 
    : drafts?.version_reinforced;

  if (!drafts?.version_standard && !drafts?.version_reinforced) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Legal Analysis Summary (Level 2) */}
      {legalAnalysis && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              {t('legalDraft.structuredAnalysis')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-2">
                {getAnalysisIcon(legalAnalysis.zustellung)}
                <span className="text-muted-foreground">{t('legalDraft.service')}:</span>
                <span className="font-medium">{legalAnalysis.zustellung}</span>
              </div>
              <div className="flex items-center gap-2">
                {getAnalysisIcon(legalAnalysis.rechtsgrundlage)}
                <span className="text-muted-foreground">{t('legalDraft.legalBasis')}:</span>
                <span className="font-medium">{legalAnalysis.rechtsgrundlage}</span>
              </div>
              <div className="flex items-center gap-2">
                {getAnalysisIcon(legalAnalysis.forderung)}
                <span className="text-muted-foreground">{t('legalDraft.claim')}:</span>
                <span className="font-medium">{legalAnalysis.forderung}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('legalDraft.burdenOfProof')}:</span>
                <span className="font-medium">{legalAnalysis.beweislast}</span>
              </div>
              <div className="flex items-center gap-2">
                {legalAnalysis.frist_vorhanden 
                  ? <AlertTriangle className="h-3 w-3 text-amber-600" />
                  : <CheckCircle2 className="h-3 w-3 text-green-600" />
                }
                <span className="text-muted-foreground">{t('legalDraft.deadline')}:</span>
                <span className="font-medium">
                  {legalAnalysis.frist_vorhanden 
                    ? legalAnalysis.frist_datum || t('legalDraft.deadlinePresent')
                    : t('legalDraft.noDeadline')
                  }
                </span>
              </div>
            </div>

            {/* Risks */}
            {legalAnalysis.risiken && legalAnalysis.risiken.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                <p className="text-xs font-medium text-amber-700 mb-1">
                  {t('legalDraft.risks')}:
                </p>
                <ul className="text-xs list-disc list-inside text-amber-600">
                  {legalAnalysis.risiken.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Template Info (Level 3) */}
      {templateInfo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span>{t('legalDraft.template')}:</span>
          <Badge variant="outline" className="text-xs">{templateInfo.template_type}</Badge>
        </div>
      )}

      {/* Draft Version Selector (Level 5) */}
      <Tabs value={selectedVersion} onValueChange={(v) => handleSelectVersion(v as 'standard' | 'reinforced')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="standard" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('legalDraft.versionStandard')}
          </TabsTrigger>
          <TabsTrigger value="reinforced" className="gap-2">
            <Zap className="h-4 w-4" />
            {t('legalDraft.versionReinforced')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="mt-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 z-10"
              onClick={() => drafts?.version_standard && handleCopy(drafts.version_standard)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 pr-12 text-sm max-h-96 overflow-y-auto">
              {drafts?.version_standard || t('legalDraft.noDraft')}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reinforced" className="mt-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 z-10"
              onClick={() => drafts?.version_reinforced && handleCopy(drafts.version_reinforced)}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 pr-12 text-sm max-h-96 overflow-y-auto">
              {drafts?.version_reinforced || t('legalDraft.noDraft')}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Apply / Undo buttons */}
      <div className="flex gap-2">
        <Button onClick={handleApply} className="flex-1 gap-2" disabled={!currentDraft}>
          <CheckCircle2 className="h-4 w-4" />
          {t('legalDraft.applyDraft')}
        </Button>
        {previousDraft && onUndo && (
          <Button variant="outline" onClick={onUndo} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t('legalDraft.undo')}
          </Button>
        )}
      </div>

      {/* Quality Check (Automatic QC) */}
      {qualityCheck && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            {qualityPassed 
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-amber-600" />
            }
            <span>{t('legalDraft.qualityCheck')}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              {getQualityIcon(qualityCheck.server_no_invented_laws ?? qualityCheck.no_invented_laws)}
              <span>{t('legalDraft.lawsOk')}</span>
            </div>
            <div className="flex items-center gap-1">
              {getQualityIcon(qualityCheck.server_no_forbidden_phrases ?? qualityCheck.no_invented_facts)}
              <span>{t('legalDraft.phrasesOk')}</span>
            </div>
            <div className="flex items-center gap-1">
              {getQualityIcon(qualityCheck.server_structure_valid ?? qualityCheck.template_respected)}
              <span>{t('legalDraft.structureOk')}</span>
            </div>
            <div className="flex items-center gap-1">
              {getQualityIcon(qualityCheck.din_5008_compliant)}
              <span>DIN 5008</span>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-700 mb-1">
            {t('legalDraft.warnings')}:
          </p>
          <ul className="text-xs list-disc list-inside text-amber-600">
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Disclaimer */}
      <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded-md p-2">
        {aiDisclaimer || t('legalDraft.disclaimer')}
      </div>
    </div>
  );
}
