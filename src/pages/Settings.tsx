import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLanguage,
  languages as availableLanguages,
  countries as availableCountries,
  Language as LanguageCode,
  Country as CountryCode,
} from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';
import { AppHeader } from '@/components/AppHeader';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { PaywallDialog } from '@/components/PaywallDialog';
import { CreditsDisplay } from '@/components/CreditsDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Brain,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Save,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProfileData {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  preferred_language: string | null;
  // Sender data
  sender_full_name: string | null;
  sender_address: string | null;
  sender_postal_code: string | null;
  sender_city: string | null;
  sender_country: string | null;
  sender_location: string | null;
  sender_signature: string | null;
  auto_use_sender_data: boolean | null;
  // Practices settings
  auto_save_drafts: boolean | null;
  auto_update_letter_on_upload: boolean | null;
  max_documents_per_pratica: number | null;
  // AI settings
  ai_language_level: string | null;
  default_tone_setting: string | null;
  default_ai_language: string | null;
  auto_update_draft_on_ai: boolean | null;
  suggest_legal_references: boolean | null;
  // Security
  last_login_at: string | null;
}

const SUPPORTED_LANGUAGES: LanguageCode[] = ['IT', 'DE', 'EN', 'FR', 'ES', 'PL', 'RO', 'TR'];
const SETTINGS_COUNTRIES: CountryCode[] = ['DE', 'IT', 'AT', 'CH', 'FR', 'ES', 'PL', 'RO', 'GB', 'IE'];

const COUNTRY_PHONE_PREFIXES: Record<string, string> = {
  DE: '+49 123 456789',
  IT: '+39 333 1234567',
  AT: '+43 664 1234567',
  CH: '+41 79 123 45 67',
  FR: '+33 6 12 34 56 78',
  ES: '+34 612 345 678',
  PL: '+48 512 345 678',
  RO: '+40 712 345 678',
  GB: '+44 7911 123456',
  IE: '+353 85 123 4567',
};

const localeForLanguage = (lang: LanguageCode): string => {
  switch (lang) {
    case 'IT':
      return 'it-IT';
    case 'DE':
      return 'de-DE';
    case 'FR':
      return 'fr-FR';
    case 'ES':
      return 'es-ES';
    case 'PL':
      return 'pl-PL';
    case 'RO':
      return 'ro-RO';
    case 'TR':
      return 'tr-TR';
    case 'EN':
    default:
      return 'en-GB';
  }
};

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const { isRTL, t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const languageOptions = useMemo(
    () => availableLanguages.filter((l) => SUPPORTED_LANGUAGES.includes(l.code as LanguageCode)),
    []
  );
  const countryOptions = useMemo(
    () => availableCountries.filter((c) => SETTINGS_COUNTRIES.includes(c.code as CountryCode)),
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      toast.error(t('settings.saveError'));
    } else if (data) {
      setProfile(data as ProfileData);
    }
    setLoading(false);
  };

  const updateProfile = async (section: string, updates: Partial<ProfileData>) => {
    if (!user || !profile) return;
    
    setSaving(section);
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      toast.error(t('settings.saveError'));
    } else {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      toast.success(t('settings.saved'));
    }
    setSaving(null);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setPasswordLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast.error(t('settings.security.resetError'));
    } else {
      toast.success(t('settings.security.resetSent'));
    }
    setPasswordLoading(false);
  };

  const handleLogoutAll = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      toast.error(t('settings.saveError'));
    } else {
      navigate('/auth');
    }
  };

  const handleDeleteAccount = async () => {
    toast.info(t('settings.danger.deleteAccountDone'));
  };

  const handleExportData = async () => {
    toast.info(t('settings.danger.exportDone'));
  };

  const handleDownloadDocuments = async () => {
    toast.info(t('common.loading'));
    // TODO: Implement bulk download
  };

  const handleDeleteClosedPratiche = async () => {
    if (!user) return;
    
    const { error } = await supabase
      .from('pratiche')
      .delete()
      .eq('user_id', user.id)
      .in('status', ['resolved', 'completed', 'archived']);

    if (error) {
      toast.error(t('settings.saveError'));
    } else {
      toast.success(t('settings.practices.deleteClosedDone'));
    }
  };

  if (authLoading || loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy pb-20 md:pb-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <AppHeader />

      <main className="bg-ivory min-h-screen">
        <div className="container py-10 space-y-8 max-w-3xl">
          {/* Page Title */}
          <div className="text-center space-y-2">
            <h1 className="font-display text-3xl md:text-4xl font-medium text-navy">{t('settings.title')}</h1>
            <p className="text-navy/60">{t('settings.subtitle')}</p>
          </div>

          {/* SECTION 1: Account & Profile */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <User className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.account.title')}</CardTitle>
                  <CardDescription>{t('settings.account.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t('settings.account.firstName')}</Label>
                  <Input
                    id="first_name"
                    value={profile?.first_name || ''}
                    onChange={(e) => setProfile((prev) => (prev ? { ...prev, first_name: e.target.value } : null))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t('settings.account.lastName')}</Label>
                  <Input
                    id="last_name"
                    value={profile?.last_name || ''}
                    onChange={(e) => setProfile((prev) => (prev ? { ...prev, last_name: e.target.value } : null))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('settings.account.phone')}</Label>
                <Input
                  id="phone"
                  value={profile?.phone || ''}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, phone: e.target.value } : null))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">{t('settings.account.country')}</Label>
                  <Select
                    value={profile?.country || 'DE'}
                    onValueChange={(value) => setProfile((prev) => (prev ? { ...prev, country: value } : null))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countryOptions.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.nativeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">{t('settings.account.language')}</Label>
                  <Select
                    value={profile?.preferred_language || 'IT'}
                    onValueChange={(value) => setProfile((prev) => (prev ? { ...prev, preferred_language: value } : null))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.nativeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('settings.account.email')}</Label>
                <Input id="email" value={user.email || ''} disabled className="bg-navy/5" />
                <p className="text-xs text-navy/50">{t('settings.account.emailHint')}</p>
              </div>

              <Button 
                onClick={() => updateProfile('account', {
                  first_name: profile?.first_name,
                  last_name: profile?.last_name,
                  phone: profile?.phone,
                  country: profile?.country,
                  preferred_language: profile?.preferred_language,
                })}
                disabled={saving === 'account'}
                className="bg-navy text-gold hover:bg-navy/90"
              >
                {saving === 'account' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t('settings.account.save')}
              </Button>
            </CardContent>
          </Card>

          {/* SECTION: Credits & Usage */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.credits.title')}</CardTitle>
                  <CardDescription>{t('settings.credits.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CreditsDisplay showUpgrade={true} />
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => navigate('/account/usage')}
              >
                <ExternalLink className="h-4 w-4" />
                {t('settings.credits.viewDetails')}
              </Button>
            </CardContent>
          </Card>

          {/* SECTION 2: Sender Data */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <Mail className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.sender.title')}</CardTitle>
                  <CardDescription>{t('settings.sender.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sender_full_name">{t('settings.sender.fullName')}</Label>
                <Input
                  id="sender_full_name"
                  value={profile?.sender_full_name || ''}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, sender_full_name: e.target.value } : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_address">{t('settings.sender.address')}</Label>
                <Input
                  id="sender_address"
                  value={profile?.sender_address || ''}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, sender_address: e.target.value } : null))}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sender_postal_code">{t('settings.sender.postalCode')}</Label>
                  <Input
                    id="sender_postal_code"
                    value={profile?.sender_postal_code || ''}
                    onChange={(e) => setProfile((prev) => (prev ? { ...prev, sender_postal_code: e.target.value } : null))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sender_city">{t('settings.sender.city')}</Label>
                  <Input
                    id="sender_city"
                    value={profile?.sender_city || ''}
                    onChange={(e) => setProfile((prev) => (prev ? { ...prev, sender_city: e.target.value } : null))}
                  />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label htmlFor="sender_country">{t('settings.sender.country')}</Label>
                  <Select
                    value={profile?.sender_country || 'DE'}
                    onValueChange={(value) => setProfile((prev) => (prev ? { ...prev, sender_country: value } : null))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countryOptions.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.nativeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_location">{t('settings.sender.location')}</Label>
                <Input
                  id="sender_location"
                  value={profile?.sender_location || ''}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, sender_location: e.target.value } : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_signature">{t('settings.sender.signature')}</Label>
                <Textarea
                  id="sender_signature"
                  value={profile?.sender_signature || ''}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, sender_signature: e.target.value } : null)}
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto_use_sender"
                  checked={profile?.auto_use_sender_data ?? true}
                  onCheckedChange={(checked) => setProfile(prev => prev ? { ...prev, auto_use_sender_data: checked } : null)}
                />
                <Label htmlFor="auto_use_sender">{t('settings.sender.autoUse')}</Label>
              </div>

              <Button 
                onClick={() => updateProfile('sender', {
                  sender_full_name: profile?.sender_full_name,
                  sender_address: profile?.sender_address,
                  sender_postal_code: profile?.sender_postal_code,
                  sender_city: profile?.sender_city,
                  sender_country: profile?.sender_country,
                  sender_location: profile?.sender_location,
                  sender_signature: profile?.sender_signature,
                  auto_use_sender_data: profile?.auto_use_sender_data,
                })}
                disabled={saving === 'sender'}
                className="bg-navy text-gold hover:bg-navy/90"
              >
                {saving === 'sender' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {t('settings.sender.save')}
              </Button>
            </CardContent>
          </Card>

          {/* SECTION 3: Practices & Documents */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <FileText className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.practices.title')}</CardTitle>
                  <CardDescription>{t('settings.practices.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.practices.autoSave')}</Label>
                  <p className="text-sm text-navy/50">{t('settings.practices.autoSaveDesc')}</p>
                </div>
                <Switch
                  checked={profile?.auto_save_drafts ?? true}
                  onCheckedChange={(checked) => setProfile(prev => prev ? { ...prev, auto_save_drafts: checked } : null)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.practices.autoUpdate')}</Label>
                  <p className="text-sm text-navy/50">{t('settings.practices.autoUpdateDesc')}</p>
                </div>
                <Switch
                  checked={profile?.auto_update_letter_on_upload ?? true}
                  onCheckedChange={(checked) => setProfile(prev => prev ? { ...prev, auto_update_letter_on_upload: checked } : null)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t('settings.practices.formats')}</Label>
                <p className="text-sm text-navy/70 bg-navy/5 p-3 rounded-lg">PDF, JPG, PNG, WEBP</p>
              </div>

              <Button 
                onClick={() => updateProfile('practices', {
                  auto_save_drafts: profile?.auto_save_drafts,
                  auto_update_letter_on_upload: profile?.auto_update_letter_on_upload,
                  max_documents_per_pratica: profile?.max_documents_per_pratica,
                })}
                disabled={saving === 'practices'}
                className="bg-navy text-gold hover:bg-navy/90"
              >
                {saving === 'practices' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {t('settings.practices.save')}
              </Button>

              <Separator />

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleDownloadDocuments} className="gap-2">
                  <Download className="h-4 w-4" />
                  {t('settings.practices.downloadDocs')}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5">
                      <Trash2 className="h-4 w-4" />
                      {t('settings.practices.deleteClosed')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('settings.practices.deleteClosedConfirm')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.practices.deleteClosedDesc')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteClosedPratiche} className="bg-destructive">
                        {t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 4: AI & Automation */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <Brain className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.ai.title')}</CardTitle>
                  <CardDescription>{t('settings.ai.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.ai.languageLevel')}</Label>
                  <Select
                    value={profile?.ai_language_level || 'formal'}
                    onValueChange={(value) => setProfile(prev => prev ? { ...prev, ai_language_level: value } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">{t('settings.ai.languageLevel.simple')}</SelectItem>
                      <SelectItem value="formal">{t('settings.ai.languageLevel.formal')}</SelectItem>
                      <SelectItem value="legal_advanced">{t('settings.ai.languageLevel.legal')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.ai.tone')}</Label>
                  <Select
                    value={profile?.default_tone_setting || 'collaborative'}
                    onValueChange={(value) => setProfile((prev) => (prev ? { ...prev, default_tone_setting: value } : null))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="collaborative">{t('settings.ai.tone.collaborative')}</SelectItem>
                      <SelectItem value="firm">{t('settings.ai.tone.firm')}</SelectItem>
                      <SelectItem value="formal_notice">{t('settings.ai.tone.formalNotice')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('settings.ai.defaultLanguage')}</Label>
                <Select
                  value={profile?.default_ai_language || language}
                  onValueChange={(value) => {
                    setProfile((prev) => (prev ? { ...prev, default_ai_language: value } : null));
                    // Also update the UI language immediately
                    setLanguage(value as LanguageCode);
                  }}
                >
                  <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.nativeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.ai.autoUpdateDraft')}</Label>
                  <p className="text-sm text-navy/50">{t('settings.ai.autoUpdateDraftDesc')}</p>
                </div>
                <Switch
                  checked={profile?.auto_update_draft_on_ai ?? true}
                  onCheckedChange={(checked) => setProfile(prev => prev ? { ...prev, auto_update_draft_on_ai: checked } : null)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.ai.suggestLegal')}</Label>
                  <p className="text-sm text-navy/50">{t('settings.ai.suggestLegalDesc')}</p>
                </div>
                <Switch
                  checked={profile?.suggest_legal_references ?? true}
                  onCheckedChange={(checked) => setProfile(prev => prev ? { ...prev, suggest_legal_references: checked } : null)}
                />
              </div>

              <Button 
                onClick={() => updateProfile('ai', {
                  ai_language_level: profile?.ai_language_level,
                  default_tone_setting: profile?.default_tone_setting,
                  default_ai_language: profile?.default_ai_language,
                  auto_update_draft_on_ai: profile?.auto_update_draft_on_ai,
                  suggest_legal_references: profile?.suggest_legal_references,
                })}
                disabled={saving === 'ai'}
                className="bg-navy text-gold hover:bg-navy/90"
              >
                {saving === 'ai' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {t('settings.ai.save')}
              </Button>
            </CardContent>
          </Card>

          {/* SECTION 5: Security */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <Shield className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.security.title')}</CardTitle>
                  <CardDescription>{t('settings.security.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile?.last_login_at && (
                <div className="bg-navy/5 p-3 rounded-lg">
                  <p className="text-sm text-navy/70">
                    <span className="font-medium">{t('settings.security.lastLogin')}:</span>{' '}
                    {new Date(profile.last_login_at).toLocaleString(localeForLanguage(language))}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  onClick={handlePasswordReset}
                  disabled={passwordLoading}
                  className="gap-2"
                >
                  {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  {t('settings.security.resetPassword')}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <LogOut className="h-4 w-4" />
                      {t('settings.security.logoutAll')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('settings.security.logoutAllConfirm')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.security.logoutAllDesc')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLogoutAll}>
                        {t('nav.logout')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 6: Usage & Credits */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.usage.title')}</CardTitle>
                  <CardDescription>{t('settings.usage.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full bg-navy text-gold hover:bg-navy/90" onClick={() => navigate('/account/usage')}>
                {t('settings.usage.viewButton')}
              </Button>
            </CardContent>
          </Card>

          {/* SECTION 7: Subscription */}
          <Card className="shadow-premium">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-navy" />
                </div>
                <div>
                  <CardTitle className="text-navy font-display">{t('settings.subscription.title')}</CardTitle>
                  <CardDescription>{t('settings.subscription.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full bg-navy text-gold hover:bg-navy/90" onClick={() => navigate('/subscription')}>
                {t('settings.subscription.viewButton')}
              </Button>

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2" asChild>
                  <a href="mailto:support@lexora-law.com">
                    <Mail className="h-4 w-4" />
                    {t('settings.plan.contact')}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SECTION 8: Danger Zone */}
          <Card className="shadow-premium border-destructive/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-destructive font-display">{t('settings.danger.title')}</CardTitle>
                  <CardDescription>{t('settings.danger.desc')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleExportData} className="gap-2">
                  <Download className="h-4 w-4" />
                  {t('settings.danger.export')}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      {t('settings.danger.deleteAccount')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('settings.danger.deleteAccountConfirm')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('settings.danger.deleteAccountDesc')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive">
                        {t('settings.danger.understand')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
