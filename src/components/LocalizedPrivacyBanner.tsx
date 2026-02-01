import { Link } from 'react-router-dom';
import { Scale, ExternalLink } from 'lucide-react';

interface LocalizedPrivacyBannerProps {
  languageName: string;
}

/**
 * Banner displayed on localized privacy policy pages
 * Informs users that the English version is legally binding
 */
export function LocalizedPrivacyBanner({ languageName }: LocalizedPrivacyBannerProps) {
  return (
    <div className="mb-8 rounded-lg border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-start gap-3">
        <Scale className="h-5 w-5 text-gold flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-ivory">
            You are viewing the <strong>{languageName}</strong> version of our Privacy Policy. 
            This translation is provided for your convenience.
          </p>
          <p className="text-xs text-ivory/60 mt-1">
            The <Link to="/privacy" className="text-gold hover:underline inline-flex items-center gap-1">
              English version <ExternalLink className="h-3 w-3" />
            </Link> is the legally binding document. In case of any discrepancy, the English version prevails.
          </p>
        </div>
      </div>
    </div>
  );
}
