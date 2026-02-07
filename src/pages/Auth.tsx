import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/Header';
import { LanguageSelector } from '@/components/LanguageSelector';
import { LegalFooter } from '@/components/LegalFooter';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { Loader2, Shield, Scale } from 'lucide-react';
import { TERMS_VERSION, PRIVACY_VERSION, AGE_POLICY_VERSION, DISCLAIMER_VERSION } from '@/lib/legalVersions';

const emailSchema = z.string().email();
const passwordSchema = z.string().min(6);

export default function Auth() {
  const { t, isRTL } = useLanguage();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse template from query params (e.g., ?template=blitzer)
  const searchParams = new URLSearchParams(location.search);
  const template = searchParams.get('template');
  
  const defaultTab = location.pathname === '/signup' ? 'signup' : 'login';
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', confirmPassword: '', name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // IMPORTANT: use getSession() (source of truth) instead of potentially stale React state
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        // If template is specified, redirect to new-case with template
        if (template) {
          navigate(`/new-case?template=${template}`, { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, template]);

  const validateLogin = () => {
    const newErrors: Record<string, string> = {};
    
    if (!emailSchema.safeParse(loginData.email).success) {
      newErrors.loginEmail = t('auth.error.email');
    }
    if (!passwordSchema.safeParse(loginData.password).success) {
      newErrors.loginPassword = t('auth.error.password');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors: Record<string, string> = {};
    
    if (!emailSchema.safeParse(signupData.email).success) {
      newErrors.signupEmail = t('auth.error.email');
    }
    if (!passwordSchema.safeParse(signupData.password).success) {
      newErrors.signupPassword = t('auth.error.password');
    }
    if (signupData.password !== signupData.confirmPassword) {
      newErrors.signupConfirmPassword = t('auth.error.passwordMatch');
    }
    if (!termsAccepted) {
      newErrors.terms = t('auth.error.termsRequired');
    }
    if (!ageConfirmed) {
      newErrors.age = t('auth.error.ageRequired');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    
    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setIsLoading(false);
    
    if (error) {
      toast.error(error.message || t('auth.error.generic'));
    } else {
      // Redirect to new-case with template if specified
      if (template) {
        navigate(`/new-case?template=${template}`);
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignup()) return;
    
    setIsLoading(true);
    const { error } = await signUp(signupData.email, signupData.password, signupData.name);
    
    if (error) {
      setIsLoading(false);
      if (error.message.includes('already registered')) {
        toast.error(t('auth.hasAccount'));
      } else {
        toast.error(error.message || t('auth.error.generic'));
      }
    } else {
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        // Save consent with timestamp and version from centralized config
        const consentTimestamp = new Date().toISOString();
        await supabase
          .from('profiles')
          .update({ 
            terms_accepted_at: consentTimestamp,
            terms_version: TERMS_VERSION,
            privacy_accepted_at: consentTimestamp,
            privacy_version: PRIVACY_VERSION,
            age_confirmed: true,
            age_policy_version: AGE_POLICY_VERSION
          })
          .eq('id', newUser.id);

        // Insert audit event for signup acceptance
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
        await supabase
          .from('legal_acceptance_events')
          .insert({
            user_id: newUser.id,
            event_type: 'signup_accept',
            terms_version: TERMS_VERSION,
            privacy_version: PRIVACY_VERSION,
            age_policy_version: AGE_POLICY_VERSION,
            user_agent: userAgent,
          });
      }
      setIsLoading(false);
      toast.success(t('auth.success.signup'));
      // Redirect to new-case with template if specified
      if (template) {
        navigate(`/new-case?template=${template}`);
      } else {
        navigate('/dashboard');
      }
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Premium Header */}
      <header className="border-b border-gold/20">
        <div className="container flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            {/* Elegant crest-style logo */}
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              <div className="absolute inset-1 rounded-full border border-gold/30" />
              <span className="relative font-display text-lg font-semibold text-gold" style={{ fontFamily: 'Georgia, serif' }}>L</span>
            </div>
            <span className="font-display text-xl font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </Link>
          
          {/* Language Selector */}
          <LanguageSelector />
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      </header>
      
      <main className="container flex flex-col items-center justify-center py-16">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-medium text-ivory mb-2">{t('header.privateWorkspace')}</h1>
          <p className="text-ivory/60">{t('auth.subtitle')}</p>
        </div>

        <Card className="w-full max-w-md bg-ivory border-gold/20 shadow-premium">
          <Tabs defaultValue={defaultTab} className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-2 bg-navy/5">
                <TabsTrigger 
                  value="login" 
                  className="data-[state=active]:bg-navy data-[state=active]:text-gold"
                >
                  {t('auth.login')}
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="data-[state=active]:bg-navy data-[state=active]:text-gold"
                >
                  {t('auth.signup')}
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent className="pt-6">
              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-navy">{t('auth.email')}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className={`bg-white border-navy/20 text-navy ${errors.loginEmail ? 'border-destructive' : ''}`}
                    />
                    {errors.loginEmail && (
                      <p className="text-sm text-destructive">{errors.loginEmail}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-navy">{t('auth.password')}</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className={`bg-white border-navy/20 text-navy ${errors.loginPassword ? 'border-destructive' : ''}`}
                    />
                    {errors.loginPassword && (
                      <p className="text-sm text-destructive">{errors.loginPassword}</p>
                    )}
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right">
                    <Link
                      to="/reset-password"
                      className="text-sm text-gold hover:underline"
                    >
                      {t('auth.forgotPassword')}
                    </Link>
                  </div>
                  
                  <Button type="submit" variant="premium" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.loginBtn')}
                  </Button>
                </form>
              </TabsContent>
              
              {/* Signup Tab */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-navy">{t('auth.name')}</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupData.name}
                      onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                      className="bg-white border-navy/20 text-navy"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-navy">{t('auth.email')}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      className={`bg-white border-navy/20 text-navy ${errors.signupEmail ? 'border-destructive' : ''}`}
                    />
                    {errors.signupEmail && (
                      <p className="text-sm text-destructive">{errors.signupEmail}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-navy">{t('auth.password')}</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      className={`bg-white border-navy/20 text-navy ${errors.signupPassword ? 'border-destructive' : ''}`}
                    />
                    {errors.signupPassword && (
                      <p className="text-sm text-destructive">{errors.signupPassword}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-navy">{t('auth.confirmPassword')}</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      className={`bg-white border-navy/20 text-navy ${errors.signupConfirmPassword ? 'border-destructive' : ''}`}
                    />
                    {errors.signupConfirmPassword && (
                      <p className="text-sm text-destructive">{errors.signupConfirmPassword}</p>
                    )}
                  </div>

                  {/* Age confirmation - 18+ required */}
                  <div className={`rounded-lg border bg-amber-50 p-4 ${errors.age ? 'border-destructive' : 'border-amber-200'}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="age"
                        checked={ageConfirmed}
                        onCheckedChange={(checked) => setAgeConfirmed(checked === true)}
                        className="border-amber-400 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                      />
                      <div className="flex-1">
                        <Label htmlFor="age" className="cursor-pointer text-sm font-medium leading-relaxed text-amber-900">
                          {t('auth.ageConfirm')}
                        </Label>
                        <p className="mt-1 text-xs text-amber-700">
                          {t('auth.ageNote')}
                        </p>
                      </div>
                    </div>
                    {errors.age && (
                      <p className="mt-2 text-sm text-destructive">{errors.age}</p>
                    )}
                  </div>

                  {/* Terms, Privacy & Disclaimer acceptance */}
                  <div className={`rounded-lg border bg-white p-4 ${errors.terms ? 'border-destructive' : 'border-navy/20'}`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        className="border-navy/30 data-[state=checked]:bg-navy data-[state=checked]:border-navy"
                      />
                      <div className="flex-1">
                        <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-navy">
                          <Shield className="mr-1.5 inline h-4 w-4 text-gold" />
                          {t('auth.termsAccept')}{' '}
                          <Link to="/terms" className="text-gold hover:underline" target="_blank">
                            {t('auth.termsLink')}
                          </Link>
                          {', '}
                          <Link to="/privacy" className="text-gold hover:underline" target="_blank">
                            {t('auth.privacyLink')}
                          </Link>
                          {', '}{t('auth.termsAnd')}{' '}
                          <Link to="/disclaimer" className="text-gold hover:underline" target="_blank">
                            {t('auth.disclaimerLink')}
                          </Link>
                        </Label>
                        <p className="mt-1 text-xs text-navy/50">
                          {t('auth.termsNote')}
                        </p>
                      </div>
                    </div>
                    {errors.terms && (
                      <p className="mt-2 text-sm text-destructive">{errors.terms}</p>
                    )}
                  </div>
                  
                  <Button type="submit" variant="premium" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.signupBtn')}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Footer Branding */}
        <div className="flex items-center justify-center gap-2 mt-12">
          <Scale className="h-5 w-5 text-gold/60" />
          <span className="text-sm text-ivory/40 font-medium">Private Legal Workspace</span>
        </div>

        {/* Legal Footer Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-ivory/50">
          <Link to="/terms" className="hover:text-gold transition-colors">
            {t('footer.terms')}
          </Link>
          <span>•</span>
          <Link to="/privacy" className="hover:text-gold transition-colors">
            {t('footer.privacy')}
          </Link>
          <span>•</span>
          <Link to="/disclaimer" className="hover:text-gold transition-colors">
            {t('footer.disclaimer')}
          </Link>
          <span>•</span>
          <Link to="/impressum" className="hover:text-gold transition-colors">
            {t('footer.impressum')}
          </Link>
        </div>
      </main>
    </div>
  );
}