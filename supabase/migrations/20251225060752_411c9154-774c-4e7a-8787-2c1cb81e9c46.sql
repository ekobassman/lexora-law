
-- 1) Abilita estensione pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Converti risks da TEXT a JSONB in modo sicuro
-- Prima aggiungi una colonna temporanea
ALTER TABLE public.pratiche ADD COLUMN IF NOT EXISTS risks_jsonb JSONB DEFAULT '[]'::jsonb;

-- Converti i dati esistenti: se risks ha testo, lo mette in un array
UPDATE public.pratiche 
SET risks_jsonb = CASE 
  WHEN risks IS NULL OR risks = '' THEN '[]'::jsonb
  ELSE jsonb_build_array(risks)
END;

-- Rimuovi la vecchia colonna e rinomina la nuova
ALTER TABLE public.pratiche DROP COLUMN IF EXISTS risks;
ALTER TABLE public.pratiche RENAME COLUMN risks_jsonb TO risks;

-- 3) Aggiungi constraint per status (valori controllati)
-- Prima assicuriamoci che i valori esistenti siano validi
UPDATE public.pratiche 
SET status = 'new' 
WHERE status NOT IN ('new', 'pending', 'in_progress', 'completed', 'archived');

ALTER TABLE public.pratiche 
ADD CONSTRAINT pratiche_status_check 
CHECK (status IN ('new', 'pending', 'in_progress', 'completed', 'archived'));

-- 4) Aggiungi constraint per tone (valori controllati)
UPDATE public.pratiche 
SET tone = 'formal' 
WHERE tone IS NOT NULL AND tone NOT IN ('formal', 'friendly', 'assertive', 'concise');

ALTER TABLE public.pratiche 
ADD CONSTRAINT pratiche_tone_check 
CHECK (tone IS NULL OR tone IN ('formal', 'friendly', 'assertive', 'concise'));

-- 5) created_at e updated_at già esistono, ma assicuriamoci che i trigger siano attivi
DROP TRIGGER IF EXISTS update_pratiche_updated_at ON public.pratiche;

CREATE TRIGGER update_pratiche_updated_at
BEFORE UPDATE ON public.pratiche
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
