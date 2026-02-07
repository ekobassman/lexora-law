import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Document {
  id: string;
  file_name: string | null;
  file_url: string | null;
  direction: string;
  detected_authority: string | null;
  detected_aktenzeichen: string | null;
  detected_date: string | null;
  summary: string | null;
  created_at: string;
}

interface DocumentListProps {
  documents: Document[];
  loading: boolean;
  userId: string;
}

export function DocumentList({ documents, loading, userId }: DocumentListProps) {
  const { t } = useLanguage();

  const handleDownload = async (fileUrl: string | null) => {
    if (!fileUrl) return;
    
    const filePath = fileUrl.split('/').slice(-2).join('/');
    const { data } = await supabase.storage.from('pratiche-files').createSignedUrl(filePath, 3600);
    
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    } else {
      toast.error(t('pratica.detail.downloadError'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="py-4 text-center text-muted-foreground">
        {t('documents.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge 
                    variant={doc.direction === 'incoming' ? 'default' : 'secondary'}
                    className="gap-1"
                  >
                    {doc.direction === 'incoming' ? (
                      <ArrowDownLeft className="h-3 w-3" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3" />
                    )}
                    {t(`documents.${doc.direction}`)}
                  </Badge>
                  {doc.detected_date && (
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(doc.detected_date), 'dd.MM.yyyy')}
                    </span>
                  )}
                </div>
                
                {doc.file_name && (
                  <div className="mb-1 flex items-center gap-1 text-sm font-medium">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {doc.file_name}
                  </div>
                )}
                
                {doc.detected_authority && (
                  <p className="text-sm text-muted-foreground">
                    {doc.detected_authority}
                    {doc.detected_aktenzeichen && ` • ${doc.detected_aktenzeichen}`}
                  </p>
                )}
                
                {doc.summary && (
                  <p className="mt-2 text-sm">{doc.summary}</p>
                )}
              </div>
              
              {doc.file_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(doc.file_url)}
                  className="gap-1"
                >
                  <Download className="h-4 w-4" />
                  {t('documents.download')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
