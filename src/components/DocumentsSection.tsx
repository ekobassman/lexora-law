import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  FileImage,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentUpload } from './DocumentUpload';
import { ScrollableContentBox } from './ScrollableContentBox';

interface Document {
  id: string;
  file_name: string | null;
  file_url: string | null;
  mime_type: string | null;
  direction: string;
  document_type?: string;
  file_size?: number;
  detected_authority: string | null;
  detected_aktenzeichen: string | null;
  detected_date: string | null;
  summary: string | null;
  created_at: string;
}

interface DocumentsSectionProps {
  praticaId: string;
  documents: Document[];
  loading: boolean;
  onRefresh: () => void;
  onPraticaRefresh?: () => void;
  userId: string;
}

// Cache for signed thumbnail URLs
const thumbnailCache = new Map<string, { url: string; expires: number }>();

export function DocumentsSection({
  praticaId,
  documents,
  loading,
  onRefresh,
  onPraticaRefresh,
  userId,
}: DocumentsSectionProps) {
  const { t } = useLanguage();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

  // Handle image load error - use React state instead of innerHTML for XSS safety
  const handleImageError = useCallback((docId: string) => {
    setImageLoadErrors(prev => new Set(prev).add(docId));
  }, []);

  // Helper to get file path from stored URL (handles both legacy signed URLs and new paths)
  const getFilePath = (fileUrl: string): string => {
    // If it's a signed URL, extract the path
    if (fileUrl.includes('?')) {
      const urlParts = fileUrl.split('?')[0];
      return urlParts.split('/').slice(-2).join('/');
    }
    // If it starts with http, extract path
    if (fileUrl.startsWith('http')) {
      return fileUrl.split('/').slice(-2).join('/');
    }
    // It's already a path
    return fileUrl;
  };

  const getSignedUrl = async (fileUrl: string) => {
    const filePath = getFilePath(fileUrl);
    const { data } = await supabase.storage.from('pratiche-files').createSignedUrl(filePath, 3600);
    return data?.signedUrl || null;
  };

  // Load thumbnail URLs for all documents on mount and when documents change
  useEffect(() => {
    const loadThumbnails = async () => {
      const newUrls: Record<string, string> = {};
      
      for (const doc of documents) {
        if (!doc.file_url || !doc.mime_type?.startsWith('image/')) continue;
        
        const cacheKey = doc.id;
        const cached = thumbnailCache.get(cacheKey);
        
        // Use cached URL if still valid (with 5 min buffer)
        if (cached && cached.expires > Date.now() + 300000) {
          newUrls[doc.id] = cached.url;
          continue;
        }
        
        try {
          const url = await getSignedUrl(doc.file_url);
          if (url) {
            newUrls[doc.id] = url;
            // Cache for 50 minutes (signed URL expires in 60)
            thumbnailCache.set(cacheKey, { url, expires: Date.now() + 3000000 });
          }
        } catch (err) {
          console.error('Failed to get thumbnail URL:', err);
        }
      }
      
      setThumbnailUrls(newUrls);
    };
    
    if (documents.length > 0) {
      loadThumbnails();
    }
  }, [documents]);

  const handleDownload = async (doc: Document) => {
    if (!doc.file_url) {
      toast.error(t('pratica.detail.downloadError'));
      return;
    }
    
    try {
      const url = await getSignedUrl(doc.file_url);
      if (!url) {
        toast.error(t('pratica.detail.downloadError'));
        return;
      }
      
      // Fetch the file and trigger download
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.file_name || 'documento';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      toast.success(t('actions.pdfSuccess'));
    } catch (err) {
      console.error('Download error:', err);
      toast.error(t('pratica.detail.downloadError'));
    }
  };

  const handlePreview = async (doc: Document) => {
    if (!doc.file_url) return;
    setPreviewDoc(doc);
    setPreviewLoading(true);
    const url = await getSignedUrl(doc.file_url);
    setPreviewUrl(url);
    setPreviewLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);

    try {
      // Delete file from storage
      if (deleteDoc.file_url) {
        const filePath = getFilePath(deleteDoc.file_url);
        await supabase.storage.from('pratiche-files').remove([filePath]);
      }

      // Delete record
      const { error } = await supabase.from('documents').delete().eq('id', deleteDoc.id);
      if (error) throw error;

      toast.success(t('documents.deleted'));
      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('documents.deleteError'));
    } finally {
      setDeleting(false);
      setDeleteDoc(null);
    }
  };

  const handleRename = async () => {
    if (!renameDoc || !newName.trim()) return;
    setRenaming(true);

    try {
      const { error } = await supabase
        .from('documents')
        .update({ file_name: newName.trim() })
        .eq('id', renameDoc.id);

      if (error) throw error;

      toast.success(t('documents.renamed'));
      onRefresh();
    } catch (err) {
      console.error('Rename error:', err);
      toast.error(t('documents.renameError'));
    } finally {
      setRenaming(false);
      setRenameDoc(null);
      setNewName('');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDocumentTypeLabel = (type?: string) => {
    switch (type) {
      case 'letter':
        return t('documents.type.letter');
      case 'attachment':
        return t('documents.type.attachment');
      case 'evidence':
        return t('documents.type.evidence');
      default:
        return t('documents.type.letter');
    }
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-8 w-8 text-muted-foreground" />;
    if (mimeType.startsWith('image/')) return <FileImage className="h-8 w-8 text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  // Sort documents by created_at ASC (first page at top, last at bottom)
  const sortedDocuments = [...documents].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t('documents.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sortedDocuments.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t('documents.empty')}</p>
              <p className="text-sm text-muted-foreground/70">{t('documents.emptyDesc')}</p>
            </div>
          ) : (
            <ScrollableContentBox maxHeight="50vh" showScrollButton={sortedDocuments.length > 3}>
              <div className="space-y-3">
                {sortedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="group relative flex items-start gap-3 rounded-lg border bg-card p-3 transition-all hover:bg-muted/50"
                  >
                    {/* Thumbnail / Icon - uses React state for error handling (XSS-safe) */}
                    <div className="flex-shrink-0">
                      {doc.file_url && doc.mime_type?.startsWith('image/') && thumbnailUrls[doc.id] && !imageLoadErrors.has(doc.id) ? (
                        <div className="h-14 w-14 overflow-hidden rounded-md border bg-muted">
                          <img
                            src={thumbnailUrls[doc.id]}
                            alt={doc.file_name || 'Document'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={() => handleImageError(doc.id)}
                          />
                        </div>
                      ) : doc.file_url && doc.mime_type?.startsWith('image/') && imageLoadErrors.has(doc.id) ? (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-muted">
                          <ImageIcon className="h-8 w-8 text-primary" />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-muted">
                          {getFileIcon(doc.mime_type)}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant={doc.direction === 'incoming' ? 'default' : 'secondary'}
                          className="gap-1 text-xs"
                        >
                          {doc.direction === 'incoming' ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {t(`documents.${doc.direction}`)}
                        </Badge>
                        {doc.document_type && (
                          <Badge variant="outline" className="text-xs">
                            {getDocumentTypeLabel(doc.document_type)}
                          </Badge>
                        )}
                      </div>

                      <p className="truncate text-sm font-medium">
                        {doc.file_name || 'Documento senza nome'}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(doc.created_at), 'dd.MM.yyyy HH:mm')}</span>
                        {doc.file_size && <span>• {formatFileSize(doc.file_size)}</span>}
                        {doc.detected_authority && (
                          <span className="truncate">• {doc.detected_authority}</span>
                        )}
                      </div>

                      {doc.summary && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {doc.summary}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePreview(doc)}
                        title={t('documents.preview')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(doc)}
                        title={t('documents.download')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameDoc(doc);
                              setNewName(doc.file_name || '');
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            {t('documents.rename')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteDoc(doc)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('documents.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollableContentBox>
          )}
        </CardContent>

        <CardFooter className="pt-0">
          <Button
            onClick={() => setUploadOpen(true)}
            className="w-full gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            {t('documents.addNew')}
          </Button>
        </CardFooter>
      </Card>

      {/* Upload Dialog */}
      <DocumentUpload
        praticaId={praticaId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => {
          onRefresh();
          if (onPraticaRefresh) {
            onPraticaRefresh();
          }
        }}
        onLetterTextUpdate={() => {
          if (onPraticaRefresh) {
            onPraticaRefresh();
          }
        }}
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewDoc?.file_name || 'Documento'}
            </DialogTitle>
            <DialogDescription>
              {previewDoc && format(new Date(previewDoc.created_at), 'dd.MM.yyyy HH:mm')}
              {previewDoc?.file_size && ` • ${formatFileSize(previewDoc.file_size)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-[400px]">
            {previewLoading ? (
              <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : previewUrl ? (
              previewDoc?.mime_type?.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={previewDoc?.file_name || 'Preview'}
                  className="mx-auto max-h-[60vh] rounded-lg object-contain"
                />
              ) : previewDoc?.mime_type === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="h-[60vh] w-full rounded-lg border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex h-[400px] flex-col items-center justify-center text-muted-foreground">
                  <File className="mb-2 h-12 w-12" />
                  <p>{t('documents.preview')} non disponibile</p>
                </div>
              )
            ) : (
              <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                Nessuna anteprima disponibile
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDoc(null)}>
              Chiudi
            </Button>
            {previewDoc && (
              <Button onClick={() => handleDownload(previewDoc)} className="gap-2">
                <Download className="h-4 w-4" />
                {t('documents.download')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documents.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('documents.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('documents.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameDoc} onOpenChange={() => setRenameDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('documents.renameTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newName">{t('documents.newName')}</Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={renaming}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDoc(null)} disabled={renaming}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRename} disabled={renaming || !newName.trim()}>
              {renaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('documents.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
