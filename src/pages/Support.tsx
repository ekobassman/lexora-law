import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { LegalFooter } from '@/components/LegalFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeadsetIcon, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

type RequestType = 'technical' | 'document' | 'billing' | 'other';

export default function Support() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [requestType, setRequestType] = useState<RequestType>('other');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestTypeOptions: { value: RequestType; labelKey: string }[] = [
    { value: 'technical', labelKey: 'support.requestTypes.technical' },
    { value: 'document', labelKey: 'support.requestTypes.document' },
    { value: 'billing', labelKey: 'support.requestTypes.billing' },
    { value: 'other', labelKey: 'support.requestTypes.other' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Max 10MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError(t('support.errors.fileTooLarge'));
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim()) {
      setError(t('support.errors.emailRequired'));
      return;
    }
    if (!message.trim()) {
      setError(t('support.errors.messageRequired'));
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('support.errors.invalidEmail'));
      return;
    }

    setIsSubmitting(true);

    try {
      const requestTypeLabel = t(`support.requestTypes.${requestType}`);
      const timestamp = new Date().toISOString();
      const pageSource = location.pathname;

      // Prepare file attachment info
      let fileInfo = '';
      if (file) {
        fileInfo = `\n\n📎 Attachment: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      }

      const fullMessage = `
Request Type: ${requestTypeLabel}
User Language: ${language.toUpperCase()}
Page Source: ${pageSource}
Timestamp: ${timestamp}
${user ? `User ID: ${user.id}` : 'Guest User'}

---

${message}${fileInfo}
      `.trim();

      const { error: apiError } = await supabase.functions.invoke('send-support-email', {
        body: {
          name: name.trim() || 'Anonymous',
          email: email.trim(),
          requestType: requestTypeLabel,
          message: fullMessage,
          language,
          pageSource,
          hasAttachment: !!file,
          attachmentName: file?.name,
        },
      });

      if (apiError) {
        throw new Error(apiError.message || 'Failed to send support request');
      }

      setIsSuccess(true);
    } catch (err: any) {
      console.error('Support form error:', err);
      setError(t('support.errors.sendFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 py-12">
          <div className="container max-w-lg">
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-green-800">
                  {t('support.success.title')}
                </h2>
                <p className="text-green-700">
                  {t('support.success.message')}
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="mt-4"
                >
                  {t('common.back')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <LegalFooter compact />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-8 md:py-12">
        <div className="container max-w-lg">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <HeadsetIcon className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">{t('support.title')}</h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {t('support.intro')}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('support.formTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t('support.fields.name')} <span className="text-muted-foreground text-sm">({t('support.optional')})</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('support.placeholders.name')}
                    maxLength={100}
                  />
                </div>

                {/* Email (required) */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {t('support.fields.email')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('support.placeholders.email')}
                    required
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('support.emailHint')}
                  </p>
                </div>

                {/* Request Type */}
                <div className="space-y-2">
                  <Label htmlFor="requestType">
                    {t('support.fields.requestType')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {requestTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message (required) */}
                <div className="space-y-2">
                  <Label htmlFor="message">
                    {t('support.fields.message')} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t('support.placeholders.message')}
                    required
                    rows={5}
                    maxLength={2000}
                  />
                </div>

                {/* File Upload (optional) */}
                <div className="space-y-2">
                  <Label>
                    {t('support.fields.file')} <span className="text-muted-foreground text-sm">({t('support.optional')})</span>
                  </Label>
                  <div
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 transition-colors hover:border-primary/50 hover:bg-muted/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {file ? file.name : t('support.fileHint')}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('support.sending')}
                    </>
                  ) : (
                    t('support.submit')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <LegalFooter compact />
    </div>
  );
}