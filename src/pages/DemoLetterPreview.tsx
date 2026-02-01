import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Copy, ArrowLeft, Printer, AlertTriangle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { containsPlaceholders, sanitizeDocument, findPlaceholder } from "@/utils/documentSanitizer";
import { useLanguage } from "@/contexts/LanguageContext";

const DEMO_LETTER_SESSION_KEY = "lexora_demo_letter_draft_v1";
const DASHBOARD_LETTER_SESSION_KEY = "lexora_dashboard_letter_draft";

const warningMessages: Record<string, { title: string; description: string; backToChat: string }> = {
  IT: {
    title: "⚠️ Documento incompleto",
    description: "Il documento contiene dati mancanti. Torna alla chat e rispondi alle domande dell'assistente per completare tutte le informazioni necessarie.",
    backToChat: "Torna alla chat",
  },
  DE: {
    title: "⚠️ Unvollständiges Dokument", 
    description: "Das Dokument enthält fehlende Daten. Kehren Sie zum Chat zurück und beantworten Sie die Fragen des Assistenten, um alle erforderlichen Informationen zu vervollständigen.",
    backToChat: "Zurück zum Chat",
  },
  EN: {
    title: "⚠️ Incomplete document",
    description: "The document contains missing data. Return to the chat and answer the assistant's questions to complete all required information.",
    backToChat: "Back to chat",
  },
  FR: {
    title: "⚠️ Document incomplet",
    description: "Le document contient des données manquantes. Retournez au chat et répondez aux questions de l'assistant pour compléter toutes les informations requises.",
    backToChat: "Retour au chat",
  },
  ES: {
    title: "⚠️ Documento incompleto",
    description: "El documento contiene datos faltantes. Regresa al chat y responde las preguntas del asistente para completar toda la información requerida.",
    backToChat: "Volver al chat",
  },
};

export default function DemoLetterPreview() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    try {
      // Prefer the Dashboard draft if present, fallback to the public demo draft.
      const txt =
        sessionStorage.getItem(DASHBOARD_LETTER_SESSION_KEY) ||
        sessionStorage.getItem(DEMO_LETTER_SESSION_KEY) ||
        "";
      setDraft(txt);
    } catch {
      setDraft("");
    }
  }, []);

  const hasDraft = useMemo(() => draft.trim().length > 0, [draft]);
  const hasPlaceholders = useMemo(() => containsPlaceholders(draft), [draft]);
  const placeholderFound = useMemo(() => findPlaceholder(draft), [draft]);
  const printableDraft = useMemo(() => sanitizeDocument(draft), [draft]);
  
  const msgs = warningMessages[language] || warningMessages.EN;

  const handleCopy = async () => {
    if (hasPlaceholders) {
      toast.error(msgs.description);
      return;
    }
    try {
      await navigator.clipboard.writeText(printableDraft);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handlePrint = () => {
    if (hasPlaceholders) {
      toast.error(msgs.description);
      return;
    }
    // Must be direct user gesture (iOS Safari)
    window.print();
  };

  const handleBackToChat = () => {
    navigate(-1);
  };

  return (
    <main className="min-h-[100dvh] bg-background flex flex-col">
      {/* Top bar (hidden in print) */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto w-full max-w-[900px] px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="ghost" className="gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopy} disabled={!hasDraft || hasPlaceholders} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button onClick={handlePrint} disabled={!hasDraft || hasPlaceholders} className="gap-2">
              <Printer className="h-4 w-4" />
              Print now
            </Button>
          </div>
        </div>
      </header>

      {/* Letter only */}
      <section className="flex-1 min-h-0">
        <div
          id="demo-letter-only"
          className="mx-auto w-full max-w-[900px] px-4 py-4"
        >
          {!hasDraft ? (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground print:hidden">
              No draft available. Go back to the demo chat and generate a letter first.
            </div>
          ) : hasPlaceholders ? (
            <div className="space-y-4 print:hidden">
              {/* Warning banner with action */}
              <div className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">{msgs.title}</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300">{msgs.description}</p>
                    {placeholderFound && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-mono">
                        Placeholder trovato: {placeholderFound}
                      </p>
                    )}
                    <Button 
                      onClick={handleBackToChat} 
                      className="mt-3 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {msgs.backToChat}
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Show the draft anyway so user can see what's there */}
              <div className="rounded-lg border bg-card/50 p-4 opacity-60">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Bozza con dati mancanti:</p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {draft}
                </pre>
              </div>
            </div>
          ) : (
            <article className="rounded-lg border bg-card p-4 print:border-0 print:bg-white print:p-0">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground print:font-serif print:text-[11pt] print:leading-[1.5]">
                {printableDraft}
              </pre>
            </article>
          )}
        </div>
      </section>

      <style>{`
        @media print {
          /* Ensure ONLY the letter is printed */
          body { background: white !important; }
          #root { display: block !important; }
          #demo-letter-only { max-width: none !important; padding: 0 !important; }
          #demo-letter-only article { border: 0 !important; background: white !important; }
          #demo-letter-only pre { padding: 27mm 20mm 25mm 25mm !important; margin: 0 !important; }

          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </main>
  );
}
