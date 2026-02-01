import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, FileText, AlertTriangle, Scale, Shield, Users, Upload, Clock, Gavel, Mail, Bot, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LegalPageLanguageSwitch } from '@/components/LegalPageLanguageSwitch';
import { TERMS_VERSION, getLastUpdatedLabel } from '@/lib/legalVersions';

export default function TermsOfService() {
  const { t, language, isRTL } = useLanguage();

  // Full terms content by language
  const content: Record<string, { title: string; lastUpdated: string; sections: { icon: string; title: string; content: string; isWarning?: boolean }[] }> = {
    de: {
      title: 'Nutzungsbedingungen',
      lastUpdated: 'Zuletzt aktualisiert: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Geltungsbereich', content: 'Diese Nutzungsbedingungen gelten für die Nutzung der Web-App „Lexora" (nachfolgend „Dienst").' },
        { icon: 'alert', title: '2. Kein Ersatz für Rechtsberatung', content: 'Lexora erstellt automatisierte Entwürfe und Zusammenfassungen. Die Inhalte sind allgemeine Informationen und stellen keine Rechtsberatung dar. Für rechtlich verbindliche Einschätzungen wenden Sie sich an eine qualifizierte Rechtsberatung.', isWarning: true },
        { icon: 'bot', title: '3. KI-Hinweis und Nutzungsbeschränkungen', content: '⚠️ WICHTIGER HINWEIS ZUR NUTZUNG VON KÜNSTLICHER INTELLIGENZ\n\n• Lexora bietet eine automatisierte Unterstützung auf Basis von Künstlicher Intelligenz (KI).\n• Die von der KI generierten Antworten, Analysen und Entwürfe können unvollständig, ungenau oder fehlerhaft sein.\n• Lexora ersetzt KEINE professionelle Rechtsberatung oder anwaltliche Vertretung.\n• Der Nutzer ist verpflichtet, alle von der KI erstellten Inhalte vor dem Absenden oder Verwenden sorgfältig zu lesen, zu prüfen und gegebenenfalls zu korrigieren.\n• Der Nutzer trägt die alleinige Verantwortung für die endgültige Verwendung der generierten Inhalte (Versand, Entscheidungen, Fristen).\n• Lexora haftet nicht für Schäden, die durch die ungeprüfte Übernahme von KI-generierten Inhalten entstehen.\n• Bei Zweifeln oder in komplexen Fällen wenden Sie sich bitte an einen qualifizierten Rechtsanwalt oder die zuständige Behörde.', isWarning: true },
        { icon: 'users', title: '4. Nutzerkonto', content: 'Für bestimmte Funktionen ist ein Konto erforderlich. Sie sind verantwortlich für die Vertraulichkeit Ihrer Zugangsdaten und Aktivitäten in Ihrem Konto.' },
        { icon: 'upload', title: '5. Hochgeladene Dokumente & Inhalte', content: 'Sie behalten alle Rechte an Ihren Inhalten.\n\nSie versichern, dass Sie berechtigt sind, die Inhalte hochzuladen.\n\nSie dürfen keine Inhalte hochladen, die Rechte Dritter verletzen oder rechtswidrig sind.' },
        { icon: 'file', title: '6. Verarbeitung zur Leistungserbringung', content: 'Der Dienst verarbeitet Ihre Dokumente, um OCR (Texterkennung), Analyse und Entwurfserstellung zu ermöglichen. Details siehe Datenschutzerklärung.' },
        { icon: 'clock', title: '7. Verfügbarkeit', content: 'Wir bemühen uns um hohe Verfügbarkeit, können jedoch keine unterbrechungsfreie Verfügbarkeit garantieren (Wartung, technische Störungen, höhere Gewalt).' },
        { icon: 'shield', title: '8. Haftung', content: 'Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten und beschränkt auf den vorhersehbaren, typischen Schaden.\n\nDie Haftung für Vorsatz, grobe Fahrlässigkeit, Verletzung von Leben/Körper/Gesundheit sowie nach zwingenden gesetzlichen Vorschriften bleibt unberührt.' },
        { icon: 'file', title: '9. Änderungen', content: 'Wir können diese Bedingungen aktualisieren. Wesentliche Änderungen werden innerhalb der App angekündigt.' },
        { icon: 'gavel', title: '10. Anwendbares Recht', content: 'Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften Ihres Aufenthaltsstaates bleiben unberührt.' },
        { icon: 'globe', title: '11. Territoriale Beschränkungen', content: 'Lexora ist in Gerichtsbarkeiten nicht verfügbar, in denen die Nutzung von Systemen der Künstlichen Intelligenz oder die Verarbeitung personenbezogener Daten strengen gesetzlichen Beschränkungen unterliegt. Insbesondere ist der Dienst in der Russischen Föderation und im chinesischen Festland (Mainland China) nicht verfügbar. Nutzer, die von diesen Territorien aus zugreifen, sind nicht berechtigt, Lexora zu nutzen.', isWarning: true },
        { icon: 'mail', title: 'Kontakt', content: 'Nutzen Sie das Kontaktformular auf der Impressum-Seite.' }
      ]
    },
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last updated: 2025-12-27',
      sections: [
        { icon: 'scale', title: '1. Scope', content: 'These terms of service apply to the use of the web app "Lexora" (hereinafter "Service").' },
        { icon: 'alert', title: '2. No Substitute for Legal Advice', content: 'Lexora creates automated drafts and summaries. The content is general information and does not constitute legal advice. For legally binding assessments, consult qualified legal counsel.', isWarning: true },
        { icon: 'bot', title: '3. AI Disclaimer and Usage Limitations', content: '⚠️ IMPORTANT NOTICE REGARDING ARTIFICIAL INTELLIGENCE\n\n• Lexora provides automated assistance based on Artificial Intelligence (AI).\n• AI-generated responses, analyses, and drafts may be incomplete, inaccurate, or contain errors.\n• Lexora does NOT replace professional legal advice or legal representation.\n• The user is obligated to carefully read, review, and correct all AI-generated content before sending or using it.\n• The user bears sole responsibility for the final use of generated content (sending, decisions, deadlines).\n• Lexora is not liable for damages arising from the unchecked adoption of AI-generated content.\n• In case of doubt or complex cases, please consult a qualified lawyer or the competent authority.', isWarning: true },
        { icon: 'users', title: '4. User Account', content: 'An account is required for certain functions. You are responsible for the confidentiality of your credentials and activities in your account.' },
        { icon: 'upload', title: '5. Uploaded Documents & Content', content: 'You retain all rights to your content.\n\nYou warrant that you are authorized to upload the content.\n\nYou may not upload content that violates third-party rights or is unlawful.' },
        { icon: 'file', title: '6. Processing for Service Provision', content: 'The service processes your documents to enable OCR (text recognition), analysis, and draft creation. See Privacy Policy for details.' },
        { icon: 'clock', title: '7. Availability', content: 'We strive for high availability but cannot guarantee uninterrupted availability (maintenance, technical issues, force majeure).' },
        { icon: 'shield', title: '8. Liability', content: 'In cases of simple negligence, we are only liable for breach of essential contractual obligations and limited to foreseeable, typical damages.\n\nLiability for intent, gross negligence, injury to life/body/health, and under mandatory statutory provisions remains unaffected.' },
        { icon: 'file', title: '9. Changes', content: 'We may update these terms. Significant changes will be announced within the app.' },
        { icon: 'gavel', title: '10. Applicable Law', content: 'German law applies. Mandatory consumer protection provisions of your country of residence remain unaffected.' },
        { icon: 'globe', title: '11. Territorial Restrictions', content: 'Lexora is not available in jurisdictions where the use of artificial intelligence systems or the processing of personal data is subject to strict legal restrictions. In particular, the service is not available in the Russian Federation and Mainland China. Users accessing from these territories are not authorized to use Lexora.', isWarning: true },
        { icon: 'mail', title: 'Contact', content: 'Use the contact form on the Impressum page.' }
      ]
    },
    it: {
      title: 'Termini di Servizio',
      lastUpdated: 'Ultimo aggiornamento: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Ambito di Applicazione', content: 'Questi termini di servizio si applicano all\'utilizzo della web app "Lexora" (di seguito "Servizio").' },
        { icon: 'alert', title: '2. Nessuna Sostituzione della Consulenza Legale', content: 'Lexora crea bozze e riassunti automatizzati. I contenuti sono informazioni generali e non costituiscono consulenza legale. Per valutazioni legalmente vincolanti, consultare un consulente legale qualificato.', isWarning: true },
        { icon: 'bot', title: '3. Avviso sull\'Intelligenza Artificiale e Limitazioni d\'Uso', content: '⚠️ AVVISO IMPORTANTE SULL\'USO DELL\'INTELLIGENZA ARTIFICIALE\n\n• Lexora fornisce assistenza automatizzata basata sull\'Intelligenza Artificiale (IA).\n• Le risposte, le analisi e le bozze generate dall\'IA possono essere incomplete, imprecise o contenere errori.\n• Lexora NON sostituisce la consulenza legale professionale o la rappresentanza legale.\n• L\'utente è obbligato a leggere attentamente, verificare e correggere tutti i contenuti generati dall\'IA prima di inviarli o utilizzarli.\n• L\'utente è l\'unico responsabile dell\'uso finale dei contenuti generati (invio, decisioni, scadenze).\n• Lexora non è responsabile per danni derivanti dall\'adozione non verificata di contenuti generati dall\'IA.\n• In caso di dubbi o situazioni complesse, consultare un avvocato qualificato o l\'autorità competente.', isWarning: true },
        { icon: 'users', title: '4. Account Utente', content: 'Per alcune funzioni è richiesto un account. Sei responsabile della riservatezza delle tue credenziali e delle attività nel tuo account.' },
        { icon: 'upload', title: '5. Documenti e Contenuti Caricati', content: 'Mantieni tutti i diritti sui tuoi contenuti.\n\nGarantisci di essere autorizzato a caricare i contenuti.\n\nNon puoi caricare contenuti che violano diritti di terzi o sono illegali.' },
        { icon: 'file', title: '6. Elaborazione per l\'Erogazione del Servizio', content: 'Il servizio elabora i tuoi documenti per abilitare OCR (riconoscimento testo), analisi e creazione bozze. Vedi Privacy Policy per i dettagli.' },
        { icon: 'clock', title: '7. Disponibilità', content: 'Ci impegniamo per un\'alta disponibilità ma non possiamo garantire disponibilità ininterrotta (manutenzione, problemi tecnici, forza maggiore).' },
        { icon: 'shield', title: '8. Responsabilità', content: 'In caso di negligenza semplice, siamo responsabili solo per violazione di obblighi contrattuali essenziali e limitatamente ai danni prevedibili e tipici.\n\nLa responsabilità per dolo, negligenza grave, lesioni alla vita/corpo/salute e secondo disposizioni di legge imperative rimane inalterata.' },
        { icon: 'file', title: '9. Modifiche', content: 'Possiamo aggiornare questi termini. Le modifiche significative saranno annunciate all\'interno dell\'app.' },
        { icon: 'gavel', title: '10. Legge Applicabile', content: 'Si applica la legge tedesca. Le disposizioni imperative sulla protezione dei consumatori del tuo paese di residenza rimangono impregiudicate.' },
        { icon: 'globe', title: '11. Limitazioni Territoriali', content: 'Lexora non è disponibile in giurisdizioni in cui l\'uso di sistemi di intelligenza artificiale o il trattamento dei dati personali è soggetto a restrizioni legali severe. In particolare, il servizio non è disponibile nella Federazione Russa e nella Cina continentale (Mainland China). Gli utenti che accedono da tali territori non sono autorizzati a utilizzare Lexora.', isWarning: true },
        { icon: 'mail', title: 'Contatto', content: 'Usa il modulo di contatto nella pagina Impressum.' }
      ]
    },
    fr: {
      title: 'Conditions d\'Utilisation',
      lastUpdated: 'Dernière mise à jour : 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Champ d\'Application', content: 'Ces conditions d\'utilisation s\'appliquent à l\'utilisation de l\'application web "Lexora" (ci-après "Service").' },
        { icon: 'alert', title: '2. Ne Remplace Pas un Conseil Juridique', content: 'Lexora crée des brouillons et résumés automatisés. Le contenu est une information générale et ne constitue pas un conseil juridique. Pour des évaluations juridiquement contraignantes, consultez un conseiller juridique qualifié.', isWarning: true },
        { icon: 'bot', title: '3. Avertissement IA et Limitations d\'Utilisation', content: '⚠️ AVIS IMPORTANT CONCERNANT L\'INTELLIGENCE ARTIFICIELLE\n\n• Lexora fournit une assistance automatisée basée sur l\'Intelligence Artificielle (IA).\n• Les réponses, analyses et brouillons générés par l\'IA peuvent être incomplets, inexacts ou contenir des erreurs.\n• Lexora NE remplace PAS les conseils juridiques professionnels ou la représentation juridique.\n• L\'utilisateur est obligé de lire attentivement, vérifier et corriger tout contenu généré par l\'IA avant de l\'envoyer ou de l\'utiliser.\n• L\'utilisateur assume l\'entière responsabilité de l\'utilisation finale du contenu généré (envoi, décisions, délais).\n• Lexora n\'est pas responsable des dommages résultant de l\'adoption non vérifiée de contenu généré par l\'IA.\n• En cas de doute ou de cas complexes, veuillez consulter un avocat qualifié ou l\'autorité compétente.', isWarning: true },
        { icon: 'users', title: '4. Compte Utilisateur', content: 'Un compte est requis pour certaines fonctions. Vous êtes responsable de la confidentialité de vos identifiants et des activités de votre compte.' },
        { icon: 'upload', title: '5. Documents et Contenus Téléchargés', content: 'Vous conservez tous les droits sur votre contenu.\n\nVous garantissez être autorisé à télécharger le contenu.\n\nVous ne pouvez pas télécharger de contenu violant les droits de tiers ou illégal.' },
        { icon: 'file', title: '6. Traitement pour la Fourniture du Service', content: 'Le service traite vos documents pour permettre l\'OCR (reconnaissance de texte), l\'analyse et la création de brouillons. Voir la Politique de Confidentialité pour plus de détails.' },
        { icon: 'clock', title: '7. Disponibilité', content: 'Nous nous efforçons d\'assurer une haute disponibilité mais ne pouvons garantir une disponibilité ininterrompue (maintenance, problèmes techniques, force majeure).' },
        { icon: 'shield', title: '8. Responsabilité', content: 'En cas de négligence simple, nous ne sommes responsables que de la violation d\'obligations contractuelles essentielles et limités aux dommages prévisibles et typiques.\n\nLa responsabilité pour intention, négligence grave, atteinte à la vie/corps/santé et selon les dispositions légales impératives reste inchangée.' },
        { icon: 'file', title: '9. Modifications', content: 'Nous pouvons mettre à jour ces conditions. Les modifications significatives seront annoncées dans l\'application.' },
        { icon: 'gavel', title: '10. Droit Applicable', content: 'Le droit allemand s\'applique. Les dispositions impératives de protection des consommateurs de votre pays de résidence restent inchangées.' },
        { icon: 'globe', title: '11. Restrictions Territoriales', content: 'Lexora n\'est pas disponible dans les juridictions où l\'utilisation de systèmes d\'intelligence artificielle ou le traitement des données personnelles est soumis à des restrictions légales strictes. En particulier, le service n\'est pas disponible dans la Fédération de Russie et en Chine continentale (Mainland China). Les utilisateurs accédant depuis ces territoires ne sont pas autorisés à utiliser Lexora.', isWarning: true },
        { icon: 'mail', title: 'Contact', content: 'Utilisez le formulaire de contact sur la page Impressum.' }
      ]
    },
    es: {
      title: 'Términos de Servicio',
      lastUpdated: 'Última actualización: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Ámbito de Aplicación', content: 'Estos términos de servicio se aplican al uso de la aplicación web "Lexora" (en adelante "Servicio").' },
        { icon: 'alert', title: '2. No Sustituye el Asesoramiento Legal', content: 'Lexora crea borradores y resúmenes automatizados. El contenido es información general y no constituye asesoramiento legal. Para evaluaciones legalmente vinculantes, consulte a un asesor legal calificado.', isWarning: true },
        { icon: 'bot', title: '3. Aviso sobre IA y Limitaciones de Uso', content: '⚠️ AVISO IMPORTANTE SOBRE INTELIGENCIA ARTIFICIAL\n\n• Lexora proporciona asistencia automatizada basada en Inteligencia Artificial (IA).\n• Las respuestas, análisis y borradores generados por IA pueden estar incompletos, ser inexactos o contener errores.\n• Lexora NO sustituye el asesoramiento legal profesional o la representación legal.\n• El usuario está obligado a leer cuidadosamente, verificar y corregir todo el contenido generado por IA antes de enviarlo o utilizarlo.\n• El usuario asume la responsabilidad exclusiva del uso final del contenido generado (envío, decisiones, plazos).\n• Lexora no es responsable por daños derivados de la adopción no verificada de contenido generado por IA.\n• En caso de duda o casos complejos, consulte a un abogado calificado o a la autoridad competente.', isWarning: true },
        { icon: 'users', title: '4. Cuenta de Usuario', content: 'Se requiere una cuenta para ciertas funciones. Usted es responsable de la confidencialidad de sus credenciales y las actividades en su cuenta.' },
        { icon: 'upload', title: '5. Documentos y Contenidos Cargados', content: 'Conserva todos los derechos sobre su contenido.\n\nGarantiza estar autorizado para cargar el contenido.\n\nNo puede cargar contenido que viole derechos de terceros o sea ilegal.' },
        { icon: 'file', title: '6. Procesamiento para la Prestación del Servicio', content: 'El servicio procesa sus documentos para habilitar OCR (reconocimiento de texto), análisis y creación de borradores. Consulte la Política de Privacidad para más detalles.' },
        { icon: 'clock', title: '7. Disponibilidad', content: 'Nos esforzamos por una alta disponibilidad pero no podemos garantizar disponibilidad ininterrumpida (mantenimiento, problemas técnicos, fuerza mayor).' },
        { icon: 'shield', title: '8. Responsabilidad', content: 'En caso de negligencia simple, solo somos responsables por incumplimiento de obligaciones contractuales esenciales y limitados a daños previsibles y típicos.\n\nLa responsabilidad por intención, negligencia grave, lesión a la vida/cuerpo/salud y según disposiciones legales imperativas permanece inalterada.' },
        { icon: 'file', title: '9. Cambios', content: 'Podemos actualizar estos términos. Los cambios significativos se anunciarán dentro de la aplicación.' },
        { icon: 'gavel', title: '10. Ley Aplicable', content: 'Se aplica la ley alemana. Las disposiciones imperativas de protección al consumidor de su país de residencia permanecen inalteradas.' },
        { icon: 'globe', title: '11. Restricciones Territoriales', content: 'Lexora no está disponible en jurisdicciones donde el uso de sistemas de inteligencia artificial o el procesamiento de datos personales está sujeto a restricciones legales estrictas. En particular, el servicio no está disponible en la Federación Rusa y en China continental (Mainland China). Los usuarios que accedan desde estos territorios no están autorizados a usar Lexora.', isWarning: true },
        { icon: 'mail', title: 'Contacto', content: 'Use el formulario de contacto en la página Impressum.' }
      ]
    },
    tr: {
      title: 'Kullanım Koşulları',
      lastUpdated: 'Son güncelleme: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Kapsam', content: 'Bu kullanım koşulları "Lexora" web uygulamasının (bundan sonra "Hizmet") kullanımı için geçerlidir.' },
        { icon: 'alert', title: '2. Hukuki Danışmanlığın Yerini Tutmaz', content: 'Lexora otomatik taslaklar ve özetler oluşturur. İçerik genel bilgidir ve hukuki danışmanlık teşkil etmez. Hukuken bağlayıcı değerlendirmeler için nitelikli hukuk danışmanına başvurun.', isWarning: true },
        { icon: 'bot', title: '3. Yapay Zeka Uyarısı ve Kullanım Sınırlamaları', content: '⚠️ YAPAY ZEKA HAKKINDA ÖNEMLİ BİLGİLENDİRME\n\n• Lexora, Yapay Zeka (YZ) tabanlı otomatik yardım sağlar.\n• YZ tarafından oluşturulan yanıtlar, analizler ve taslaklar eksik, yanlış veya hatalı olabilir.\n• Lexora profesyonel hukuki danışmanlık veya hukuki temsilin yerini ALMAZ.\n• Kullanıcı, göndermeden veya kullanmadan önce tüm YZ tarafından oluşturulan içeriği dikkatlice okumak, gözden geçirmek ve düzeltmekle yükümlüdür.\n• Kullanıcı, oluşturulan içeriğin nihai kullanımından (gönderme, kararlar, son tarihler) tek başına sorumludur.\n• Lexora, YZ tarafından oluşturulan içeriğin doğrulanmadan benimsenmesinden kaynaklanan zararlardan sorumlu değildir.\n• Şüphe durumunda veya karmaşık durumlarda lütfen nitelikli bir avukata veya yetkili makama başvurun.', isWarning: true },
        { icon: 'users', title: '4. Kullanıcı Hesabı', content: 'Belirli işlevler için hesap gereklidir. Kimlik bilgilerinizin gizliliğinden ve hesabınızdaki faaliyetlerden siz sorumlusunuz.' },
        { icon: 'upload', title: '5. Yüklenen Belgeler ve İçerik', content: 'İçeriğiniz üzerindeki tüm hakları saklı tutarsınız.\n\nİçeriği yüklemeye yetkili olduğunuzu garanti edersiniz.\n\nÜçüncü taraf haklarını ihlal eden veya yasadışı içerik yükleyemezsiniz.' },
        { icon: 'file', title: '6. Hizmet Sağlama için İşleme', content: 'Hizmet, OCR (metin tanıma), analiz ve taslak oluşturmayı etkinleştirmek için belgelerinizi işler. Ayrıntılar için Gizlilik Politikasına bakın.' },
        { icon: 'clock', title: '7. Erişilebilirlik', content: 'Yüksek erişilebilirlik için çabalıyoruz ancak kesintisiz erişilebilirliği garanti edemeyiz (bakım, teknik sorunlar, mücbir sebepler).' },
        { icon: 'shield', title: '8. Sorumluluk', content: 'Basit ihmal durumlarında, yalnızca temel sözleşme yükümlülüklerinin ihlalinden ve öngörülebilir, tipik zararlarla sınırlı olarak sorumluyuz.\n\nKasıt, ağır ihmal, yaşam/vücut/sağlığa zarar ve zorunlu yasal hükümler kapsamındaki sorumluluk etkilenmez.' },
        { icon: 'file', title: '9. Değişiklikler', content: 'Bu koşulları güncelleyebiliriz. Önemli değişiklikler uygulama içinde duyurulacaktır.' },
        { icon: 'gavel', title: '10. Uygulanacak Hukuk', content: 'Alman hukuku uygulanır. İkamet ettiğiniz ülkenin zorunlu tüketici koruma hükümleri etkilenmez.' },
        { icon: 'globe', title: '11. Bölgesel Kısıtlamalar', content: 'Lexora, yapay zeka sistemlerinin kullanımının veya kişisel verilerin işlenmesinin sıkı yasal kısıtlamalara tabi olduğu yargı alanlarında mevcut değildir. Özellikle, hizmet Rusya Federasyonu ve Çin anakarasında (Mainland China) mevcut değildir. Bu bölgelerden erişen kullanıcılar Lexora\'yı kullanmaya yetkili değildir.', isWarning: true },
        { icon: 'mail', title: 'İletişim', content: 'Impressum sayfasındaki iletişim formunu kullanın.' }
      ]
    },
    ro: {
      title: 'Termeni și Condiții',
      lastUpdated: 'Ultima actualizare: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Domeniu de Aplicare', content: 'Acești termeni și condiții se aplică utilizării aplicației web "Lexora" (denumită în continuare "Serviciul").' },
        { icon: 'alert', title: '2. Nu Înlocuiește Consultanța Juridică', content: 'Lexora creează proiecte și rezumate automatizate. Conținutul reprezintă informații generale și nu constituie consultanță juridică. Pentru evaluări obligatorii din punct de vedere juridic, consultați un consilier juridic calificat.', isWarning: true },
        { icon: 'bot', title: '3. Avertisment IA și Limitări de Utilizare', content: '⚠️ NOTIFICARE IMPORTANTĂ PRIVIND INTELIGENȚA ARTIFICIALĂ\n\n• Lexora oferă asistență automatizată bazată pe Inteligență Artificială (IA).\n• Răspunsurile, analizele și proiectele generate de IA pot fi incomplete, inexacte sau pot conține erori.\n• Lexora NU înlocuiește consultanța juridică profesională sau reprezentarea juridică.\n• Utilizatorul este obligat să citească cu atenție, să verifice și să corecteze tot conținutul generat de IA înainte de a-l trimite sau utiliza.\n• Utilizatorul poartă responsabilitatea exclusivă pentru utilizarea finală a conținutului generat (trimitere, decizii, termene).\n• Lexora nu este răspunzătoare pentru daunele rezultate din adoptarea neverificată a conținutului generat de IA.\n• În caz de îndoială sau cazuri complexe, vă rugăm să consultați un avocat calificat sau autoritatea competentă.', isWarning: true },
        { icon: 'users', title: '4. Cont de Utilizator', content: 'Pentru anumite funcții este necesar un cont. Sunteți responsabil pentru confidențialitatea acreditărilor și activităților din contul dumneavoastră.' },
        { icon: 'upload', title: '5. Documente și Conținut Încărcat', content: 'Păstrați toate drepturile asupra conținutului dumneavoastră.\n\nGarantați că sunteți autorizat să încărcați conținutul.\n\nNu puteți încărca conținut care încalcă drepturile terților sau este ilegal.' },
        { icon: 'file', title: '6. Procesare pentru Furnizarea Serviciului', content: 'Serviciul procesează documentele dumneavoastră pentru a activa OCR (recunoașterea textului), analiza și crearea proiectelor. Consultați Politica de Confidențialitate pentru detalii.' },
        { icon: 'clock', title: '7. Disponibilitate', content: 'Ne străduim pentru o disponibilitate ridicată, dar nu putem garanta disponibilitate neîntreruptă (întreținere, probleme tehnice, forță majoră).' },
        { icon: 'shield', title: '8. Responsabilitate', content: 'În cazuri de neglijență simplă, suntem răspunzători doar pentru încălcarea obligațiilor contractuale esențiale și limitat la daune previzibile și tipice.\n\nRăspunderea pentru intenție, neglijență gravă, vătămare a vieții/corpului/sănătății și conform prevederilor legale obligatorii rămâne neafectată.' },
        { icon: 'file', title: '9. Modificări', content: 'Putem actualiza acești termeni. Modificările semnificative vor fi anunțate în aplicație.' },
        { icon: 'gavel', title: '10. Legea Aplicabilă', content: 'Se aplică legea germană. Prevederile obligatorii de protecție a consumatorilor din țara dumneavoastră de reședință rămân neafectate.' },
        { icon: 'globe', title: '11. Restricții Teritoriale', content: 'Lexora nu este disponibilă în jurisdicțiile în care utilizarea sistemelor de inteligență artificială sau prelucrarea datelor personale este supusă unor restricții legale stricte. În special, serviciul nu este disponibil în Federația Rusă și în China continentală (Mainland China). Utilizatorii care accesează din aceste teritorii nu sunt autorizați să utilizeze Lexora.', isWarning: true },
        { icon: 'mail', title: 'Contact', content: 'Folosiți formularul de contact de pe pagina Impressum.' }
      ]
    },
    pl: {
      title: 'Warunki Korzystania z Usługi',
      lastUpdated: 'Ostatnia aktualizacja: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Zakres Stosowania', content: 'Niniejsze warunki korzystania z usługi dotyczą korzystania z aplikacji webowej "Lexora" (dalej "Usługa").' },
        { icon: 'alert', title: '2. Nie Zastępuje Porady Prawnej', content: 'Lexora tworzy automatyczne projekty i podsumowania. Treść stanowi informacje ogólne i nie stanowi porady prawnej. W celu uzyskania prawnie wiążących ocen skonsultuj się z wykwalifikowanym doradcą prawnym.', isWarning: true },
        { icon: 'bot', title: '3. Ostrzeżenie dotyczące SI i Ograniczenia Użytkowania', content: '⚠️ WAŻNA INFORMACJA DOTYCZĄCA SZTUCZNEJ INTELIGENCJI\n\n• Lexora zapewnia zautomatyzowaną pomoc opartą na Sztucznej Inteligencji (SI).\n• Odpowiedzi, analizy i projekty generowane przez SI mogą być niekompletne, niedokładne lub zawierać błędy.\n• Lexora NIE zastępuje profesjonalnej porady prawnej ani reprezentacji prawnej.\n• Użytkownik jest zobowiązany do uważnego przeczytania, zweryfikowania i poprawienia całej treści wygenerowanej przez SI przed jej wysłaniem lub użyciem.\n• Użytkownik ponosi wyłączną odpowiedzialność za ostateczne wykorzystanie wygenerowanej treści (wysyłka, decyzje, terminy).\n• Lexora nie ponosi odpowiedzialności za szkody wynikające z niezweryfikowanego przyjęcia treści wygenerowanych przez SI.\n• W przypadku wątpliwości lub skomplikowanych spraw należy skonsultować się z wykwalifikowanym prawnikiem lub właściwym organem.', isWarning: true },
        { icon: 'users', title: '4. Konto Użytkownika', content: 'Do niektórych funkcji wymagane jest konto. Ponosisz odpowiedzialność za poufność swoich danych logowania i aktywności na swoim koncie.' },
        { icon: 'upload', title: '5. Przesłane Dokumenty i Treści', content: 'Zachowujesz wszystkie prawa do swoich treści.\n\nGwarantujesz, że masz prawo do przesłania treści.\n\nNie możesz przesyłać treści naruszających prawa osób trzecich lub niezgodnych z prawem.' },
        { icon: 'file', title: '6. Przetwarzanie w Celu Świadczenia Usługi', content: 'Usługa przetwarza Twoje dokumenty w celu umożliwienia OCR (rozpoznawania tekstu), analizy i tworzenia projektów. Szczegóły w Polityce Prywatności.' },
        { icon: 'clock', title: '7. Dostępność', content: 'Staramy się zapewnić wysoką dostępność, ale nie możemy zagwarantować nieprzerwanej dostępności (konserwacja, problemy techniczne, siła wyższa).' },
        { icon: 'shield', title: '8. Odpowiedzialność', content: 'W przypadku zwykłego niedbalstwa ponosimy odpowiedzialność tylko za naruszenie istotnych zobowiązań umownych i ograniczoną do przewidywalnych, typowych szkód.\n\nOdpowiedzialność za zamiar, rażące niedbalstwo, uszkodzenie życia/ciała/zdrowia oraz zgodnie z obowiązującymi przepisami prawa pozostaje nienaruszona.' },
        { icon: 'file', title: '9. Zmiany', content: 'Możemy aktualizować te warunki. Istotne zmiany będą ogłaszane w aplikacji.' },
        { icon: 'gavel', title: '10. Prawo Właściwe', content: 'Obowiązuje prawo niemieckie. Bezwzględnie obowiązujące przepisy o ochronie konsumentów Twojego kraju zamieszkania pozostają nienaruszone.' },
        { icon: 'globe', title: '11. Ograniczenia Terytorialne', content: 'Lexora nie jest dostępna w jurysdykcjach, w których korzystanie z systemów sztucznej inteligencji lub przetwarzanie danych osobowych podlega surowym ograniczeniom prawnym. W szczególności usługa nie jest dostępna w Federacji Rosyjskiej i Chinach kontynentalnych (Mainland China). Użytkownicy uzyskujący dostęp z tych terytoriów nie są uprawnieni do korzystania z Lexora.', isWarning: true },
        { icon: 'mail', title: 'Kontakt', content: 'Użyj formularza kontaktowego na stronie Impressum.' }
      ]
    },
    ru: {
      title: 'Условия Использования',
      lastUpdated: 'Последнее обновление: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Область Применения', content: 'Настоящие условия использования применяются к использованию веб-приложения "Lexora" (далее "Сервис").' },
        { icon: 'alert', title: '2. Не Заменяет Юридическую Консультацию', content: 'Lexora создаёт автоматизированные черновики и резюме. Содержимое является общей информацией и не является юридической консультацией. Для юридически обязательных оценок обратитесь к квалифицированному юридическому консультанту.', isWarning: true },
        { icon: 'bot', title: '3. Предупреждение об ИИ и Ограничения Использования', content: '⚠️ ВАЖНОЕ УВЕДОМЛЕНИЕ ОБ ИСКУССТВЕННОМ ИНТЕЛЛЕКТЕ\n\n• Lexora предоставляет автоматизированную помощь на основе Искусственного Интеллекта (ИИ).\n• Ответы, анализы и черновики, созданные ИИ, могут быть неполными, неточными или содержать ошибки.\n• Lexora НЕ заменяет профессиональную юридическую консультацию или юридическое представительство.\n• Пользователь обязан внимательно прочитать, проверить и исправить весь контент, созданный ИИ, перед отправкой или использованием.\n• Пользователь несёт единоличную ответственность за конечное использование созданного контента (отправка, решения, сроки).\n• Lexora не несёт ответственности за ущерб, возникший из-за непроверенного принятия контента, созданного ИИ.\n• В случае сомнений или сложных случаев обратитесь к квалифицированному юристу или компетентному органу.', isWarning: true },
        { icon: 'users', title: '4. Учётная Запись Пользователя', content: 'Для определённых функций требуется учётная запись. Вы несёте ответственность за конфиденциальность ваших учётных данных и действий в вашей учётной записи.' },
        { icon: 'upload', title: '5. Загруженные Документы и Контент', content: 'Вы сохраняете все права на ваш контент.\n\nВы гарантируете, что уполномочены загружать контент.\n\nВы не можете загружать контент, нарушающий права третьих лиц или незаконный.' },
        { icon: 'file', title: '6. Обработка для Предоставления Сервиса', content: 'Сервис обрабатывает ваши документы для включения OCR (распознавания текста), анализа и создания черновиков. Подробности см. в Политике Конфиденциальности.' },
        { icon: 'clock', title: '7. Доступность', content: 'Мы стремимся к высокой доступности, но не можем гарантировать бесперебойную доступность (обслуживание, технические проблемы, форс-мажор).' },
        { icon: 'shield', title: '8. Ответственность', content: 'В случаях простой небрежности мы несём ответственность только за нарушение существенных договорных обязательств и ограниченную предсказуемым, типичным ущербом.\n\nОтветственность за умысел, грубую небрежность, причинение вреда жизни/здоровью и в соответствии с обязательными законодательными положениями остаётся неизменной.' },
        { icon: 'file', title: '9. Изменения', content: 'Мы можем обновлять эти условия. Существенные изменения будут объявлены в приложении.' },
        { icon: 'gavel', title: '10. Применимое Право', content: 'Применяется немецкое право. Обязательные положения о защите прав потребителей вашей страны проживания остаются неизменными.' },
        { icon: 'globe', title: '11. Территориальные Ограничения', content: 'Lexora недоступна в юрисдикциях, где использование систем искусственного интеллекта или обработка персональных данных подлежит строгим правовым ограничениям. В частности, сервис недоступен в Российской Федерации и материковом Китае (Mainland China). Пользователи, осуществляющие доступ с этих территорий, не имеют права использовать Lexora.', isWarning: true },
        { icon: 'mail', title: 'Контакт', content: 'Используйте контактную форму на странице Impressum.' }
      ]
    },
    uk: {
      title: 'Умови Використання',
      lastUpdated: 'Останнє оновлення: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. Сфера Застосування', content: 'Ці умови використання застосовуються до використання веб-додатку "Lexora" (далі "Сервіс").' },
        { icon: 'alert', title: '2. Не Замінює Юридичну Консультацію', content: 'Lexora створює автоматизовані чернетки та резюме. Вміст є загальною інформацією і не є юридичною консультацією. Для юридично обов\'язкових оцінок зверніться до кваліфікованого юридичного консультанта.', isWarning: true },
        { icon: 'bot', title: '3. Попередження про ШІ та Обмеження Використання', content: '⚠️ ВАЖЛИВЕ ПОВІДОМЛЕННЯ ЩОДО ШТУЧНОГО ІНТЕЛЕКТУ\n\n• Lexora надає автоматизовану допомогу на основі Штучного Інтелекту (ШІ).\n• Відповіді, аналізи та чернетки, створені ШІ, можуть бути неповними, неточними або містити помилки.\n• Lexora НЕ замінює професійну юридичну консультацію або юридичне представництво.\n• Користувач зобов\'язаний уважно прочитати, перевірити та виправити весь контент, створений ШІ, перед відправленням або використанням.\n• Користувач несе одноосібну відповідальність за кінцеве використання створеного контенту (відправлення, рішення, терміни).\n• Lexora не несе відповідальності за збитки, що виникли внаслідок неперевіреного прийняття контенту, створеного ШІ.\n• У разі сумнівів або складних випадків зверніться до кваліфікованого юриста або компетентного органу.', isWarning: true },
        { icon: 'users', title: '4. Обліковий Запис Користувача', content: 'Для певних функцій потрібен обліковий запис. Ви несете відповідальність за конфіденційність ваших облікових даних та дій у вашому обліковому записі.' },
        { icon: 'upload', title: '5. Завантажені Документи та Контент', content: 'Ви зберігаєте всі права на ваш контент.\n\nВи гарантуєте, що уповноважені завантажувати контент.\n\nВи не можете завантажувати контент, що порушує права третіх осіб або є незаконним.' },
        { icon: 'file', title: '6. Обробка для Надання Сервісу', content: 'Сервіс обробляє ваші документи для включення OCR (розпізнавання тексту), аналізу та створення чернеток. Деталі див. у Політиці Конфіденційності.' },
        { icon: 'clock', title: '7. Доступність', content: 'Ми прагнемо високої доступності, але не можемо гарантувати безперебійну доступність (обслуговування, технічні проблеми, форс-мажор).' },
        { icon: 'shield', title: '8. Відповідальність', content: 'У випадках простої недбалості ми несемо відповідальність лише за порушення суттєвих договірних зобов\'язань і обмежену передбачуваним, типовим збитком.\n\nВідповідальність за умисел, грубу недбалість, заподіяння шкоди життю/здоров\'ю та відповідно до обов\'язкових законодавчих положень залишається незмінною.' },
        { icon: 'file', title: '9. Зміни', content: 'Ми можемо оновлювати ці умови. Суттєві зміни будуть оголошені в додатку.' },
        { icon: 'gavel', title: '10. Застосовне Право', content: 'Застосовується німецьке право. Обов\'язкові положення про захист прав споживачів вашої країни проживання залишаються незмінними.' },
        { icon: 'globe', title: '11. Територіальні Обмеження', content: 'Lexora недоступна в юрисдикціях, де використання систем штучного інтелекту або обробка персональних даних підлягає суворим правовим обмеженням. Зокрема, сервіс недоступний у Російській Федерації та материковому Китаї (Mainland China). Користувачі, які отримують доступ з цих територій, не мають права використовувати Lexora.', isWarning: true },
        { icon: 'mail', title: 'Контакт', content: 'Використовуйте контактну форму на сторінці Impressum.' }
      ]
    },
    ar: {
      title: 'شروط الخدمة',
      lastUpdated: 'آخر تحديث: 27.12.2025',
      sections: [
        { icon: 'scale', title: '1. نطاق التطبيق', content: 'تنطبق شروط الخدمة هذه على استخدام تطبيق الويب "Lexora" (المشار إليه فيما بعد بـ "الخدمة").' },
        { icon: 'alert', title: '2. لا يحل محل الاستشارة القانونية', content: 'تقوم Lexora بإنشاء مسودات وملخصات آلية. المحتوى عبارة عن معلومات عامة ولا يشكل استشارة قانونية. للحصول على تقييمات ملزمة قانونياً، استشر مستشاراً قانونياً مؤهلاً.', isWarning: true },
        { icon: 'bot', title: '3. تحذير الذكاء الاصطناعي وقيود الاستخدام', content: '⚠️ إشعار مهم بخصوص الذكاء الاصطناعي\n\n• تقدم Lexora مساعدة آلية تعتمد على الذكاء الاصطناعي.\n• قد تكون الردود والتحليلات والمسودات التي ينشئها الذكاء الاصطناعي غير مكتملة أو غير دقيقة أو تحتوي على أخطاء.\n• Lexora لا تحل محل الاستشارة القانونية المهنية أو التمثيل القانوني.\n• يلتزم المستخدم بقراءة ومراجعة وتصحيح جميع المحتويات التي ينشئها الذكاء الاصطناعي بعناية قبل إرسالها أو استخدامها.\n• يتحمل المستخدم المسؤولية الكاملة عن الاستخدام النهائي للمحتوى المُنشأ (الإرسال والقرارات والمواعيد النهائية).\n• Lexora غير مسؤولة عن الأضرار الناتجة عن اعتماد محتوى الذكاء الاصطناعي دون التحقق منه.\n• في حالة الشك أو الحالات المعقدة، يرجى استشارة محامٍ مؤهل أو السلطة المختصة.', isWarning: true },
        { icon: 'users', title: '4. حساب المستخدم', content: 'يلزم حساب لبعض الوظائف. أنت مسؤول عن سرية بيانات اعتمادك والأنشطة في حسابك.' },
        { icon: 'upload', title: '5. المستندات والمحتوى المحمل', content: 'تحتفظ بجميع الحقوق على محتواك.\n\nتضمن أنك مخول بتحميل المحتوى.\n\nلا يمكنك تحميل محتوى ينتهك حقوق الغير أو غير قانوني.' },
        { icon: 'file', title: '6. المعالجة لتقديم الخدمة', content: 'تعالج الخدمة مستنداتك لتمكين OCR (التعرف على النص) والتحليل وإنشاء المسودات. انظر سياسة الخصوصية للتفاصيل.' },
        { icon: 'clock', title: '7. التوفر', content: 'نسعى لتوفر عالٍ لكن لا نستطيع ضمان توفر غير منقطع (الصيانة، المشاكل التقنية، القوة القاهرة).' },
        { icon: 'shield', title: '8. المسؤولية', content: 'في حالات الإهمال البسيط، نكون مسؤولين فقط عن خرق الالتزامات التعاقدية الأساسية ومحدودة بالأضرار المتوقعة والنموذجية.\n\nتبقى المسؤولية عن القصد والإهمال الجسيم والإضرار بالحياة/الجسد/الصحة ووفقاً للأحكام القانونية الإلزامية غير متأثرة.' },
        { icon: 'file', title: '9. التغييرات', content: 'قد نقوم بتحديث هذه الشروط. سيتم الإعلان عن التغييرات الجوهرية داخل التطبيق.' },
        { icon: 'gavel', title: '10. القانون المطبق', content: 'يطبق القانون الألماني. تبقى الأحكام الإلزامية لحماية المستهلك في بلد إقامتك غير متأثرة.' },
        { icon: 'globe', title: '11. القيود الإقليمية', content: 'Lexora غير متاحة في الولايات القضائية التي يخضع فيها استخدام أنظمة الذكاء الاصطناعي أو معالجة البيانات الشخصية لقيود قانونية صارمة. على وجه الخصوص، الخدمة غير متاحة في الاتحاد الروسي والصين القارية (Mainland China). المستخدمون الذين يصلون من هذه الأقاليم غير مخولين باستخدام Lexora.', isWarning: true },
        { icon: 'mail', title: 'الاتصال', content: 'استخدم نموذج الاتصال في صفحة Impressum.' }
      ]
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'scale': return <Scale className="h-5 w-5" />;
      case 'alert': return <AlertTriangle className="h-5 w-5" />;
      case 'users': return <Users className="h-5 w-5" />;
      case 'upload': return <Upload className="h-5 w-5" />;
      case 'file': return <FileText className="h-5 w-5" />;
      case 'clock': return <Clock className="h-5 w-5" />;
      case 'shield': return <Shield className="h-5 w-5" />;
      case 'gavel': return <Gavel className="h-5 w-5" />;
      case 'mail': return <Mail className="h-5 w-5" />;
      case 'bot': return <Bot className="h-5 w-5" />;
      case 'globe': return <Globe className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  // Convert uppercase language code to lowercase for content lookup, fallback to EN
  const langKey = language.toLowerCase();
  const currentContent = content[langKey] || content.en;

  return (
    <div className="min-h-screen bg-navy" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="border-b border-gold/20">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-gold/60" />
              <span className="relative font-display text-sm font-semibold text-gold">L</span>
            </div>
            <span className="font-display text-lg font-medium tracking-widest text-ivory uppercase">LEXORA</span>
          </Link>
          <div className="flex items-center gap-4">
            <LegalPageLanguageSwitch variant="dark" />
            <Button variant="ghost" size="sm" asChild className="text-ivory/70 hover:text-gold hover:bg-transparent">
              <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />{t('common.back')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-12 px-4">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <Scale className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-medium text-ivory">{currentContent.title}</h1>
            <p className="text-sm text-ivory/50 mt-1">{getLastUpdatedLabel(TERMS_VERSION, language)}</p>
            <p className="text-xs text-ivory/30 mt-0.5">Version: {TERMS_VERSION}</p>
          </div>
        </div>

        <div className="space-y-6">
          {currentContent.sections.map((section, index) => {
            const isContactSection = section.icon === 'mail';
            const sectionContent = (
              <section 
                key={index} 
                className={`rounded-lg border p-6 ${
                  section.isWarning 
                    ? 'border-amber-500/40 bg-amber-500/10' 
                    : isContactSection
                      ? 'border-gold/40 bg-gold/10 cursor-pointer hover:bg-gold/15 transition-colors'
                      : 'border-gold/20 bg-ivory/5'
                }`}
              >
                <h2 className={`mb-3 flex items-center gap-2 text-lg font-semibold ${
                  section.isWarning ? 'text-amber-400' : 'text-gold'
                }`}>
                  {getIcon(section.icon)}
                  {section.title}
                </h2>
                <p className="text-ivory/80 whitespace-pre-line leading-relaxed">{section.content}</p>
              </section>
            );

            if (isContactSection) {
              return (
                <Link key={index} to="/impressum#contact-form">
                  {sectionContent}
                </Link>
              );
            }

            return sectionContent;
          })}
        </div>

        <div className="mt-12 text-center">
          <Link to="/" className="text-sm text-ivory/50 hover:text-gold transition-colors">← {t('common.back')}</Link>
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
