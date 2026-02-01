import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Shield, FileText, Clock, Download, Lock, Globe, Database, Scale, Building, Users, Server, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIVACY_VERSION, getLastUpdatedLabel } from '@/lib/legalVersions';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Master Privacy Policy - English version
 * This is the legally binding version that covers all jurisdictions.
 * Localized versions are translations and in case of conflict, this EN version prevails.
 */
export default function PrivacyPolicyMaster() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-navy">
      <Helmet>
        <title>Privacy Policy | Lexora</title>
        <meta name="description" content="Lexora Privacy Policy - Learn how we protect your data. Compliant with GDPR, CCPA, and global privacy regulations." />
        <link rel="canonical" href="https://lexora-law.com/privacy" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <header className="border-b border-gold/20">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              <span className="relative font-display text-sm font-semibold text-gold">L</span>
            </div>
            <span className="font-display text-lg font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </Link>
          <Button variant="ghost" size="sm" asChild className="text-ivory/70 hover:text-gold hover:bg-transparent">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />{t('common.back')}</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-4xl py-12 px-4">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <Shield className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-medium text-ivory">Privacy Policy</h1>
            <p className="text-sm text-ivory/50 mt-1">{getLastUpdatedLabel(PRIVACY_VERSION, 'en')}</p>
            <p className="text-xs text-ivory/30 mt-0.5">Version: {PRIVACY_VERSION}</p>
          </div>
        </div>

        {/* Legal Binding Notice */}
        <div className="mb-8 rounded-lg border border-gold/30 bg-gold/5 p-4">
          <div className="flex items-start gap-3">
            <Scale className="h-5 w-5 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-ivory font-medium">Legally Binding Version</p>
              <p className="text-xs text-ivory/60 mt-1">
                This English version is the authoritative and legally binding Privacy Policy. Translated versions are provided for convenience. 
                In case of any discrepancy between translations and this English version, this English version shall prevail.
              </p>
            </div>
          </div>
        </div>

        {/* Language Versions */}
        <div className="mb-8 rounded-lg border border-gold/20 bg-ivory/5 p-4">
          <p className="text-sm text-ivory/80 mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-gold" />
            <span className="font-medium">Available in your language:</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/de/privacy" className="px-3 py-1 text-xs rounded-full bg-gold/10 text-ivory/80 hover:bg-gold/20 transition-colors">🇩🇪 Deutsch</Link>
            <Link to="/it/privacy" className="px-3 py-1 text-xs rounded-full bg-gold/10 text-ivory/80 hover:bg-gold/20 transition-colors">🇮🇹 Italiano</Link>
            <Link to="/fr/privacy" className="px-3 py-1 text-xs rounded-full bg-gold/10 text-ivory/80 hover:bg-gold/20 transition-colors">🇫🇷 Français</Link>
            <Link to="/es/privacy" className="px-3 py-1 text-xs rounded-full bg-gold/10 text-ivory/80 hover:bg-gold/20 transition-colors">🇪🇸 Español</Link>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section 1: Data Controller */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Building className="h-5 w-5" />
              1. Data Controller
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p>The data controller responsible for your personal data is:</p>
              <div className="bg-navy/50 p-4 rounded-md border border-gold/10 mt-2">
                <p className="font-medium text-ivory">Roberto Imbimbo</p>
                <p className="text-ivory/70">Mörikestraße 10</p>
                <p className="text-ivory/70">72202 Nagold</p>
                <p className="text-ivory/70">Germany</p>
              </div>
            </div>
          </section>

          {/* Section 2: Purpose of Processing */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              2. Purpose of Processing
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">We process personal data to provide the following app functionalities:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Account management and authentication</li>
                <li>Document upload and storage</li>
                <li>OCR (Optical Character Recognition) for text extraction</li>
                <li>AI-powered document analysis and legal guidance</li>
                <li>Draft response generation</li>
                <li>Deadline tracking and reminders</li>
                <li>Customer support and security</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Categories of Data */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              3. Categories of Personal Data
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <div>
                <p className="font-medium text-ivory mb-1">Account Data:</p>
                <p className="ml-4">Email address, user ID, authentication events, subscription status</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Usage Data:</p>
                <p className="ml-4">Technical logs, error reports, timestamps, device information, IP address (anonymized)</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Document Data:</p>
                <p className="ml-4">Uploaded documents and scans, extracted text (OCR), document metadata (file type, size, dates), AI chat interactions</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Payment Data:</p>
                <p className="ml-4">Subscription information (processed by Stripe), billing history</p>
              </div>
            </div>
          </section>

          {/* Section 3.1: CCPA Notice at Collection */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              3.1 CCPA Notice at Collection (California Residents)
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                At or before the point of collection, we inform California residents that we collect personal 
                information for the purposes described in this Privacy Policy, including providing our services, 
                security, legal compliance, and service improvement. We do not sell personal information and we 
                do not share personal information for cross-context behavioral advertising. Data retention periods 
                are described in Section 7.
              </p>
            </div>
          </section>

          {/* Section 4: Legal Basis */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              4. Legal Basis for Processing
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>We process your data based on the following legal grounds:</p>
              <div className="space-y-2 mt-2">
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Contract Performance (GDPR Art. 6(1)(b))</p>
                  <p className="text-sm text-ivory/60">Processing necessary to provide the services you requested</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Legitimate Interest (GDPR Art. 6(1)(f))</p>
                  <p className="text-sm text-ivory/60">Security measures, error analysis, service improvement</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Consent (GDPR Art. 6(1)(a))</p>
                  <p className="text-sm text-ivory/60">When specifically required for optional features or marketing</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Legal Obligation (GDPR Art. 6(1)(c))</p>
                  <p className="text-sm text-ivory/60">Compliance with applicable laws and regulations</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ivory/70">
                For users outside the EU/EEA, we process personal data in accordance with applicable local privacy laws.
              </p>
            </div>
          </section>

          {/* Section 5: Recipients / Processors */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Server className="h-5 w-5" />
              5. Data Recipients & Sub-processors
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>We may share your data with the following categories of recipients:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li><strong>Cloud Infrastructure:</strong> Secure servers for hosting and database services</li>
                <li><strong>AI Services:</strong> For document analysis and text processing (data minimization applied)</li>
                <li><strong>Payment Processors:</strong> Stripe for subscription management</li>
                <li><strong>Email Services:</strong> For transactional emails and notifications</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                All sub-processors are bound by data processing agreements and are required to maintain appropriate security measures.
              </p>
            </div>
          </section>

          {/* Section 6: International Transfers */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Globe className="h-5 w-5" />
              6. International Data Transfers
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Your data may be transferred to and processed in countries outside your country of residence. 
                When we transfer data internationally, we ensure appropriate safeguards are in place:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>EU Standard Contractual Clauses (SCCs)</li>
                <li>Adequacy decisions by the European Commission</li>
                <li>EU-U.S. Data Privacy Framework (where applicable)</li>
                <li>Binding Corporate Rules (BCRs) of our service providers</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Storage Duration */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Clock className="h-5 w-5" />
              7. Data Retention
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p><strong>Account Data:</strong> Retained as long as your account is active</p>
              <p><strong>Documents & Drafts:</strong> Until you delete them or close your account</p>
              <p><strong>Technical Logs:</strong> 30-90 days for security and debugging purposes</p>
              <p><strong>Payment Records:</strong> As required by applicable tax and accounting laws (typically 7-10 years)</p>
              <p className="mt-3 text-sm text-ivory/60">
                Upon account deletion, we will delete or anonymize your personal data within 30 days, except where retention is required by law.
              </p>
            </div>
          </section>

          {/* Section 8: Your Rights */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Users className="h-5 w-5" />
              8. Your Rights
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Depending on your location, you have the following rights regarding your personal data:</p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-medium text-ivory mb-2">For All Users:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li><strong>Access:</strong> Request a copy of your personal data</li>
                    <li><strong>Rectification:</strong> Correct inaccurate data</li>
                    <li><strong>Erasure:</strong> Request deletion of your data</li>
                    <li><strong>Data Portability:</strong> Receive your data in a machine-readable format</li>
                    <li><strong>Objection:</strong> Object to certain processing activities</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">EU/EEA Residents (GDPR):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Right to restriction of processing</li>
                    <li>Right to withdraw consent at any time</li>
                    <li>Right to lodge a complaint with a supervisory authority</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">California Residents (CCPA/CPRA):</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Right to know what personal information is collected</li>
                    <li>Right to access specific pieces of personal information</li>
                    <li>Right to delete personal information</li>
                    <li>Right to correct inaccurate personal information</li>
                    <li>Right to opt-out of sale/sharing of personal information (where applicable)</li>
                    <li>Right to limit use of sensitive personal information (where applicable)</li>
                    <li>Right to non-discrimination for exercising your rights</li>
                  </ul>
                  <p className="text-sm text-ivory/70 mt-3">
                    <strong>How to exercise these rights:</strong> You can submit a request via the contact method 
                    described in Section 13. We may need to verify your identity before fulfilling your request.
                  </p>
                  <p className="text-xs text-ivory/50 mt-2">
                    Note: We do not sell your personal information and we do not share it for cross-context behavioral advertising.
                  </p>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Other Jurisdictions:</p>
                  <p className="text-sm text-ivory/70">
                    If you are located in another jurisdiction with applicable data protection laws (such as Brazil's LGPD, 
                    UK GDPR, Canada's PIPEDA, or Australia's Privacy Act), you may have similar rights. 
                    Please contact us to exercise your rights.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9: Security */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Lock className="h-5 w-5" />
              9. Security Measures
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">We implement appropriate technical and organizational measures to protect your data:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Encryption in transit (TLS/SSL) and at rest</li>
                <li>Access controls and authentication</li>
                <li>Regular security assessments</li>
                <li>Employee training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
            </div>
          </section>

          {/* Section 10: Cookies */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              10. Cookies & Local Storage
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                We use technically necessary cookies and local storage mechanisms for:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>User authentication and session management</li>
                <li>Language and preference settings</li>
                <li>Security features</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                We do not use tracking cookies for advertising purposes. Analytics, if any, use anonymized data.
              </p>
              <p className="mt-2 text-sm text-ivory/60">
                We honor valid Global Privacy Control (GPC) signals where required by applicable law.
              </p>
            </div>
          </section>

          {/* Section 11: Children's Privacy */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <AlertTriangle className="h-5 w-5" />
              11. Children's Privacy
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Our services are not intended for individuals under the age of 18. We do not knowingly collect 
                personal information from children. If you believe a child has provided us with personal data, 
                please contact us and we will delete it promptly.
              </p>
            </div>
          </section>

          {/* Section 12: Changes */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              12. Changes to This Policy
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant changes 
                through the app or via email. The "Last updated" date at the top indicates when the policy was 
                last revised. Continued use of our services after changes constitutes acceptance of the updated policy.
              </p>
            </div>
          </section>

          {/* Section 13: Contact */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Download className="h-5 w-5" />
              13. Contact Us
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                To ask questions about this Privacy Policy or to exercise your data rights (including CCPA/CPRA requests), 
                contact us via the contact form on our <Link to="/impressum" className="text-gold hover:underline">Impressum page</Link>. 
                Please include the subject line: <strong>"Privacy Request"</strong>.
              </p>
              <p className="mt-3 text-sm text-ivory/60">
                EU residents may also contact their local data protection authority if they have concerns about our data practices.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link to="/" className="text-sm text-ivory/50 hover:text-gold transition-colors">← Back to Home</Link>
        </div>
      </main>

      <footer className="border-t border-gold/20 py-6">
        <div className="container text-center">
          <p className="text-sm text-ivory/40">© {new Date().getFullYear()} LEXORA</p>
        </div>
      </footer>
    </div>
  );
}
