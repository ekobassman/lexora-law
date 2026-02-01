import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, FileText, MapPin, Calendar, Hash, Gauge, Camera as CameraIcon, Mail, ArrowRight, ArrowLeft, CheckCircle2, Download, Printer, Send } from 'lucide-react';
import jsPDF from 'jspdf';

interface BlitzerWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  praticaId?: string;
}

interface BlitzerData {
  messort: string;
  bescheidDatum: string;
  aktenzeichen: string;
  gemesseneGeschwindigkeit: string;
  erlaubteGeschwindigkeit: string;
  blitzerArt: 'stationaer' | 'mobil' | 'unbekannt';
  postZustellung: 'ja' | 'nein';
}

const STEPS = [
  { id: 1, title: 'Messort', icon: MapPin },
  { id: 2, title: 'Bescheid', icon: Calendar },
  { id: 3, title: 'Geschwindigkeit', icon: Gauge },
  { id: 4, title: 'Blitzerart', icon: CameraIcon },
  { id: 5, title: 'Zustellung', icon: Mail },
  { id: 6, title: 'Fertig', icon: CheckCircle2 },
];

export function BlitzerWizard({ open, onOpenChange, praticaId }: BlitzerWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [data, setData] = useState<BlitzerData>({
    messort: '',
    bescheidDatum: '',
    aktenzeichen: '',
    gemesseneGeschwindigkeit: '',
    erlaubteGeschwindigkeit: '',
    blitzerArt: 'unbekannt',
    postZustellung: 'ja',
  });

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === STEPS.length - 1) {
      generateDraft();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateDraft = async () => {
    setIsLoading(true);
    
    try {
      // Generate the objection letter using AI with legal verification
      const { data: aiData, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          praticaId: praticaId,
          message: `AUFGABE: Erstelle einen formellen Einspruch gegen einen Bußgeldbescheid wegen Geschwindigkeitsüberschreitung.

**SCHRITT 1 - RECHTLICHE PRÜFUNG (OBLIGATORISCH):**
Bevor du den Einspruch erstellst, MUSST du die geltenden deutschen Gesetze zur Eichpflicht von Geschwindigkeitsmessgeräten bestätigen:

- Mess- und Eichgesetz (MessEG) - insbesondere §§ 31, 32, 37
- Mess- und Eichverordnung (MessEV) - Anlage 2
- PTB-Anforderungen (Physikalisch-Technische Bundesanstalt)
- Eichfrist: Messgeräte müssen in der Regel jährlich oder alle 2 Jahre geeicht werden (je nach Gerätetyp)
- Ohne gültigen Eichschein ist die Messung rechtlich angreifbar

Bestätige diese rechtliche Grundlage im Einspruch.

**SCHRITT 2 - EINSPRUCH ERSTELLEN:**

DATEN DES VORGANGS:
- Messort: ${data.messort}
- Datum des Bescheids: ${data.bescheidDatum}
- Aktenzeichen: ${data.aktenzeichen || 'nicht angegeben'}
- Gemessene Geschwindigkeit: ${data.gemesseneGeschwindigkeit} km/h
- Erlaubte Geschwindigkeit: ${data.erlaubteGeschwindigkeit} km/h
- Art des Blitzers: ${data.blitzerArt === 'stationaer' ? 'Stationär' : data.blitzerArt === 'mobil' ? 'Mobil' : 'Unbekannt'}
- Per Post erhalten: ${data.postZustellung === 'ja' ? 'Ja' : 'Nein'}

PFLICHTINHALT DES EINSPRUCHS:

1. **Anforderung des Eichzertifikats (ZENTRAL)**: 
   - Formelle Aufforderung zur Vorlage des gültigen Eichscheins
   - Verweis auf MessEG und MessEV als Rechtsgrundlage
   - Hinweis, dass ohne Nachweis der gültigen Eichung die Messung nicht verwertbar ist

2. **Rechtliche Begründung**:
   - Verweis auf die gesetzliche Eichpflicht
   - Hinweis auf mögliche Messfehler bei fehlender/abgelaufener Eichung
   - Antrag auf Akteneinsicht (inkl. Eichprotokoll, Schulungsnachweis des Messbeamten)

3. **Formelle Anforderungen**:
   - Sachlich und formell
   - Frist wahren (2 Wochen nach Zustellung)
   - DIN 5008 Briefformat
   - Klarer Antrag auf Einstellung des Verfahrens

Formatiere den Brief vollständig mit Absender, Empfänger, Datum, Betreff und Unterschriftszeile.
Keine Garantie auf Erfolg versprechen.`,
          userLanguage: 'de',
        },
      });

      if (error) throw error;
      
      const draftText = aiData?.response || aiData?.text || 'Fehler beim Erstellen des Einspruchs.';
      setGeneratedDraft(draftText);
      
      // Save draft to pratica if we have an ID
      if (praticaId) {
        await supabase
          .from('pratiche')
          .update({ 
            draft_response: draftText,
            status: 'in_progress'
          })
          .eq('id', praticaId);
      }
      
      setCurrentStep(STEPS.length);
      toast.success('Einspruch erfolgreich erstellt!');
    } catch (err) {
      console.error('Error generating draft:', err);
      toast.error('Fehler beim Erstellen des Einspruchs. Bitte erneut versuchen.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!generatedDraft) return;
    
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - 2 * margin;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    
    const lines = doc.splitTextToSize(generatedDraft, maxLineWidth);
    let y = margin;
    
    lines.forEach((line: string) => {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 6;
    });
    
    doc.save(`Einspruch_Blitzer_${data.aktenzeichen || 'Entwurf'}.pdf`);
    toast.success('PDF heruntergeladen');
  };

  const handlePrint = () => {
    if (!generatedDraft) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Einspruch gegen Bußgeldbescheid</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; white-space: pre-wrap; }
          </style>
        </head>
        <body>${generatedDraft}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSendEmail = () => {
    if (!generatedDraft) return;
    
    const subject = encodeURIComponent(`Einspruch gegen Bußgeldbescheid ${data.aktenzeichen || ''}`);
    const body = encodeURIComponent(generatedDraft);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (praticaId) {
      navigate(`/pratica/${praticaId}`);
    } else {
      navigate('/dashboard');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <Label htmlFor="messort" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ort / Stadt der Messung *
            </Label>
            <Input
              id="messort"
              value={data.messort}
              onChange={(e) => setData({ ...data, messort: e.target.value })}
              placeholder="z.B. Berlin, A10 Höhe Ausfahrt Potsdam"
              required
            />
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bescheidDatum" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Datum des Bußgeldbescheids *
              </Label>
              <Input
                id="bescheidDatum"
                type="date"
                value={data.bescheidDatum}
                onChange={(e) => setData({ ...data, bescheidDatum: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aktenzeichen" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Aktenzeichen (falls vorhanden)
              </Label>
              <Input
                id="aktenzeichen"
                value={data.aktenzeichen}
                onChange={(e) => setData({ ...data, aktenzeichen: e.target.value })}
                placeholder="z.B. 12345/2026"
              />
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemessene" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Gemessene Geschwindigkeit (km/h)
              </Label>
              <Input
                id="gemessene"
                type="number"
                value={data.gemesseneGeschwindigkeit}
                onChange={(e) => setData({ ...data, gemesseneGeschwindigkeit: e.target.value })}
                placeholder="z.B. 68"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="erlaubte">Erlaubte Geschwindigkeit (km/h) *</Label>
              <Input
                id="erlaubte"
                type="number"
                value={data.erlaubteGeschwindigkeit}
                onChange={(e) => setData({ ...data, erlaubteGeschwindigkeit: e.target.value })}
                placeholder="z.B. 50"
                required
              />
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <CameraIcon className="h-4 w-4" />
              Art des Blitzers
            </Label>
            <RadioGroup
              value={data.blitzerArt}
              onValueChange={(value) => setData({ ...data, blitzerArt: value as BlitzerData['blitzerArt'] })}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="stationaer" id="stationaer" />
                <Label htmlFor="stationaer" className="flex-1 cursor-pointer">
                  <div className="font-medium">Stationär</div>
                  <div className="text-sm text-muted-foreground">Fest installierte Blitzanlage</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="mobil" id="mobil" />
                <Label htmlFor="mobil" className="flex-1 cursor-pointer">
                  <div className="font-medium">Mobil</div>
                  <div className="text-sm text-muted-foreground">Mobile Messung (z.B. Laserpistole, Messfahrzeug)</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="unbekannt" id="unbekannt" />
                <Label htmlFor="unbekannt" className="flex-1 cursor-pointer">
                  <div className="font-medium">Unbekannt</div>
                  <div className="text-sm text-muted-foreground">Art des Messgeräts nicht bekannt</div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Haben Sie den Bescheid per Post erhalten?
            </Label>
            <RadioGroup
              value={data.postZustellung}
              onValueChange={(value) => setData({ ...data, postZustellung: value as BlitzerData['postZustellung'] })}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="ja" id="ja" />
                <Label htmlFor="ja" className="flex-1 cursor-pointer font-medium">Ja</Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="nein" id="nein" />
                <Label htmlFor="nein" className="flex-1 cursor-pointer font-medium">Nein</Label>
              </div>
            </RadioGroup>
            
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Geschwindigkeitsmessgeräte müssen regelmäßig geeicht sein. 
                Fehlende oder abgelaufene Eichung kann den Bescheid angreifbar machen.
              </AlertDescription>
            </Alert>
          </div>
        );
      
      case 6:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-lg font-semibold">Einspruch erfolgreich erstellt!</span>
            </div>
            
            {generatedDraft && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-sans">{generatedDraft}</pre>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleDownloadPDF} className="gap-2">
                    <Download className="h-4 w-4" />
                    PDF herunterladen
                  </Button>
                  <Button variant="outline" onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Drucken
                  </Button>
                  <Button variant="outline" onClick={handleSendEmail} className="gap-2">
                    <Send className="h-4 w-4" />
                    Per E-Mail senden
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return data.messort.trim().length > 0;
      case 2: return data.bescheidDatum.length > 0;
      case 3: return data.erlaubteGeschwindigkeit.length > 0;
      case 4: return true;
      case 5: return true;
      default: return true;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Einspruch gegen Blitzer-Bußgeld
          </DialogTitle>
          <DialogDescription>
            Schritt {currentStep} von {STEPS.length}: {STEPS[currentStep - 1]?.title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Progress bar */}
          <Progress value={progress} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-1 ${
                    isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                  }`}
                >
                  <div className={`rounded-full p-2 ${
                    isActive ? 'bg-primary/10' : isCompleted ? 'bg-green-100' : 'bg-muted'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Step content */}
          <Card>
            <CardContent className="pt-6">
              {renderStep()}
            </CardContent>
          </Card>
          
          {/* Navigation buttons */}
          <div className="flex justify-between pt-4">
            {currentStep > 1 && currentStep < STEPS.length && (
              <Button variant="outline" onClick={handleBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Zurück
              </Button>
            )}
            
            {currentStep < STEPS.length - 1 && (
              <Button 
                onClick={handleNext} 
                disabled={!canProceed()} 
                className="gap-2 ml-auto"
              >
                Weiter
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            
            {currentStep === STEPS.length - 1 && (
              <Button 
                onClick={handleNext} 
                disabled={!canProceed() || isLoading} 
                className="gap-2 ml-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Wird erstellt...
                  </>
                ) : (
                  <>
                    Einspruch erstellen
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
            
            {currentStep === STEPS.length && (
              <Button onClick={handleClose} className="gap-2 ml-auto">
                Fertig
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
