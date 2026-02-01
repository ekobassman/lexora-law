import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Shield, FileText, Clock, Download, Lock, Globe, Database, Scale, Building, Users, Server, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRIVACY_VERSION, getLastUpdatedLabel } from '@/lib/legalVersions';
import { LocalizedPrivacyBanner } from '@/components/LocalizedPrivacyBanner';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * French localized Privacy Policy
 * Translation of the master English version
 */
export default function PrivacyFR() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-navy">
      <Helmet>
        <title>Politique de Confidentialité | Lexora</title>
        <meta name="description" content="Politique de Confidentialité de Lexora - Découvrez comment nous protégeons vos données. Conforme au RGPD." />
        <link rel="canonical" href="https://lexora-law.com/privacy" />
        <meta name="robots" content="noindex, follow" />
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
            <h1 className="font-display text-3xl font-medium text-ivory">Politique de Confidentialité</h1>
            <p className="text-sm text-ivory/50 mt-1">{getLastUpdatedLabel(PRIVACY_VERSION, 'fr')}</p>
            <p className="text-xs text-ivory/30 mt-0.5">Version : {PRIVACY_VERSION}</p>
          </div>
        </div>

        {/* Localized Banner */}
        <LocalizedPrivacyBanner languageName="French (Français)" />

        <div className="space-y-6">
          {/* Section 1: Responsable */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Building className="h-5 w-5" />
              1. Responsable du Traitement
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p>Le responsable du traitement de vos données personnelles est :</p>
              <div className="bg-navy/50 p-4 rounded-md border border-gold/10 mt-2">
                <p className="font-medium text-ivory">Roberto Imbimbo</p>
                <p className="text-ivory/70">Mörikestraße 10</p>
                <p className="text-ivory/70">72202 Nagold</p>
                <p className="text-ivory/70">Allemagne</p>
              </div>
            </div>
          </section>

          {/* Section 2: Finalité */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              2. Finalité du Traitement
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Nous traitons les données personnelles pour fournir les fonctionnalités suivantes :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Gestion de compte et authentification</li>
                <li>Téléchargement et stockage de documents</li>
                <li>OCR (Reconnaissance Optique de Caractères) pour l'extraction de texte</li>
                <li>Analyse de documents par IA et orientation juridique</li>
                <li>Génération de brouillons de réponse</li>
                <li>Suivi des délais et rappels</li>
                <li>Support client et sécurité</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Catégories de Données */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              3. Catégories de Données Personnelles
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <div>
                <p className="font-medium text-ivory mb-1">Données de Compte :</p>
                <p className="ml-4">Adresse email, ID utilisateur, événements d'authentification, statut d'abonnement</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Données d'Utilisation :</p>
                <p className="ml-4">Journaux techniques, rapports d'erreurs, horodatages, informations sur l'appareil, adresse IP (anonymisée)</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Données de Documents :</p>
                <p className="ml-4">Documents et scans téléchargés, texte extrait (OCR), métadonnées de documents, interactions chat IA</p>
              </div>
              <div>
                <p className="font-medium text-ivory mb-1">Données de Paiement :</p>
                <p className="ml-4">Informations d'abonnement (traitées par Stripe), historique de facturation</p>
              </div>
            </div>
          </section>

          {/* Section 3.1: CCPA Notice at Collection */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              3.1 Avis CCPA sur la Collecte (Résidents de Californie)
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Au moment ou avant la collecte, nous informons les résidents de Californie que nous collectons des informations 
                personnelles aux fins décrites dans cette Politique de Confidentialité, y compris la fourniture de nos services, 
                la sécurité, la conformité légale et l'amélioration du service. Nous ne vendons pas d'informations personnelles et 
                nous ne les partageons pas pour la publicité comportementale inter-contexte. Les périodes de conservation des données 
                sont décrites dans la Section 7.
              </p>
            </div>
          </section>

          {/* Section 4: Base Juridique */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Scale className="h-5 w-5" />
              4. Base Juridique du Traitement
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Nous traitons vos données sur les bases juridiques suivantes :</p>
              <div className="space-y-2 mt-2">
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Exécution du Contrat (Art. 6(1)(b) RGPD)</p>
                  <p className="text-sm text-ivory/60">Traitement nécessaire pour fournir les services demandés</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Intérêt Légitime (Art. 6(1)(f) RGPD)</p>
                  <p className="text-sm text-ivory/60">Mesures de sécurité, analyse des erreurs, amélioration du service</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Consentement (Art. 6(1)(a) RGPD)</p>
                  <p className="text-sm text-ivory/60">Lorsque spécifiquement requis pour des fonctionnalités optionnelles ou le marketing</p>
                </div>
                <div className="bg-navy/50 p-3 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory">Obligation Légale (Art. 6(1)(c) RGPD)</p>
                  <p className="text-sm text-ivory/60">Conformité aux lois et réglementations applicables</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ivory/70">
                Pour les utilisateurs en dehors de l'UE/EEE, nous traitons les données personnelles conformément aux lois locales sur la vie privée applicables.
              </p>
            </div>
          </section>

          {/* Section 5: Destinataires */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Server className="h-5 w-5" />
              5. Destinataires des Données et Sous-traitants
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-3">
              <p>Nous pouvons partager vos données avec les catégories suivantes de destinataires :</p>
              <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                <li><strong>Infrastructure Cloud :</strong> Serveurs sécurisés pour l'hébergement et les services de base de données</li>
                <li><strong>Services IA :</strong> Pour l'analyse de documents et le traitement de texte (minimisation des données appliquée)</li>
                <li><strong>Processeurs de Paiement :</strong> Stripe pour la gestion des abonnements</li>
                <li><strong>Services Email :</strong> Pour les emails transactionnels et les notifications</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                Tous les sous-traitants sont liés par des accords de traitement des données et sont tenus de maintenir des mesures de sécurité appropriées.
              </p>
            </div>
          </section>

          {/* Section 6: Transferts Internationaux */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Globe className="h-5 w-5" />
              6. Transferts Internationaux de Données
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Vos données peuvent être transférées et traitées dans des pays en dehors de votre pays de résidence. 
                Lors de transferts internationaux, nous assurons les garanties appropriées :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Clauses Contractuelles Types UE (CCT)</li>
                <li>Décisions d'adéquation de la Commission Européenne</li>
                <li>EU-U.S. Data Privacy Framework (le cas échéant)</li>
                <li>Règles d'Entreprise Contraignantes (BCR) de nos fournisseurs</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Conservation */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Clock className="h-5 w-5" />
              7. Conservation des Données
            </h2>
            <div className="text-ivory/80 leading-relaxed space-y-2">
              <p><strong>Données de Compte :</strong> Conservées tant que votre compte est actif</p>
              <p><strong>Documents et Brouillons :</strong> Jusqu'à leur suppression ou fermeture du compte</p>
              <p><strong>Journaux Techniques :</strong> 30-90 jours pour la sécurité et le débogage</p>
              <p><strong>Registres de Paiement :</strong> Selon les lois fiscales et comptables (typiquement 7-10 ans)</p>
              <p className="mt-3 text-sm text-ivory/60">
                À la suppression du compte, nous supprimerons ou anonymiserons vos données personnelles dans les 30 jours, sauf si la conservation est requise par la loi.
              </p>
            </div>
          </section>

          {/* Section 8: Vos Droits */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Users className="h-5 w-5" />
              8. Vos Droits
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Selon votre localisation, vous disposez des droits suivants concernant vos données personnelles :</p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <p className="font-medium text-ivory mb-2">Pour Tous les Utilisateurs :</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li><strong>Accès :</strong> Demander une copie de vos données personnelles</li>
                    <li><strong>Rectification :</strong> Corriger des données inexactes</li>
                    <li><strong>Effacement :</strong> Demander la suppression de vos données</li>
                    <li><strong>Portabilité :</strong> Recevoir vos données dans un format lisible par machine</li>
                    <li><strong>Opposition :</strong> S'opposer à certaines activités de traitement</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Résidents UE/EEE (RGPD) :</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Droit à la limitation du traitement</li>
                    <li>Droit de retirer son consentement à tout moment</li>
                    <li>Droit de déposer une plainte auprès d'une autorité de contrôle</li>
                  </ul>
                </div>

                <div className="bg-navy/50 p-4 rounded-md border border-gold/10">
                  <p className="font-medium text-ivory mb-2">Résidents de Californie (CCPA/CPRA) :</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-ivory/70">
                    <li>Droit de savoir quelles informations personnelles sont collectées</li>
                    <li>Droit d'accéder à des informations personnelles spécifiques</li>
                    <li>Droit de supprimer les informations personnelles</li>
                    <li>Droit de corriger les informations personnelles inexactes</li>
                    <li>Droit de refuser la vente/le partage d'informations personnelles (le cas échéant)</li>
                    <li>Droit de limiter l'utilisation d'informations personnelles sensibles (le cas échéant)</li>
                    <li>Droit à la non-discrimination pour l'exercice de vos droits</li>
                  </ul>
                  <p className="text-sm text-ivory/70 mt-3">
                    <strong>Comment exercer ces droits :</strong> Vous pouvez soumettre une demande via la méthode de contact décrite dans la Section 13. 
                    Nous pouvons avoir besoin de vérifier votre identité avant de répondre à votre demande.
                  </p>
                  <p className="text-xs text-ivory/50 mt-2">
                    Note : Nous ne vendons pas vos informations personnelles et nous ne les partageons pas pour la publicité comportementale inter-contexte.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 9: Sécurité */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Lock className="h-5 w-5" />
              9. Mesures de Sécurité
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Chiffrement en transit (TLS/SSL) et au repos</li>
                <li>Contrôles d'accès et authentification</li>
                <li>Évaluations de sécurité régulières</li>
                <li>Formation du personnel à la protection des données</li>
                <li>Procédures de réponse aux incidents</li>
              </ul>
            </div>
          </section>

          {/* Section 10: Cookies */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Database className="h-5 w-5" />
              10. Cookies et Stockage Local
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Nous utilisons des cookies techniquement nécessaires et des mécanismes de stockage local pour :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Authentification utilisateur et gestion de session</li>
                <li>Paramètres de langue et préférences</li>
                <li>Fonctionnalités de sécurité</li>
              </ul>
              <p className="mt-3 text-sm text-ivory/60">
                Nous n'utilisons pas de cookies de suivi à des fins publicitaires. Les analyses, le cas échéant, utilisent des données anonymisées.
              </p>
              <p className="mt-2 text-sm text-ivory/60">
                Nous honorons les signaux Global Privacy Control (GPC) valides lorsque requis par la loi applicable.
              </p>
            </div>
          </section>

          {/* Section 11: Mineurs */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <AlertTriangle className="h-5 w-5" />
              11. Protection des Mineurs
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Nos services ne sont pas destinés aux personnes de moins de 18 ans. Nous ne collectons pas sciemment 
                d'informations personnelles de mineurs. Si vous pensez qu'un mineur nous a fourni des données personnelles, 
                veuillez nous contacter et nous les supprimerons rapidement.
              </p>
            </div>
          </section>

          {/* Section 12: Modifications */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <FileText className="h-5 w-5" />
              12. Modifications de cette Politique
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p>
                Nous pouvons mettre à jour cette Politique de Confidentialité de temps en temps. Nous vous informerons des modifications 
                significatives via l'application ou par email. La date « Dernière mise à jour » en haut indique quand la politique a été 
                révisée pour la dernière fois. L'utilisation continue de nos services après les modifications constitue l'acceptation de la politique mise à jour.
              </p>
            </div>
          </section>

          {/* Section 13: Contact */}
          <section className="rounded-lg border border-gold/20 bg-ivory/5 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gold">
              <Download className="h-5 w-5" />
              13. Nous Contacter
            </h2>
            <div className="text-ivory/80 leading-relaxed">
              <p className="mb-3">
                Pour poser des questions sur cette Politique de Confidentialité ou pour exercer vos droits sur vos données (y compris les demandes CCPA/CPRA), 
                contactez-nous via le formulaire de contact sur notre <Link to="/impressum" className="text-gold hover:underline">page Impressum</Link>. 
                Veuillez inclure l'objet : <strong>« Demande de Confidentialité »</strong>.
              </p>
              <p className="mt-3 text-sm text-ivory/60">
                Les résidents de l'UE peuvent également contacter leur autorité locale de protection des données s'ils ont des préoccupations concernant nos pratiques.
              </p>
            </div>
          </section>
        </div>

        {/* Master version link */}
        <div className="mt-8 p-4 rounded-lg border border-gold/20 bg-ivory/5 text-center">
          <p className="text-sm text-ivory/60">
            <Link to="/privacy" className="text-gold hover:underline">
              Voir la version anglaise (juridiquement contraignante) →
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-ivory/50 hover:text-gold transition-colors">← Retour à l'accueil</Link>
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
