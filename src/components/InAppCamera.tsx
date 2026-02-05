import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface InAppCameraProps {
  onPhotosCaptured: (files: File[]) => void;
  onClose: () => void;
  existingPhotos?: File[];
}

const blobToFile = (blob: Blob, fileName: string) =>
  new File([blob], fileName, { type: blob.type || "image/jpeg" });

// Compress image to reduce file size
async function compressImage(blob: Blob, maxSizeMB: number = 2, maxDimension: number = 2000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

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

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;

      const tryCompress = () => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const sizeMB = result.size / (1024 * 1024);
            if (sizeMB > maxSizeMB && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(result);
            }
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(blob);
  });
}

export function InAppCamera({ onPhotosCaptured, onClose, existingPhotos = [] }: InAppCameraProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  console.log('DEBUG: InAppCamera render', { existingPhotosCount: existingPhotos.length });

  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<{ file: File; url: string }[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showPreview, setShowPreview] = useState(false);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    console.log('DEBUG: Apertura camera...', { facing });
    setIsInitializing(true);
    setError(null);

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      console.log('DEBUG: getUserMedia chiamato', { constraints });
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia non disponibile (HTTPS o browser non supportato)');
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('DEBUG: Stream ottenuto', { tracks: stream.getTracks().length });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('DEBUG: Errore camera:', msg, err);
      setError(t('inAppCamera.errorAccess') || 'Cannot access camera. Please check permissions.');
    } finally {
      setIsInitializing(false);
    }
  }, [t]);

  useEffect(() => {
    console.log('DEBUG: InAppCamera useEffect mount - avvio startCamera');
    startCamera(facingMode);

    return () => {
      console.log('DEBUG: InAppCamera cleanup - stop stream');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Revoke object URLs
      capturedPhotos.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, []);

  const handleSwitchCamera = useCallback(() => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('No canvas context');

      // Set canvas to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      ctx.drawImage(video, 0, 0);

      // Always produce JPEG File for upload
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size === 0) {
              reject(new Error('Camera snapshot blob is empty'));
              return;
            }
            const file = blobToFile(blob, 'scan.jpg');
            console.log('[camera] captured file:', {
              name: file.name,
              type: file.type,
              size: file.size,
            });
            const url = URL.createObjectURL(file);
            setCapturedPhotos((prev) => [...prev, { file, url }]);
            resolve();
          },
          'image/jpeg',
          0.9
        );
      });

      // Brief flash effect
      if (videoRef.current) {
        videoRef.current.style.opacity = '0.5';
        setTimeout(() => {
          if (videoRef.current) videoRef.current.style.opacity = '1';
        }, 100);
      }
    } catch (err) {
      console.error('Capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  const handleRemovePhoto = useCallback((index: number) => {
    setCapturedPhotos(prev => {
      const photo = prev[index];
      if (photo) URL.revokeObjectURL(photo.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const files = capturedPhotos.map((p) => p.file);
    onPhotosCaptured([...existingPhotos, ...files]);
    onClose();
  }, [capturedPhotos, existingPhotos, onPhotosCaptured, onClose]);

  const totalPhotos = existingPhotos.length + capturedPhotos.length;

  const handleTestFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length > 0) {
        onPhotosCaptured([...existingPhotos, ...files]);
        onClose();
      }
    },
    [existingPhotos, onPhotosCaptured, onClose]
  );

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* E2E: hidden file input to simulate photo (Playwright setInputFiles) */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-hidden
        data-testid="camera-test-file-input"
        onChange={handleTestFileInput}
      />
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
        
        <div className="flex items-center gap-2 text-white">
          <ImageIcon className="h-5 w-5" />
          <span className="font-medium">{totalPhotos} {t('inAppCamera.photos') || 'photos'}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleSwitchCamera}
          disabled={isInitializing}
          className="text-white hover:bg-white/20"
        >
          <RotateCcw className="h-6 w-6" />
        </Button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <Loader2 className="h-10 w-10 text-white animate-spin" />
          </div>
        )}

        {error ? (
          <div className="text-center text-white p-6">
            <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-4">{error}</p>
            <Button onClick={() => startCamera(facingMode)} variant="secondary">
              {t('common.retry') || 'Retry'}
            </Button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transition-opacity duration-100"
          />
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Thumbnail strip */}
      {capturedPhotos.length > 0 && (
        <div className="absolute bottom-32 left-0 right-0 px-4">
          <div 
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
            onClick={() => setShowPreview(true)}
          >
            {capturedPhotos.map((photo, i) => (
              <div key={i} className="relative shrink-0">
                <img
                  src={photo.url}
                  alt={`Photo ${i + 1}`}
                  className="h-16 w-16 object-cover rounded-lg border-2 border-white/50"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePhoto(i);
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 pb-8 pt-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-8">
          {/* Cancel */}
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            {t('common.cancel') || 'Cancel'}
          </Button>

          {/* Capture Button */}
          <button
            onClick={handleCapture}
            disabled={isCapturing || isInitializing || !!error}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isCapturing ? (
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white" />
            )}
          </button>

          {/* Confirm */}
          <Button
            variant="ghost"
            onClick={handleConfirm}
            disabled={totalPhotos === 0}
            className="text-white hover:bg-white/20 disabled:opacity-50"
          >
            <Check className="h-5 w-5 mr-2" />
            {t('common.confirm') || 'Done'}
          </Button>
        </div>

        <p className="text-center text-white/70 text-sm mt-4">
          {t('inAppCamera.hint') || 'Tap to capture, then tap Done when finished'}
        </p>
      </div>
    </div>
  );
}
