import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GeoBlockedPage } from "@/components/GeoBlockedPage";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { useGeoBlock } from "@/hooks/useGeoBlock";
import { useGeoLocale } from "@/hooks/useGeoLocale";
import { Loader2 } from "lucide-react";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AppDashboard from "./pages/AppDashboard";
import NewPratica from "./pages/NewPratica";
import EditPratica from "./pages/EditPratica";
import DettaglioPratica from "./pages/DettaglioPratica";
import PrivacyPolicyMaster from "./pages/PrivacyPolicyMaster";
import { PrivacyDE, PrivacyIT, PrivacyFR, PrivacyES } from "./pages/privacy";
import TermsOfService from "./pages/TermsOfService";
import Disclaimer from "./pages/Disclaimer";
import Impressum from "./pages/Impressum";
import ScanDocument from "./pages/ScanDocument";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import Support from "./pages/Support";
import NotFound from "./pages/NotFound";
import LocaleDebug from "./pages/LocaleDebug";
import Pricing from "./pages/Pricing";
import AdminPanel from "./pages/AdminPanel";
import AdminUsage from "./pages/AdminUsage";
import AccountUsage from "./pages/AccountUsage";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import DemoLetterPreview from "./pages/DemoLetterPreview";
import { PWAInstall } from "@/components/PWAInstall";
import { MobilePwaBanner } from "@/components/MobilePWAPrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PullToRefresh } from "@/components/PullToRefresh";
import { AuthMigrationFix } from "@/components/AuthMigrationFix";
// SEO Pages (DE only)
import OffizielleBriefeVerstehen from "./pages/seo/OffizielleBriefeVerstehen";
import SchufaBriefVerstehen from "./pages/seo/SchufaBriefVerstehen";
import FamilienkasseSchreiben from "./pages/seo/FamilienkasseSchreiben";
import InkassoMahnungErhalten from "./pages/seo/InkassoMahnungErhalten";
import JobcenterBriefErhalten from "./pages/seo/JobcenterBriefErhalten";

const queryClient = new QueryClient();

// Component that activates heartbeat for logged-in users
function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  useHeartbeat();
  return <>{children}</>;
}

// GeoBlock wrapper - blocks access from RU/CN
function GeoBlockWrapper({ children }: { children: React.ReactNode }) {
  const { loading, isBlocked, countryCode, error } = useGeoBlock();

  // Show loading state with proper styling
  if (loading) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: 'hsl(209, 61%, 11%)' }} // Navy fallback
      >
        <Loader2 
          className="h-8 w-8 animate-spin" 
          style={{ color: 'hsl(43, 54%, 55%)' }} // Gold fallback
        />
      </div>
    );
  }

  // Show blocked page for blocked countries
  if (isBlocked) {
    console.log('[GeoBlockWrapper] Rendering blocked page for:', countryCode);
    return <GeoBlockedPage countryCode={countryCode || undefined} />;
  }

  // Log if there was an error but we're allowing access
  if (error) {
    console.log('[GeoBlockWrapper] Geo check had error but allowing access:', error);
  }

  return <>{children}</>;
}

// Applies geo-detected locale on login
function GeoLocaleProvider({ children }: { children: React.ReactNode }) {
  useGeoLocale();
  return <>{children}</>;
}

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HeartbeatProvider>
        <LanguageProvider>
          <GeoLocaleProvider>
            <GeoBlockWrapper>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PullToRefresh />
              <OfflineIndicator />
              <BrowserRouter>
                <AuthMigrationFix />
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/demo/letter-preview" element={<DemoLetterPreview />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/signup" element={<Auth />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/update-password" element={<UpdatePassword />} />
                  <Route path="/privacy" element={<PrivacyPolicyMaster />} />
                  <Route path="/de/privacy" element={<PrivacyDE />} />
                  <Route path="/it/privacy" element={<PrivacyIT />} />
                  <Route path="/fr/privacy" element={<PrivacyFR />} />
                  <Route path="/es/privacy" element={<PrivacyES />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/disclaimer" element={<Disclaimer />} />
                  <Route path="/impressum" element={<Impressum />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/scan" element={<ScanDocument />} />
                  {/* SEO Pages (DE only) */}
                  <Route path="/offizielle-briefe-verstehen" element={<OffizielleBriefeVerstehen />} />
                  <Route path="/schufa-brief-verstehen" element={<SchufaBriefVerstehen />} />
                  <Route path="/familienkasse-schreiben" element={<FamilienkasseSchreiben />} />
                  <Route path="/inkasso-mahnung-erhalten" element={<InkassoMahnungErhalten />} />
                  <Route path="/jobcenter-brief-erhalten" element={<JobcenterBriefErhalten />} />
                  
                  {/* Checkout success (auto-sync after payment) */}
                  <Route path="/checkout/success" element={<CheckoutSuccess />} />
                  
                  {/* Protected routes */}
                  <Route path="/app" element={<ProtectedRoute><AppDashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<Navigate to="/app" replace />} />
                  <Route path="/pratiche" element={<ProtectedRoute><AppDashboard /></ProtectedRoute>} />
                  <Route path="/new" element={<ProtectedRoute><NewPratica /></ProtectedRoute>} />
                  <Route path="/nuova-pratica" element={<Navigate to="/new" replace />} />
                  {/* /scan is now public - moved above */}
                  <Route path="/edit/:id" element={<ProtectedRoute><EditPratica /></ProtectedRoute>} />
                  <Route path="/pratiche/:id" element={<ProtectedRoute><DettaglioPratica /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
                  <Route path="/account/usage" element={<ProtectedRoute><AccountUsage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPanel /></ProtectedRoute>} />
                  <Route path="/admin/usage" element={<ProtectedRoute requireAdmin><AdminUsage /></ProtectedRoute>} />
                  
                  {/* Debug route */}
                  <Route path="/debug/locale" element={<LocaleDebug />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              <PWAInstall />
              <MobilePwaBanner />
            </TooltipProvider>
            </GeoBlockWrapper>
          </GeoLocaleProvider>
        </LanguageProvider>
      </HeartbeatProvider>
    </AuthProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
