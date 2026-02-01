import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Save, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatCapCity } from '@/lib/formatAddress';

interface SenderData {
  sender_name: string | null;
  sender_address: string | null;
  sender_postal_code: string | null;
  sender_city: string | null;
  sender_country: string | null;
  sender_date: string | null;
}

interface ProfileData {
  full_name: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
}

interface SenderDataSectionProps {
  praticaId: string;
  senderData: SenderData;
  onSenderDataUpdate: (data: SenderData) => void;
}

export function SenderDataSection({ praticaId, senderData, onSenderDataUpdate }: SenderDataSectionProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [autoSaved, setAutoSaved] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    sender_name: '',
    sender_address: '',
    sender_postal_code: '',
    sender_city: '',
    sender_country: '',
    sender_date: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    // Initialize form with sender data or profile data
    const today = format(new Date(), 'yyyy-MM-dd');
    setFormData({
      sender_name: senderData.sender_name || profile?.full_name || '',
      sender_address: senderData.sender_address || profile?.address || '',
      sender_postal_code: senderData.sender_postal_code || profile?.postal_code || '',
      sender_city: senderData.sender_city || profile?.city || '',
      sender_country: senderData.sender_country || profile?.country || 'DE',
      sender_date: senderData.sender_date || today,
    });
  }, [senderData, profile]);

  // Auto-save sender data from profile if pratica has no sender data
  useEffect(() => {
    const hasPraticaSenderData = senderData.sender_name || senderData.sender_address || senderData.sender_city;
    const hasProfileData = profile?.full_name || profile?.address || profile?.city;
    
    if (!hasPraticaSenderData && hasProfileData && user && !autoSaved) {
      // Auto-fill from profile and save to pratica
      const today = format(new Date(), 'yyyy-MM-dd');
      const autoFillData = {
        sender_name: profile?.full_name || null,
        sender_address: profile?.address || null,
        sender_postal_code: profile?.postal_code || null,
        sender_city: profile?.city || null,
        sender_country: profile?.country || 'DE',
        sender_date: today,
      };
      
      // Save to database
      supabase
        .from('pratiche')
        .update(autoFillData)
        .eq('id', praticaId)
        .then(({ error }) => {
          if (!error) {
            onSenderDataUpdate(autoFillData);
            setAutoSaved(true);
          }
        });
    }
  }, [profile, senderData, user, praticaId, onSenderDataUpdate, autoSaved]);

  const fetchProfile = async () => {
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

  // Get effective data (sender data if set, otherwise profile)
  const getEffectiveData = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      name: senderData.sender_name || profile?.full_name || '',
      address: senderData.sender_address || profile?.address || '',
      postal_code: senderData.sender_postal_code || profile?.postal_code || '',
      city: senderData.sender_city || profile?.city || '',
      country: senderData.sender_country || profile?.country || 'DE',
      date: senderData.sender_date || today,
    };
  };

  const handleSaveForLetter = async () => {
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('pratiche')
        .update({
          sender_name: formData.sender_name || null,
          sender_address: formData.sender_address || null,
          sender_postal_code: formData.sender_postal_code || null,
          sender_city: formData.sender_city || null,
          sender_country: formData.sender_country || null,
          sender_date: formData.sender_date || null,
        })
        .eq('id', praticaId);

      if (error) {
        toast.error(t('sender.saveError'));
        return;
      }

      onSenderDataUpdate({
        sender_name: formData.sender_name || null,
        sender_address: formData.sender_address || null,
        sender_postal_code: formData.sender_postal_code || null,
        sender_city: formData.sender_city || null,
        sender_country: formData.sender_country || null,
        sender_date: formData.sender_date || null,
      });

      toast.success(t('sender.saved'));
      setIsEditing(false);
    } catch (err) {
      toast.error(t('sender.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsDefault = async () => {
    if (!user) return;
    
    setSavingProfile(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.sender_name || null,
          address: formData.sender_address || null,
          postal_code: formData.sender_postal_code || null,
          city: formData.sender_city || null,
          country: formData.sender_country || null,
        })
        .eq('id', user.id);

      if (error) {
        toast.error(t('sender.saveProfileError'));
        return;
      }

      // Update local profile state
      setProfile({
        full_name: formData.sender_name,
        address: formData.sender_address,
        postal_code: formData.sender_postal_code,
        city: formData.sender_city,
        country: formData.sender_country,
      });

      toast.success(t('sender.savedAsDefault'));
    } catch (err) {
      toast.error(t('sender.saveProfileError'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancel = () => {
    // Reset form to current effective data
    const effective = getEffectiveData();
    setFormData({
      sender_name: effective.name,
      sender_address: effective.address,
      sender_postal_code: effective.postal_code,
      sender_city: effective.city,
      sender_country: effective.country,
      sender_date: effective.date,
    });
    setIsEditing(false);
  };

  const effective = getEffectiveData();
  const hasData = effective.name || effective.address || effective.city;

  // Format date for display (German format)
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return format(date, 'dd.MM.yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="mb-6 print:hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('sender.title')}</CardTitle>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
              <Pencil className="h-4 w-4" />
              {t('sender.edit')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sender_name">{t('sender.name')}</Label>
                <Input
                  id="sender_name"
                  value={formData.sender_name}
                  onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                  placeholder={t('sender.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender_date">{t('sender.date')}</Label>
                <Input
                  id="sender_date"
                  type="date"
                  value={formData.sender_date}
                  onChange={(e) => setFormData({ ...formData, sender_date: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sender_address">{t('sender.address')}</Label>
              <Input
                id="sender_address"
                value={formData.sender_address}
                onChange={(e) => setFormData({ ...formData, sender_address: e.target.value })}
                placeholder={t('sender.addressPlaceholder')}
              />
            </div>
            
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sender_postal_code">{t('sender.postalCode')}</Label>
                <Input
                  id="sender_postal_code"
                  value={formData.sender_postal_code}
                  onChange={(e) => setFormData({ ...formData, sender_postal_code: e.target.value })}
                  placeholder={t('sender.postalCodePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender_city">{t('sender.city')}</Label>
                <Input
                  id="sender_city"
                  value={formData.sender_city}
                  onChange={(e) => setFormData({ ...formData, sender_city: e.target.value })}
                  placeholder={t('sender.cityPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender_country">{t('sender.country')}</Label>
                <Input
                  id="sender_country"
                  value={formData.sender_country}
                  onChange={(e) => setFormData({ ...formData, sender_country: e.target.value })}
                  placeholder="DE"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button 
                onClick={handleSaveForLetter} 
                disabled={saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('sender.saveForLetter')}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSaveAsDefault}
                disabled={savingProfile}
                className="gap-2"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('sender.saveAsDefault')}
              </Button>
              <Button variant="ghost" onClick={handleCancel} className="gap-2">
                <X className="h-4 w-4" />
                {t('sender.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {hasData ? (
              <>
                {effective.name && <div className="font-medium">{effective.name}</div>}
                {effective.address && <div>{effective.address}</div>}
                {formatCapCity(effective.postal_code, effective.city) && (
                  <div>{formatCapCity(effective.postal_code, effective.city)}</div>
                )}
                {effective.country && <div>{effective.country}</div>}
                <div className="pt-2 text-muted-foreground">
                  {effective.city ? `${effective.city}, ` : ''}{formatDisplayDate(effective.date)}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">{t('sender.noData')}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
