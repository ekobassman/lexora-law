import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { hardLogout } from "@/lib/logout";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { FileText, Shield, AlertTriangle, ExternalLink } from "lucide-react";

type DocType = "terms" | "privacy" | "disclaimer";

type LegalVersion = {
  doc_type: DocType;
  version: string;
  published_at: string;
  summary?: string | null;
};

type UserAcceptances = {
  accepted_terms_version: string | null;
  accepted_privacy_version: string | null;
  accepted_disclaimer_version: string | null;
};

const DOC_PATHS: Record<DocType, string> = {
  terms: "/terms",
  privacy: "/privacy",
  disclaimer: "/avvertenza",
};

const DOC_ICONS: Record<DocType, React.ElementType> = {
  terms: FileText,
  privacy: Shield,
  disclaimer: AlertTriangle,
};

const LOCALE_MAP: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
  it: "it-IT",
  fr: "fr-FR",
  es: "es-ES",
  tr: "tr-TR",
  ro: "ro-RO",
  ru: "ru-RU",
  uk: "uk-UA",
};

const TRANSLATIONS: Record<string, Record<string, string>> = {
  de: {
    title: "Rechtliche Aktualisierung erforderlich",
    description:
      "Wir haben unsere rechtlichen Dokumente aktualisiert. Um fortzufahren, müssen Sie die Änderungen akzeptieren.",
    terms: "Nutzungsbedingungen",
    privacy: "Datenschutzerklärung",
    disclaimer: "Haftungsausschluss",
    accept: "Akzeptieren und fortfahren",
    logout: "Abmelden",
    version: "Version",
    updated: "Aktualisiert",
    open: "Öffnen",
  },
  en: {
    title: "Legal Update Required",
    description:
      "We have updated our legal documents. To continue, you must accept the changes.",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    disclaimer: "Disclaimer",
    accept: "Accept and Continue",
    logout: "Log Out",
    version: "Version",
    updated: "Updated",
    open: "Open",
  },
  it: {
    title: "Aggiornamento legale richiesto",
    description:
      "Abbiamo aggiornato i nostri documenti legali. Per continuare, devi accettare le modifiche.",
    terms: "Termini di Servizio",
    privacy: "Privacy Policy",
    disclaimer: "Avvertenza",
    accept: "Accetto e continuo",
    logout: "Esci",
    version: "Versione",
    updated: "Aggiornato",
    open: "Apri",
  },
  fr: {
    title: "Mise à jour légale requise",
    description:
      "Nous avons mis à jour nos documents juridiques. Pour continuer, vous devez accepter les modifications.",
    terms: "Conditions d'utilisation",
    privacy: "Politique de confidentialité",
    disclaimer: "Avertissement",
    accept: "Accepter et continuer",
    logout: "Déconnexion",
    version: "Version",
    updated: "Mis à jour",
    open: "Ouvrir",
  },
  es: {
    title: "Actualización legal requerida",
    description:
      "Hemos actualizado nuestros documentos legales. Para continuar, debe aceptar los cambios.",
    terms: "Términos de Servicio",
    privacy: "Política de Privacidad",
    disclaimer: "Aviso Legal",
    accept: "Aceptar y continuar",
    logout: "Cerrar sesión",
    version: "Versión",
    updated: "Actualizado",
    open: "Abrir",
  },
  tr: {
    title: "Yasal Güncelleme Gerekli",
    description:
      "Yasal belgelerimizi güncelledik. Devam etmek için değişiklikleri kabul etmelisiniz.",
    terms: "Kullanım Koşulları",
    privacy: "Gizlilik Politikası",
    disclaimer: "Yasal Uyarı",
    accept: "Kabul Et ve Devam Et",
    logout: "Çıkış Yap",
    version: "Sürüm",
    updated: "Güncellendi",
    open: "Aç",
  },
  ro: {
    title: "Actualizare legală necesară",
    description:
      "Am actualizat documentele noastre legale. Pentru a continua, trebuie să acceptați modificările.",
    terms: "Termeni și Condiții",
    privacy: "Politica de Confidențialitate",
    disclaimer: "Avertisment",
    accept: "Accept și continui",
    logout: "Deconectare",
    version: "Versiune",
    updated: "Actualizat",
    open: "Deschide",
  },
  ru: {
    title: "Требуется обновление правовых документов",
    description:
      "Мы обновили наши юридические документы. Чтобы продолжить, вы должны принять изменения.",
    terms: "Условия использования",
    privacy: "Политика конфиденциальности",
    disclaimer: "Отказ от ответственности",
    accept: "Принять и продолжить",
    logout: "Выйти",
    version: "Версия",
    updated: "Обновлено",
    open: "Открыть",
  },
  uk: {
    title: "Потрібне оновлення правових документів",
    description:
      "Ми оновили наші юридичні документи. Щоб продовжити, ви повинні прийняти зміни.",
    terms: "Умови використання",
    privacy: "Політика конфіденційності",
    disclaimer: "Відмова від відповідальності",
    accept: "Прийняти та продовжити",
    logout: "Вийти",
    version: "Версія",
    updated: "Оновлено",
    open: "Відкрити",
  },
};

function normalizeLang(lang?: string): string {
  const raw = (lang || "en").toLowerCase();
  const short = raw.split("-")[0];
  return LOCALE_MAP[short] ? short : "en";
}

export function LegalAcceptanceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const lang = useMemo(() => normalizeLang(language), [language]);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const dateLocale = LOCALE_MAP[lang] || "en-US";

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [legalVersions, setLegalVersions] = useState<LegalVersion[]>([]);
  const [missingDocs, setMissingDocs] = useState<DocType[]>([]);

  const checkLegalStatus = useCallback(async () => {
    if (!user) {
      setNeedsAcceptance(false);
      setMissingDocs([]);
      setLoading(false);
      return;
    }

    try {
      const { data: versions, error: versionsError } = await supabase
        .from("legal_versions")
        .select("doc_type, version, published_at, summary");

      if (versionsError) {
        console.error("[LegalAcceptanceGate] versions error:", versionsError);
        setLoading(false);
        return;
      }

      const current = (versions || []) as LegalVersion[];
      setLegalVersions(current);

      const required: DocType[] = ["terms", "privacy", "disclaimer"];
      const missingRows = required.filter(
        (d) => !current.some((v) => v.doc_type === d)
      );

      if (missingRows.length > 0) {
        console.warn("[LegalAcceptanceGate] legal_versions incomplete:", missingRows);
        setMissingDocs(required);
        setNeedsAcceptance(true);
        setLoading(false);
        return;
      }

      const { data: acc, error: accError } = await supabase
        .from("user_legal_acceptances")
        .select("accepted_terms_version, accepted_privacy_version, accepted_disclaimer_version")
        .eq("user_id", user.id)
        .maybeSingle();

      if (accError) {
        console.error("[LegalAcceptanceGate] acceptances error:", accError);
        setLoading(false);
        return;
      }

      const acceptances: UserAcceptances = acc || {
        accepted_terms_version: null,
        accepted_privacy_version: null,
        accepted_disclaimer_version: null,
      };

      const termsV = current.find((v) => v.doc_type === "terms")!.version;
      const privacyV = current.find((v) => v.doc_type === "privacy")!.version;
      const discV = current.find((v) => v.doc_type === "disclaimer")!.version;

      const missing: DocType[] = [];
      if (acceptances.accepted_terms_version !== termsV) missing.push("terms");
      if (acceptances.accepted_privacy_version !== privacyV) missing.push("privacy");
      if (acceptances.accepted_disclaimer_version !== discV) missing.push("disclaimer");

      setMissingDocs(missing);
      setNeedsAcceptance(missing.length > 0);
    } catch (e) {
      console.error("[LegalAcceptanceGate] exception:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkLegalStatus();
    const interval = setInterval(checkLegalStatus, 15 * 60 * 1000);

    const onVis = () => {
      if (document.visibilityState === "visible") checkLegalStatus();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [checkLegalStatus]);

  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    try {
      const termsV = legalVersions.find((v) => v.doc_type === "terms")?.version || null;
      const privacyV = legalVersions.find((v) => v.doc_type === "privacy")?.version || null;
      const discV = legalVersions.find((v) => v.doc_type === "disclaimer")?.version || null;

      const { error } = await supabase.from("user_legal_acceptances").upsert(
        {
          user_id: user.id,
          accepted_terms_version: termsV,
          accepted_privacy_version: privacyV,
          accepted_disclaimer_version: discV,
          accepted_at: new Date().toISOString(),
          accepted_user_agent: navigator.userAgent,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        console.error("[LegalAcceptanceGate] upsert error:", error);
        return;
      }

      await checkLegalStatus();
    } finally {
      setAccepting(false);
    }
  };

  const handleLogout = async () => {
    await hardLogout();
    navigate("/");
  };

  const openDocument = (doc: DocType) => {
    window.open(DOC_PATHS[doc], "_blank", "noopener,noreferrer");
  };

  if (loading || !user) return <>{children}</>;

  if (!needsAcceptance) return <>{children}</>;

  const required: DocType[] = ["terms", "privacy", "disclaimer"];
  const docsToShow = (missingDocs.length ? missingDocs : required).map((d) => {
    const row = legalVersions.find((v) => v.doc_type === d);
    return {
      doc_type: d,
      version: row?.version || "—",
      published_at: row?.published_at || null,
      summary: row?.summary || "",
    };
  });

  return (
    <>
      {children}
      <Dialog open>
        <DialogContent
          className="w-screen h-screen max-w-none rounded-none"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {docsToShow.map((doc) => {
              const Icon = DOC_ICONS[doc.doc_type];
              const label = t[doc.doc_type] || doc.doc_type;
              const dateStr = doc.published_at
                ? new Date(doc.published_at).toLocaleDateString(dateLocale)
                : "—";
              return (
                <div
                  key={doc.doc_type}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-1 h-5 w-5" />
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-sm opacity-80">
                        {t.version}: {doc.version} · {t.updated}: {dateStr}
                      </div>
                      {doc.summary ? (
                        <div className="text-sm opacity-80 mt-1">{doc.summary}</div>
                      ) : null}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => openDocument(doc.doc_type)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t.open}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting ? "…" : t.accept}
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              {t.logout}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
