import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, FileText, MapPin, Calendar, Hash, Gauge, Camera as CameraIcon, Upload, ArrowRight, ArrowLeft, CheckCircle2, Download, Printer, Send, Scale } from 'lucide-react';
import jsPDF from 'jspdf';

interface AutoveloxWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  praticaId?: string;
}

interface AutoveloxData {
  luogoInfrazione: string;
  dataVerbale: string;
  numeroVerbale: string;
  velocitaRilevata: string;
  velocitaConsentita: string;
  tipoAutovelox: 'fisso' | 'mobile' | 'sconosciuto';
  importoMulta: string;
  enteAccertatore: string;
  taraturaMenzionata: 'si' | 'no' | 'non_so';
  fileUploaded: boolean;
}

const STEPS = [
  { id: 1, title: 'Verbale', icon: Upload },
  { id: 2, title: 'Infrazione', icon: MapPin },
  { id: 3, title: 'Velocità', icon: Gauge },
  { id: 4, title: 'Autovelox', icon: CameraIcon },
  { id: 5, title: 'Taratura', icon: Scale },
  { id: 6, title: 'Ricorso', icon: CheckCircle2 },
];

export function AutoveloxWizard({ open, onOpenChange, praticaId }: AutoveloxWizardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [data, setData] = useState<AutoveloxData>({
    luogoInfrazione: '',
    dataVerbale: '',
    numeroVerbale: '',
    velocitaRilevata: '',
    velocitaConsentita: '',
    tipoAutovelox: 'sconosciuto',
    importoMulta: '',
    enteAccertatore: '',
    taraturaMenzionata: 'non_so',
    fileUploaded: false,
  });

  const progress = (currentStep / STEPS.length) * 100;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato non supportato. Usa PDF, JPG o PNG.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File troppo grande. Massimo 10MB.');
      return;
    }

    setIsUploading(true);
    setUploadedFile(file);

    try {
      // Upload file
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('pratiche-files')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      // Extract text via OCR
      const base64 = await fileToBase64(file);
      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('extract-text', {
        body: {
          base64,
          mimeType: file.type,
          userLanguage: 'it',
        },
      });

      if (ocrError) throw ocrError;

      const text = ocrData?.text || '';
      setExtractedText(text);

      // Try to auto-extract data from verbale
      if (text) {
        await analyzeVerbale(text);
      }

      setData(prev => ({ ...prev, fileUploaded: true }));
      toast.success('Verbale caricato con successo!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Errore durante il caricamento del verbale.');
    } finally {
      setIsUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const analyzeVerbale = async (text: string) => {
    try {
      const { data: analysis, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          praticaId: praticaId,
          message: `Analizza questo verbale di violazione del Codice della Strada italiano e estrai le seguenti informazioni in formato JSON:
{
  "enteAccertatore": "nome dell'ente che ha emesso il verbale",
  "dataVerbale": "data del verbale in formato YYYY-MM-DD",
  "numeroVerbale": "numero del verbale",
  "luogoInfrazione": "luogo dell'infrazione",
  "velocitaRilevata": "velocità rilevata in km/h (solo numero)",
  "velocitaConsentita": "limite di velocità in km/h (solo numero)",
  "tipoAutovelox": "fisso o mobile o sconosciuto",
  "importoMulta": "importo della multa (solo numero)",
  "taraturaMenzionata": "si se è menzionata la taratura, no se non lo è, non_so se non è chiaro"
}

Verbale:
${text}

Rispondi SOLO con il JSON, nient'altro.`,
          userLanguage: 'it',
        },
      });

      if (error) throw error;

      const responseText = analysis?.response || analysis?.text || '';
      
      // Try to parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setData(prev => ({
          ...prev,
          enteAccertatore: parsed.enteAccertatore || prev.enteAccertatore,
          dataVerbale: parsed.dataVerbale || prev.dataVerbale,
          numeroVerbale: parsed.numeroVerbale || prev.numeroVerbale,
          luogoInfrazione: parsed.luogoInfrazione || prev.luogoInfrazione,
          velocitaRilevata: parsed.velocitaRilevata || prev.velocitaRilevata,
          velocitaConsentita: parsed.velocitaConsentita || prev.velocitaConsentita,
          tipoAutovelox: parsed.tipoAutovelox || prev.tipoAutovelox,
          importoMulta: parsed.importoMulta || prev.importoMulta,
          taraturaMenzionata: parsed.taraturaMenzionata || prev.taraturaMenzionata,
        }));
        toast.success('Dati estratti automaticamente dal verbale');
      }
    } catch (err) {
      console.error('Error analyzing verbale:', err);
      // Non-blocking - user can still fill manually
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === STEPS.length - 1) {
      generateRicorso();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateRicorso = async () => {
    setIsLoading(true);
    
    try {
      const { data: aiData, error } = await supabase.functions.invoke('chat-with-ai', {
        body: {
          praticaId: praticaId,
          message: `COMPITO: Genera un RICORSO FORMALE in ITALIANO contro una multa per eccesso di velocità rilevato da autovelox.

**FASE 1 - VERIFICA LEGALE OBBLIGATORIA (PRIMA DI GENERARE IL RICORSO):**

Devi PRIMA verificare e confermare la normativa italiana vigente sulla taratura degli autovelox:

📜 NORMATIVA ITALIANA SULLA TARATURA AUTOVELOX:

1. **Art. 45, comma 6, Codice della Strada (D.Lgs. 285/1992)**:
   - I dispositivi di rilevamento della velocità devono essere sottoposti a verifiche periodiche di funzionalità e taratura
   - L'omologazione non esonera dalla taratura periodica

2. **Sentenza Corte Costituzionale n. 113/2015**:
   - Ha dichiarato l'illegittimità costituzionale dell'art. 45 comma 6 CdS nella parte in cui non prevedeva l'obbligo di verifiche periodiche
   - Le apparecchiature DEVONO essere sottoposte a taratura periodica

3. **Decreto MIT n. 282 del 13/06/2017**:
   - Stabilisce le modalità di verifica periodica
   - La taratura deve essere effettuata ANNUALMENTE
   - Deve essere eseguita da centri autorizzati (SIT - Servizio di Taratura in Italia)

4. **Giurisprudenza Cassazione**:
   - Cass. Civ. n. 18677/2016, n. 3335/2017, n. 19028/2018
   - L'onere della prova della corretta taratura grava sull'amministrazione
   - In assenza di prova della taratura, la sanzione è illegittima

⚠️ CONFERMA: Queste norme sono vigenti e applicabili. Procedi con la generazione del ricorso.

**FASE 2 - DATI DELL'INFRAZIONE:**

- Ente accertatore: ${data.enteAccertatore || 'Non specificato'}
- Luogo infrazione: ${data.luogoInfrazione}
- Data verbale: ${data.dataVerbale}
- Numero verbale: ${data.numeroVerbale || 'Non specificato'}
- Velocità rilevata: ${data.velocitaRilevata} km/h
- Limite consentito: ${data.velocitaConsentita} km/h
- Tipo autovelox: ${data.tipoAutovelox === 'fisso' ? 'Fisso' : data.tipoAutovelox === 'mobile' ? 'Mobile' : 'Non specificato'}
- Importo multa: ${data.importoMulta ? `€${data.importoMulta}` : 'Non specificato'}
- Taratura menzionata nel verbale: ${data.taraturaMenzionata === 'si' ? 'Sì' : data.taraturaMenzionata === 'no' ? 'No' : 'Non verificabile'}

**FASE 3 - GENERAZIONE RICORSO:**

CONTENUTO OBBLIGATORIO:

1. **Citare ESPLICITAMENTE** tutte le fonti normative sopra elencate nel corpo del ricorso
2. **Richiesta formale** di esibizione del certificato di taratura annuale
3. **Contestazione** della validità dell'accertamento in assenza di prova della taratura
4. **Richiesta di annullamento** della sanzione

STRUTTURA:
- Intestazione: "Al Prefetto di [provincia]" OPPURE "Al Giudice di Pace di [città]"
- Dati ricorrente (spazio per compilazione)
- Oggetto chiaro
- Fatto (descrizione dell'infrazione contestata)
- Diritto (citazione delle norme con numeri e date)
- Conclusioni e richieste
- Luogo, data, firma

REQUISITI:
- Lingua: ITALIANO
- Tono: Formale/giuridico
- Nessun riferimento a leggi straniere
- Nessuna promessa di esito favorevole
- Disclaimer finale: "Questo modello di ricorso non costituisce consulenza legale. Si consiglia la verifica con un avvocato."`,
          userLanguage: 'it',
        },
      });

      if (error) throw error;
      
      const draftText = aiData?.response || aiData?.text || 'Errore nella generazione del ricorso.';
      setGeneratedDraft(draftText);
      
      // Save draft to pratica if we have an ID
      if (praticaId) {
        await supabase
          .from('pratiche')
          .update({ 
            draft_response: draftText,
            status: 'in_progress',
            letter_text: extractedText,
          })
          .eq('id', praticaId);
      }
      
      setCurrentStep(STEPS.length);
      toast.success('Ricorso generato con successo!');
    } catch (err) {
      console.error('Error generating ricorso:', err);
      toast.error('Errore nella generazione del ricorso. Riprova.');
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
    
    doc.save(`Ricorso_Autovelox_${data.numeroVerbale || 'Bozza'}.pdf`);
    toast.success('PDF scaricato');
  };

  const handlePrint = () => {
    if (!generatedDraft) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ricorso Multa Autovelox</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.8; white-space: pre-wrap; font-size: 12pt; }
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
    
    const subject = encodeURIComponent(`Ricorso avverso verbale n. ${data.numeroVerbale || ''}`);
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
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Carica il verbale (PDF o foto) *
            </Label>
            
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                className="hidden"
                id="verbale-upload"
                disabled={isUploading}
              />
              <label htmlFor="verbale-upload" className="cursor-pointer">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Analisi in corso...</span>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <span className="text-sm font-medium">{uploadedFile.name}</span>
                    <span className="text-xs text-muted-foreground">Clicca per sostituire</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium">Clicca per caricare</span>
                    <span className="text-xs text-muted-foreground">PDF, JPG, PNG (max 10MB)</span>
                  </div>
                )}
              </label>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <FileText className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Carica il verbale ricevuto. L'AI analizzerà automaticamente il documento ed estrarrà i dati principali.
              </AlertDescription>
            </Alert>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enteAccertatore" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Ente accertatore
              </Label>
              <Input
                id="enteAccertatore"
                value={data.enteAccertatore}
                onChange={(e) => setData({ ...data, enteAccertatore: e.target.value })}
                placeholder="es. Polizia Municipale di Roma"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="luogoInfrazione" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Luogo dell'infrazione *
              </Label>
              <Input
                id="luogoInfrazione"
                value={data.luogoInfrazione}
                onChange={(e) => setData({ ...data, luogoInfrazione: e.target.value })}
                placeholder="es. Via Roma 123, Milano"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataVerbale" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data verbale *
                </Label>
                <Input
                  id="dataVerbale"
                  type="date"
                  value={data.dataVerbale}
                  onChange={(e) => setData({ ...data, dataVerbale: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroVerbale" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Numero verbale
                </Label>
                <Input
                  id="numeroVerbale"
                  value={data.numeroVerbale}
                  onChange={(e) => setData({ ...data, numeroVerbale: e.target.value })}
                  placeholder="es. 12345/2026"
                />
              </div>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="velocitaRilevata" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Velocità rilevata (km/h) *
              </Label>
              <Input
                id="velocitaRilevata"
                type="number"
                value={data.velocitaRilevata}
                onChange={(e) => setData({ ...data, velocitaRilevata: e.target.value })}
                placeholder="es. 78"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="velocitaConsentita">Limite di velocità (km/h) *</Label>
              <Input
                id="velocitaConsentita"
                type="number"
                value={data.velocitaConsentita}
                onChange={(e) => setData({ ...data, velocitaConsentita: e.target.value })}
                placeholder="es. 50"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="importoMulta">Importo multa (€)</Label>
              <Input
                id="importoMulta"
                type="number"
                value={data.importoMulta}
                onChange={(e) => setData({ ...data, importoMulta: e.target.value })}
                placeholder="es. 173"
              />
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <CameraIcon className="h-4 w-4" />
              Tipo di autovelox
            </Label>
            <RadioGroup
              value={data.tipoAutovelox}
              onValueChange={(value) => setData({ ...data, tipoAutovelox: value as AutoveloxData['tipoAutovelox'] })}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="fisso" id="fisso" />
                <Label htmlFor="fisso" className="flex-1 cursor-pointer">
                  <div className="font-medium">Fisso</div>
                  <div className="text-sm text-muted-foreground">Postazione fissa (es. Autovelox, Tutor)</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="mobile" id="mobile" />
                <Label htmlFor="mobile" className="flex-1 cursor-pointer">
                  <div className="font-medium">Mobile</div>
                  <div className="text-sm text-muted-foreground">Postazione mobile (es. Telelaser, Scout Speed)</div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="sconosciuto" id="sconosciuto" />
                <Label htmlFor="sconosciuto" className="flex-1 cursor-pointer">
                  <div className="font-medium">Non so</div>
                  <div className="text-sm text-muted-foreground">Tipo di dispositivo non specificato nel verbale</div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Nel verbale è indicata la data dell'ultima taratura?
            </Label>
            <RadioGroup
              value={data.taraturaMenzionata}
              onValueChange={(value) => setData({ ...data, taraturaMenzionata: value as AutoveloxData['taraturaMenzionata'] })}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="si" id="taratura_si" />
                <Label htmlFor="taratura_si" className="flex-1 cursor-pointer font-medium">
                  Sì, è indicata
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="no" id="taratura_no" />
                <Label htmlFor="taratura_no" className="flex-1 cursor-pointer font-medium">
                  No, non è indicata
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50">
                <RadioGroupItem value="non_so" id="taratura_non_so" />
                <Label htmlFor="taratura_non_so" className="flex-1 cursor-pointer font-medium">
                  Non lo so / Non sono sicuro
                </Label>
              </div>
            </RadioGroup>
            
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Importante:</strong> Secondo la Corte Costituzionale (sent. 113/2015) e il D.M. 282/2017, 
                gli autovelox devono essere tarati annualmente. L'assenza di prova della taratura può invalidare la multa.
              </AlertDescription>
            </Alert>
          </div>
        );
      
      case 6:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-lg font-semibold">Ricorso generato con successo!</span>
            </div>
            
            {generatedDraft && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-sans">{generatedDraft}</pre>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleDownloadPDF} className="gap-2">
                    <Download className="h-4 w-4" />
                    Scarica PDF
                  </Button>
                  <Button variant="outline" onClick={handlePrint} className="gap-2">
                    <Printer className="h-4 w-4" />
                    Stampa
                  </Button>
                  <Button variant="outline" onClick={handleSendEmail} className="gap-2">
                    <Send className="h-4 w-4" />
                    Invia via Email
                  </Button>
                </div>

                <Alert className="border-blue-200 bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Prossimi passi:</strong> Puoi presentare questo ricorso al Prefetto (entro 60 giorni) 
                    o al Giudice di Pace (entro 30 giorni) dalla notifica del verbale.
                  </AlertDescription>
                </Alert>
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
      case 1: return data.fileUploaded;
      case 2: return data.luogoInfrazione.trim().length > 0 && data.dataVerbale.length > 0;
      case 3: return data.velocitaConsentita.length > 0;
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
            <Scale className="h-5 w-5 text-primary" />
            Ricorso Multa Autovelox – Italia
          </DialogTitle>
          <DialogDescription>
            Passo {currentStep} di {STEPS.length}: {STEPS[currentStep - 1]?.title}
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
                Indietro
              </Button>
            )}
            
            {currentStep < STEPS.length - 1 && (
              <Button 
                onClick={handleNext} 
                disabled={!canProceed()} 
                className="gap-2 ml-auto"
              >
                Avanti
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
                    Generazione in corso...
                  </>
                ) : (
                  <>
                    Genera ricorso
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
            
            {currentStep === STEPS.length && (
              <Button onClick={handleClose} className="gap-2 ml-auto">
                Vai alla pratica
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
