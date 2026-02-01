import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, FileDown, Mail, Printer, Copy, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { formatCapCity, formatSenderLine } from '@/lib/formatAddress';
import { containsPlaceholders, sanitizeDocument, getPlaceholderErrorMessage } from '@/utils/documentSanitizer';

interface SenderData {
  sender_name: string | null;
  sender_address: string | null;
  sender_postal_code: string | null;
  sender_city: string | null;
  sender_country: string | null;
  sender_date: string | null;
}

interface DraftActionsProps {
  draftResponse: string | null;
  praticaTitle: string;
  authority: string | null;
  aktenzeichen: string | null;
  senderData?: SenderData;
}

interface UserProfile {
  full_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
}

export function DraftActions({ draftResponse, praticaTitle, authority, aktenzeichen, senderData }: DraftActionsProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  const isDisabled = !draftResponse || draftResponse.trim().length === 0;
  
  // Sanitized draft for display and export (memoized)
  const sanitizedDraft = useMemo(() => {
    if (!draftResponse) return '';
    return sanitizeDocument(draftResponse);
  }, [draftResponse]);

  // Language-specific subject label to fix "Betreff" appearing in Italian text
  const getSubjectLabel = (): string => {
    const subjectLabels: Record<string, string> = {
      IT: 'Oggetto',
      DE: 'Betreff',
      EN: 'Subject',
      FR: 'Objet',
      ES: 'Asunto',
      PL: 'Temat',
      RO: 'Subiect',
      TR: 'Konu',
      AR: 'الموضوع',
      UK: 'Тема',
      RU: 'Тема',
    };
    return subjectLabels[language] || subjectLabels.DE;
  };

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/i.test(ua);
  }, []);

  useEffect(() => {
    setIsClient(true);
    // Fetch profile on mount
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, address, postal_code, city, country')
      .eq('id', user.id)
      .maybeSingle();
    
    if (!error && data) {
      setProfile(data);
    }
  };

  const handleCopy = async () => {
    if (!draftResponse) return;
    
    // Validate document before copying - block if placeholders exist
    if (containsPlaceholders(draftResponse)) {
      toast.error(getPlaceholderErrorMessage(language));
      console.error('Document contains placeholders, blocking copy');
      return;
    }
    
    // Sanitize the text before copying
    const cleanText = sanitizeDocument(draftResponse);
    
    try {
      await navigator.clipboard.writeText(cleanText);
      toast.success(t('actions.copied'));
    } catch (err) {
      toast.error(t('actions.copyError'));
    }
  };

  const handlePrint = () => {
    if (!draftResponse) {
      toast.error(t('actions.noDraft') || 'No draft to print');
      return;
    }
    
    // Validate document before printing - block if placeholders exist
    if (containsPlaceholders(draftResponse)) {
      toast.error(getPlaceholderErrorMessage(language));
      console.error('Document contains placeholders, blocking print');
      return;
    }
    
    // Use a small delay to ensure the portal has rendered the print template
    // This fixes iOS/Safari timing issues where print triggers before content is ready
    requestAnimationFrame(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Print error:', err);
        toast.error(t('actions.printError') || 'Could not print. Please try again.');
      }
    });
  };

  const handleEmail = async () => {
    if (!draftResponse) return;

    // Validate document before sending - block if placeholders exist
    if (containsPlaceholders(draftResponse)) {
      toast.error(getPlaceholderErrorMessage(language));
      console.error('Document contains placeholders, blocking email');
      return;
    }

    // Sanitize the text before emailing
    const cleanBody = sanitizeDocument(draftResponse);

    const subjectText = praticaTitle;
    const subject = encodeURIComponent(subjectText);

    // If body is too long for mailto (iOS limit ~1800 chars), copy to clipboard first
    const encodedBody = encodeURIComponent(cleanBody);
    if (encodedBody.length > 1800) {
      try {
        await navigator.clipboard.writeText(cleanBody);
        toast.success(t('actions.copied') || 'Copiato negli appunti');
      } catch {
        // Non-fatal, continue
      }
      const shortBody = encodeURIComponent(t('actions.emailLongTextNote') || 'Il testo completo è stato copiato negli appunti. Incolla qui.');
      window.location.href = `mailto:?subject=${subject}&body=${shortBody}`;
      return;
    }

    // Open mail client with full text in body (NO file attachment)
    window.location.href = `mailto:?subject=${subject}&body=${encodedBody}`;
    toast.success(t('actions.emailOpened') || 'Email aperta');
  };

  const handleShare = async () => {
    if (!draftResponse) return;
    
    // Validate document before sharing - block if placeholders exist
    if (containsPlaceholders(draftResponse)) {
      toast.error(getPlaceholderErrorMessage(language));
      console.error('Document contains placeholders, blocking share');
      return;
    }
    
    // Sanitize text before sharing
    const cleanText = sanitizeDocument(draftResponse);
    
    // Try Web Share API first (works on mobile and some desktop browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: praticaTitle,
          text: cleanText,
        });
        toast.success(t('actions.shareSuccess'));
        return;
      } catch (err) {
        // User cancelled or error - fall through to clipboard
        if ((err as Error).name === 'AbortError') return;
      }
    }
    
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(cleanText);
      toast.success(t('actions.shareCopied'));
    } catch (err) {
      toast.error(t('actions.shareError'));
    }
  };

  // Get effective sender data (pratica sender data takes priority over profile)
  const getEffectiveSender = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      name: senderData?.sender_name || profile?.full_name || null,
      address: senderData?.sender_address || profile?.address || null,
      postal_code: senderData?.sender_postal_code || profile?.postal_code || null,
      city: senderData?.sender_city || profile?.city || null,
      country: senderData?.sender_country || profile?.country || 'DE',
      date: senderData?.sender_date || today,
    };
  };

  // Check if signature already exists in draft
  const hasSignature = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    const effectiveName = getEffectiveSender().name;
    return lowerText.includes('mit freundlichen grüßen') || 
           lowerText.includes('mit freundlichem gruß') ||
           lowerText.includes('hochachtungsvoll') ||
           (effectiveName ? lowerText.includes(effectiveName.toLowerCase()) : false);
  };

  // Generate DIN 5008 compliant PDF
  const handleDownloadPdf = async () => {
    if (!draftResponse) return;
    
    // Validate document before generating PDF - block if placeholders exist
    if (containsPlaceholders(draftResponse)) {
      toast.error(getPlaceholderErrorMessage(language));
      console.error('Document contains placeholders, blocking PDF generation');
      return; // DO NOT generate PDF or consume credits
    }
    
    // Sanitize the text for PDF
    const cleanDraft = sanitizeDocument(draftResponse);
    
    setGeneratingPdf(true);
    
    try {
      const sender = getEffectiveSender();
      
      // Check if sender data is complete
      const hasCompleteSender = sender.name && sender.address && sender.city;
      
      if (!hasCompleteSender) {
        toast.warning(t('actions.incompleteProfile'));
      }
      
      // DIN 5008 measurements (in mm)
      const DIN5008 = {
        pageWidth: 210,
        pageHeight: 297,
        marginLeft: 25,
        marginRight: 20,
        marginTop: 27,
        marginBottom: 25,
        senderZoneTop: 45,      // Absender-Zone
        addressZoneTop: 50.8,   // Anschrift-Zone starts
        addressZoneHeight: 40,  // 9 lines at ~4.23mm
        infoBlockTop: 32,       // Right info block
        dateLineTop: 98.46,     // Datum line
        subjectLineTop: 110,    // Betreff
        bodyTop: 125,           // Text begins
      };
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const contentWidth = DIN5008.pageWidth - DIN5008.marginLeft - DIN5008.marginRight;
      
      // Set font
      doc.setFont('helvetica', 'normal');
      
      // ===== ABSENDER (Sender) - REMOVED FOR PRIVACY =====
      // NO sender header line is rendered in PDF output.
      // User personal data must never appear in exports without explicit user action.
      
      // ===== EMPFÄNGER (Recipient) - Address block =====
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      let yPos = DIN5008.addressZoneTop + 5;
      
      // ONLY render authority if it has a value - NO placeholder
      const trimmedAuthority = authority?.trim();
      if (trimmedAuthority && trimmedAuthority.length > 0) {
        doc.text(trimmedAuthority, DIN5008.marginLeft, yPos);
      }
      // If no authority, we simply skip this block entirely (no placeholder)
      
      // ===== RIGHT INFO BLOCK (Date, City) =====
      // Format date from sender data
      let displayDate: string;
      try {
        const dateObj = sender.date ? new Date(sender.date) : new Date();
        displayDate = format(dateObj, 'dd.MM.yyyy');
      } catch {
        displayDate = format(new Date(), 'dd.MM.yyyy');
      }
      const dateCity = sender.city ? `${sender.city}, ${displayDate}` : displayDate;
      
      doc.setFontSize(10);
      doc.text(dateCity, DIN5008.pageWidth - DIN5008.marginRight, DIN5008.dateLineTop, { align: 'right' });
      
      // ===== BETREFF (Subject) =====
      let subjectY = DIN5008.subjectLineTop;
      
      // Aktenzeichen if present
      if (aktenzeichen) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Az.: ${aktenzeichen}`, DIN5008.marginLeft, subjectY);
        subjectY += 6;
      }
      
      // Subject line (bold) - use language-specific label
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const subjectLines = doc.splitTextToSize(`${getSubjectLabel()}: ${praticaTitle}`, contentWidth);
      doc.text(subjectLines, DIN5008.marginLeft, subjectY);
      subjectY += subjectLines.length * 5 + 10;
      
      // ===== ANREDE + BODY TEXT =====
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      let bodyY = Math.max(subjectY, DIN5008.bodyTop);
      const lineHeight = 5;
      
      // Process text - handle paragraphs (use sanitized text)
      let processedText = cleanDraft;
      
      // Add signature if not present - only add name if we have it
      if (!hasSignature(cleanDraft)) {
        if (sender.name) {
          processedText += '\n\nMit freundlichen Grüßen\n\n\n' + sender.name;
        } else {
          processedText += '\n\nMit freundlichen Grüßen';
        }
      }
      
      // Split into paragraphs
      const paragraphs = processedText.split(/\n/);
      
      for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
          // Empty line for paragraph break
          bodyY += lineHeight;
        } else {
          const lines = doc.splitTextToSize(paragraph.trim(), contentWidth);
          
          for (const line of lines) {
            // Check if we need a new page
            if (bodyY + lineHeight > DIN5008.pageHeight - DIN5008.marginBottom) {
              doc.addPage();
              bodyY = DIN5008.marginTop;
            }
            
            doc.text(line, DIN5008.marginLeft, bodyY);
            bodyY += lineHeight;
          }
        }
      }
      
      // ===== GENERATE FILENAME =====
      const sanitizedTitle = praticaTitle
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
      const dateStr = format(new Date(), 'dd-MM-yyyy');
      const filename = `Lexora_${sanitizedTitle}_${dateStr}.pdf`;

      // Create a previewable Blob URL so the user always has in-app actions (print/share/open)
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);

      // Clean up previous URL if any
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }

      setPdfPreviewUrl(url);
      setPdfPreviewFilename(filename);
      setPdfPreviewOpen(true);
      toast.success(t('actions.pdfSuccess'));
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error(t('actions.pdfError'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  const openPdfInNewTab = () => {
    if (!pdfPreviewUrl) return;
    // iOS Safari often opens blob URLs as blank tabs; use same-tab navigation.
    if (isIOS) {
      window.location.href = pdfPreviewUrl;
      return;
    }
    window.open(pdfPreviewUrl, '_blank', 'noopener,noreferrer');
  };

  const downloadPdfFromPreview = () => {
    if (!pdfPreviewUrl || !pdfPreviewFilename) return;
    const a = document.createElement('a');
    a.href = pdfPreviewUrl;
    a.download = pdfPreviewFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const printPdfFromPreview = () => {
    if (!pdfPreviewUrl) return;
    // Prefer printing via the HTML print template (handlePrint). For PDF we just open it.
    openPdfInNewTab();
  };

  const sharePdfFromPreview = async () => {
    if (!pdfPreviewUrl || !pdfPreviewFilename) return;
    try {
      const res = await fetch(pdfPreviewUrl);
      const blob = await res.blob();
      const file = new File([blob], pdfPreviewFilename, { type: 'application/pdf' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ title: pdfPreviewFilename, files: [file] });
        toast.success(t('actions.shareSuccess'));
        return;
      }
    } catch {
      // ignore
    }
    // Fallback: open so user can use native toolbar
    openPdfInNewTab();
  };

  // Get effective sender for print template
  const printSender = getEffectiveSender();
  const printDate = (() => {
    try {
      const dateObj = printSender.date ? new Date(printSender.date) : new Date();
      return format(dateObj, 'dd.MM.yyyy');
    } catch {
      return format(new Date(), 'dd.MM.yyyy');
    }
  })();

  return (
    <>
      {/* PDF Preview dialog (ensures actions exist even on iOS where PDF toolbars can be hidden) */}
      <Dialog
        open={pdfPreviewOpen}
        onOpenChange={(open) => {
          setPdfPreviewOpen(open);
          if (!open && pdfPreviewUrl) {
            URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
            setPdfPreviewFilename(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{pdfPreviewFilename || 'PDF'}</DialogTitle>
          </DialogHeader>
          {pdfPreviewUrl ? (
            <iframe
              src={pdfPreviewUrl}
              title="PDF preview"
              className="w-full flex-1 rounded border"
            />
          ) : (
            <div className="flex-1" />
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant="outline" className="gap-2" onClick={openPdfInNewTab}>
              <ExternalLink className="h-4 w-4" />
              Apri
            </Button>
            <Button variant="outline" className="gap-2" onClick={downloadPdfFromPreview}>
              <FileDown className="h-4 w-4" />
              {t('actions.downloadPdf')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={printPdfFromPreview}>
              <Printer className="h-4 w-4" />
              {t('actions.print')}
            </Button>
            <Button variant="outline" className="gap-2" onClick={sharePdfFromPreview}>
              <Share2 className="h-4 w-4" />
              {t('actions.share')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable DIN 5008 Letter - Portaled to <body> to avoid iOS blank prints */}
      {isClient &&
        createPortal(
          <div className="print-letter" aria-hidden>
            <div className="din5008-letter">
              {/* PRIVACY: NO sender header line is rendered in print output */}
              {/* User personal data must never appear in exports without explicit user action */}

              {/* Empfänger - ONLY render if authority has a value */}
              {authority?.trim() && (
                <div className="recipient">
                  {authority.trim()}
                </div>
              )}

              {/* Date */}
              <div className="date-line">
                {printSender.city ? `${printSender.city}, ` : ''}
                {printDate}
              </div>

              {/* Aktenzeichen */}
              {aktenzeichen && <div className="reference">Az.: {aktenzeichen}</div>}

              {/* Subject line - language-aware */}
              <div className="subject">{getSubjectLabel()}: {praticaTitle}</div>

              {/* Body - use sanitized draft */}
              <div className="letter-body">
                {sanitizedDraft?.split('\n').map((line, i) => (
                  <p key={i}>{line || '\u00A0'}</p>
                ))}

                {/* Add signature if not present */}
                {sanitizedDraft && !hasSignature(sanitizedDraft) && (
                  <>
                    <p>&nbsp;</p>
                    <p>Mit freundlichen Grüßen</p>
                    <p>&nbsp;</p>
                    <p>&nbsp;</p>
                    {printSender.name && <p>{printSender.name}</p>}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Actions Card - Hidden when printing */}
      <Card className="mb-6 print:hidden">
        <CardHeader>
          <CardTitle className="text-lg">{t('actions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="w-full gap-2 h-12"
              onClick={handleDownloadPdf}
              disabled={isDisabled || generatingPdf}
            >
              {generatingPdf ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileDown className="h-5 w-5" />
              )}
              {t('actions.downloadPdf')}
            </Button>
            
            <Button
              variant="outline"
              className="w-full gap-2 h-12"
              onClick={handlePrint}
              disabled={isDisabled}
            >
              <Printer className="h-5 w-5" />
              {t('actions.print')}
            </Button>
            
            <Button
              variant="outline"
              className="w-full gap-2 h-12"
              onClick={handleEmail}
              disabled={isDisabled}
            >
              <Mail className="h-5 w-5" />
              {t('actions.email')}
            </Button>
            
            <Button
              variant="outline"
              className="w-full gap-2 h-12"
              onClick={handleCopy}
              disabled={isDisabled}
            >
              <Copy className="h-5 w-5" />
              {t('actions.copy')}
            </Button>
            
            <Button
              variant="outline"
              className="w-full gap-2 h-12 sm:col-span-2"
              onClick={handleShare}
              disabled={isDisabled}
            >
              <Share2 className="h-5 w-5" />
              {t('actions.share')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
