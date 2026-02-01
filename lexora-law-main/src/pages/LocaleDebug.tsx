import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage, languages, countries, Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import i18n from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

// Import all locale files for key comparison
import en from '@/locales/en.json';
import de from '@/locales/de.json';
import it from '@/locales/it.json';
import fr from '@/locales/fr.json';
import es from '@/locales/es.json';
import tr from '@/locales/tr.json';
import ro from '@/locales/ro.json';
import pl from '@/locales/pl.json';

interface CheckResult {
  label: string;
  status: 'pass' | 'fail' | 'warn';
  value: string;
  expected?: string;
}

// Recursively get all keys from a nested object
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Get locale data by code
const localeData: Record<string, Record<string, unknown>> = {
  en, de, it, fr, es, tr, ro, pl
};

export default function LocaleDebug() {
  const { language, country, countryInfo, isRTL, languageInfo, setLanguage, setCountry, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [forceUpdate, setForceUpdate] = useState(0);

  const localStorageLang = localStorage.getItem('lexora-language');
  const localStorageCountry = localStorage.getItem('lexora-country');
  const browserLang = navigator.language;
  const i18nCurrentLang = i18n.language;
  const htmlLang = document.documentElement.lang;
  const htmlDir = document.documentElement.dir;

  // Calculate missing keys for each language compared to EN (reference)
  const keyAnalysis = useMemo(() => {
    const enKeys = new Set(getAllKeys(en as Record<string, unknown>));
    const analysis: Record<string, { missing: string[]; total: number; enTotal: number }> = {};

    for (const [code, data] of Object.entries(localeData)) {
      if (code === 'en') {
        analysis[code] = { missing: [], total: enKeys.size, enTotal: enKeys.size };
        continue;
      }
      const langKeys = new Set(getAllKeys(data as Record<string, unknown>));
      const missing: string[] = [];
      for (const key of enKeys) {
        if (!langKeys.has(key)) {
          missing.push(key);
        }
      }
      analysis[code] = { missing, total: langKeys.size, enTotal: enKeys.size };
    }
    return analysis;
  }, []);

  // Translation sample tests
  const translationSamples = useMemo(() => {
    const currentCode = language.toLowerCase();
    const samples = [
      { key: 'dashboard.title', label: 'Dashboard Title' },
      { key: 'dashboard.pageTitle', label: 'Dashboard Page Title' },
      { key: 'dashboard.new', label: 'New Case Button' },
      { key: 'dashboard.actions.urgent.title', label: 'Urgent Action Title' },
      { key: 'settings.title', label: 'Settings Title' },
      { key: 'common.save', label: 'Save Button' },
    ];

    return samples.map(s => ({
      ...s,
      value: t(s.key),
      enValue: i18n.t(s.key, { lng: 'en' }),
      isTranslated: t(s.key) !== i18n.t(s.key, { lng: 'en' }) || currentCode === 'en',
      isFallback: t(s.key) === i18n.t(s.key, { lng: 'en' }) && currentCode !== 'en',
    }));
  }, [language, t, forceUpdate]);

  const checks: CheckResult[] = [
    {
      label: 'i18n.language matches context',
      status: i18nCurrentLang === language.toLowerCase() ? 'pass' : 'fail',
      value: i18nCurrentLang,
      expected: language.toLowerCase(),
    },
    {
      label: 'document.lang matches language',
      status: htmlLang === language.toLowerCase() ? 'pass' : 'fail',
      value: htmlLang,
      expected: language.toLowerCase(),
    },
    {
      label: 'document.dir matches RTL setting',
      status: htmlDir === (isRTL ? 'rtl' : 'ltr') ? 'pass' : 'fail',
      value: htmlDir,
      expected: isRTL ? 'rtl' : 'ltr',
    },
    {
      label: 'localStorage language persisted',
      status: localStorageLang === language.toLowerCase() ? 'pass' : 'warn',
      value: localStorageLang || '(not set)',
      expected: language.toLowerCase(),
    },
    {
      label: 'localStorage country persisted',
      status: localStorageCountry === country ? 'pass' : 'warn',
      value: localStorageCountry || '(not set)',
      expected: country,
    },
    {
      label: 'User authenticated',
      status: user ? 'pass' : 'warn',
      value: user ? user.email || user.id : '(not logged in)',
    },
    {
      label: `Missing keys for ${language}`,
      status: (keyAnalysis[language.toLowerCase()]?.missing.length || 0) === 0 ? 'pass' : 'fail',
      value: `${keyAnalysis[language.toLowerCase()]?.missing.length || 0} missing`,
      expected: '0 missing',
    },
    {
      label: 'Translations not falling back to EN',
      status: translationSamples.every(s => !s.isFallback) ? 'pass' : 'fail',
      value: `${translationSamples.filter(s => s.isFallback).length} fallbacks`,
      expected: '0 fallbacks',
    },
  ];

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;

  const StatusIcon = ({ status }: { status: 'pass' | 'fail' | 'warn' }) => {
    if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'fail') return <XCircle className="h-4 w-4 text-red-600" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Locale Debug Panel</h1>
          <Badge variant={failCount === 0 ? 'default' : 'destructive'}>
            {passCount}/{checks.length} pass
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setForceUpdate(n => n + 1)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Current State */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Locale State</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Language:</span>
              <p className="font-medium">{languageInfo.flag} {language} ({languageInfo.nativeName})</p>
            </div>
            <div>
              <span className="text-muted-foreground">Country:</span>
              <p className="font-medium">{countryInfo.flag} {country} ({countryInfo.nativeName})</p>
            </div>
            <div>
              <span className="text-muted-foreground">RTL:</span>
              <p className="font-medium">{isRTL ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Legal Format:</span>
              <p className="font-medium">{countryInfo.letterFormat}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Authority Term:</span>
              <p className="font-medium">{countryInfo.authorityTerm}</p>
            </div>
            <div>
              <span className="text-muted-foreground">i18n.language:</span>
              <p className="font-medium">{i18nCurrentLang}</p>
            </div>
          </CardContent>
        </Card>

        {/* QA Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">QA Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checks.map((check, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <StatusIcon status={check.status} />
                <span className="flex-1">{check.label}</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">{check.value}</code>
                {check.expected && check.status !== 'pass' && (
                  <span className="text-muted-foreground text-xs">expected: {check.expected}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Translation Samples */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Translation Samples ({language})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {translationSamples.map((sample, idx) => (
                <div key={idx} className="flex items-start gap-3 border-b pb-2">
                  <StatusIcon status={sample.isFallback ? 'fail' : 'pass'} />
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground">{sample.label}:</span>
                      <code className="text-xs bg-muted px-1 rounded">{sample.key}</code>
                    </div>
                    <p className="font-medium">{sample.value}</p>
                    {sample.isFallback && (
                      <p className="text-red-600 text-xs">⚠️ Falling back to EN: "{sample.enValue}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Missing Keys Report */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Missing Keys Report (vs EN baseline)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              {Object.entries(keyAnalysis).map(([code, data]) => (
                <div key={code} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={data.missing.length === 0 ? 'pass' : 'fail'} />
                    <span className="font-medium uppercase">{code}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {data.missing.length === 0 
                      ? `✓ ${data.total} keys (complete)` 
                      : `✗ ${data.missing.length} missing of ${data.enTotal}`}
                  </p>
                </div>
              ))}
            </div>
            
            {keyAnalysis[language.toLowerCase()]?.missing.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="font-medium text-red-700 dark:text-red-400 mb-2">
                  Missing keys for {language}:
                </p>
                <ul className="text-xs text-red-600 dark:text-red-400 max-h-40 overflow-y-auto">
                  {keyAnalysis[language.toLowerCase()]?.missing.slice(0, 20).map(key => (
                    <li key={key} className="font-mono">{key}</li>
                  ))}
                  {(keyAnalysis[language.toLowerCase()]?.missing.length || 0) > 20 && (
                    <li className="italic">...and {keyAnalysis[language.toLowerCase()].missing.length - 20} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Language Switch */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Language Switch (Test)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant={language === lang.code ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLanguage(lang.code)}
              >
                {lang.flag} {lang.code}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Locale Sources (Priority Order)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">1. User Profile (DB)</span>
              <span className="font-medium">{user ? '(loaded if set)' : '(not logged in)'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">2. localStorage (lexora-language)</span>
              <span className="font-medium">{localStorageLang || '(not set)'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">3. Browser Language</span>
              <span className="font-medium">{browserLang}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">4. Default</span>
              <span className="font-medium">DE</span>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">How to Test:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Switch language above → verify all checks pass</li>
              <li>Reload page (F5) → verify language persists</li>
              <li>Check "Translation Samples" shows translated text, not EN fallback</li>
              <li>Check "Missing Keys Report" shows 0 missing for current language</li>
              <li>Navigate to /app → verify dashboard shows correct translations</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
