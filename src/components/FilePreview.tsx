import { useState, useEffect } from 'react';
import { FileImage, FileText, X, ZoomIn, Printer, Mail, Share2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';

interface FilePreviewProps {
  file: File | null;
  fileUrl?: string | null;
  onRemove?: () => void;
  className?: string;
}

export function FilePreview({ file, fileUrl, onRemove, className = '' }: FilePreviewProps) {
  const { t } = useLanguage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (file) {
      const isImageFile = file.type.startsWith('image/');
      const isPdfFile = file.type === 'application/pdf';
      
      setIsImage(isImageFile);
      setIsPdf(isPdfFile);

      if (isImageFile) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      } else if (isPdfFile) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      }
    } else if (fileUrl) {
      // Determine type from URL extension
      const ext = fileUrl.split('.').pop()?.toLowerCase();
      setIsImage(['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || ''));
      setIsPdf(ext === 'pdf');
      setPreviewUrl(fileUrl);
    } else {
      setPreviewUrl(null);
      setIsImage(false);
      setIsPdf(false);
    }
  }, [file, fileUrl]);

  if (!previewUrl && !file) return null;

  const handlePrint = () => {
    if (!previewUrl) return;

    // PDFs: printing the wrapper window can yield a blank page on some browsers (notably mobile Safari).
    // Instead, open the PDF directly and trigger print best-effort.
    if (isPdf) {
      const w = window.open(previewUrl, '_blank', 'noopener,noreferrer');
      if (!w) {
        toast.error(t('actions.print'));
        return;
      }

      const tryPrint = () => {
        try {
          w.focus();
          w.print();
        } catch {
          // Ignore; user can print manually from the PDF viewer
        }
      };

      // Best-effort: some browsers need a little time to load the PDF viewer.
      setTimeout(tryPrint, 800);
      setTimeout(tryPrint, 2000);
      return;
    }

    // Images: create a clean printable document.
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      toast.error(t('actions.print'));
      return;
    }

    const content = `<img src="${previewUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`;

    w.document.open();
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Print</title><style>@page{margin:0}body{margin:0;padding:0;background:#fff}</style></head><body>${content}<script>window.onload=()=>setTimeout(()=>window.print(),100)</script></body></html>`
    );
    w.document.close();
  };

  const handleEmail = () => {
    const fileName = file?.name || 'document';
    const subject = encodeURIComponent(`Documento: ${fileName}`);
    const body = encodeURIComponent(`Si prega di visualizzare il documento allegato: ${fileName}\n\n${previewUrl || ''}`);
    
    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_self');
    toast.success(t('actions.emailOpened'));
  };

  const handleShare = async () => {
    const fileName = file?.name || 'document';

    // Try Web Share API first
    if (navigator.share && file) {
      try {
        await navigator.share({
          title: fileName,
          files: [file],
        });
        toast.success(t('actions.shareSuccess'));
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Fall through to URL sharing
      }
    }

    // Fallback: share URL if available
    if (navigator.share && previewUrl) {
      try {
        await navigator.share({
          title: fileName,
          url: previewUrl,
        });
        toast.success(t('actions.shareSuccess'));
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Final fallback: copy URL to clipboard
    if (previewUrl) {
      try {
        await navigator.clipboard.writeText(previewUrl);
        toast.success(t('actions.shareCopied'));
      } catch {
        toast.error(t('actions.shareError'));
      }
    }
  };

  const ActionButtons = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center gap-2 ${compact ? '' : 'justify-center'}`}>
      {previewUrl && (
        <Button
          type="button"
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'h-8 w-8' : 'gap-2'}
          onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
          title={'Apri'}
        >
          <ExternalLink className="h-4 w-4" />
          {!compact && 'Apri'}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size={compact ? 'icon' : 'sm'}
        className={compact ? 'h-8 w-8' : 'gap-2'}
        onClick={handlePrint}
        title={t('actions.print')}
      >
        <Printer className="h-4 w-4" />
        {!compact && t('actions.print')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? 'icon' : 'sm'}
        className={compact ? 'h-8 w-8' : 'gap-2'}
        onClick={handleEmail}
        title={t('actions.email')}
      >
        <Mail className="h-4 w-4" />
        {!compact && t('actions.email')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? 'icon' : 'sm'}
        className={compact ? 'h-8 w-8' : 'gap-2'}
        onClick={handleShare}
        title={t('actions.share')}
      >
        <Share2 className="h-4 w-4" />
        {!compact && t('actions.share')}
      </Button>
    </div>
  );

  return (
    <div className={`relative rounded-lg border bg-muted/50 overflow-hidden ${className}`}>
      {/* Remove button */}
      {onRemove && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-2 top-2 z-10 h-6 w-6"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {/* Image preview with dialog */}
      {isImage && previewUrl && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div className="relative cursor-pointer group">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-48 object-contain bg-muted"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <ZoomIn className="h-8 w-8 text-white" />
              </div>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-4">
            <img
              src={previewUrl}
              alt="Full preview"
              className="w-full h-auto mb-4"
            />
            <ActionButtons />
          </DialogContent>
        </Dialog>
      )}

      {/* PDF preview with dialog */}
      {isPdf && previewUrl && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div className="w-full h-64 cursor-pointer relative group">
              <iframe
                src={previewUrl}
                className="w-full h-full border-0 pointer-events-none"
                title="PDF Preview"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <ZoomIn className="h-8 w-8 text-white" />
              </div>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-4 flex flex-col">
            <iframe
              src={previewUrl}
              className="w-full flex-1 min-h-[60vh] border-0 rounded"
              title="PDF Full Preview"
            />
            <div className="mt-4">
              <ActionButtons />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* File info */}
      <div className="p-3 flex items-center gap-2 border-t bg-background/50">
        {isImage ? (
          <FileImage className="h-4 w-4 text-primary" />
        ) : (
          <FileText className="h-4 w-4 text-primary" />
        )}
        <span className="text-sm truncate flex-1">
          {file?.name || 'Uploaded file'}
        </span>

        {previewUrl && (isImage || isPdf) && (
          <ActionButtons compact />
        )}

        {file && (
          <span className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </span>
        )}
      </div>
    </div>
  );
}
