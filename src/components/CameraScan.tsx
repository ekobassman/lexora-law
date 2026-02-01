import { useState, useRef } from 'react';
import { Camera, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface CameraScanProps {
  onImageCaptured: (file: File) => void;
  disabled?: boolean;
}

// Compress image to reduce file size
async function compressImage(file: File, maxSizeMB: number = 2, maxDimension: number = 2000): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      let { width, height } = img;
      
      // Scale down if larger than max dimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension;
          width = maxDimension;
        } else {
          width = (width / height) * maxDimension;
          height = maxDimension;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Draw image with white background (for transparency)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // Start with high quality and reduce if needed
      let quality = 0.9;
      
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            const sizeMB = blob.size / (1024 * 1024);
            
            // If still too large and quality can be reduced
            if (sizeMB > maxSizeMB && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else {
              // Create a new File from the blob
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, '.jpg'),
                { type: 'image/jpeg' }
              );
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      tryCompress();
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function CameraScan({ onImageCaptured, disabled }: CameraScanProps) {
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input for next capture
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setErrorMessage(t('cameraScan.errorNotImage'));
      return;
    }
    
    setIsProcessing(true);
    setStatus('processing');
    setErrorMessage(null);
    
    try {
      // Compress the image
      const compressedFile = await compressImage(file, 2.5, 2000);
      
      console.log(`Original: ${(file.size / 1024 / 1024).toFixed(2)}MB, Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
      
      // Pass compressed file to parent
      onImageCaptured(compressedFile);
      setStatus('success');
      
      // Reset status after a moment
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      console.error('Error processing image:', error);
      setStatus('error');
      setErrorMessage(t('cameraScan.errorProcessing'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      {/* Hidden file input with camera capture for mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
        disabled={disabled || isProcessing}
      />
      
      {/* Camera button - large and mobile-friendly */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className="w-full h-14 text-base gap-3 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('cameraScan.processing')}
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle className="h-5 w-5 text-success" />
            {t('cameraScan.success')}
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="h-5 w-5 text-destructive" />
            {errorMessage || t('cameraScan.error')}
          </>
        ) : (
          <>
            <Camera className="h-5 w-5" />
            {t('cameraScan.button')}
          </>
        )}
      </Button>
      
      <p className="text-xs text-muted-foreground text-center">
        {t('cameraScan.hint')}
      </p>
    </div>
  );
}
