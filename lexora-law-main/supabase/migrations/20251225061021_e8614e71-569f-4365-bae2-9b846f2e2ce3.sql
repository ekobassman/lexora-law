
-- 1) Abilita estensione pgcrypto (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Verifica e migra risks da TEXT a JSONB solo se necessario
DO $$
DECLARE
  col_type text;
BEGIN
  -- Ottieni il tipo della colonna risks
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = 'pratiche' 
    AND column_name = 'risks';
  
  -- Se è ancora TEXT, effettua la migrazione
  IF col_type = 'text' THEN
    -- Aggiungi colonna temporanea
    ALTER TABLE public.pratiche ADD COLUMN risks_jsonb JSONB DEFAULT '[]'::jsonb;
    
    -- Migra i dati
    UPDATE public.pratiche 
    SET risks_jsonb = CASE 
      WHEN risks IS NULL OR risks = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(risks)
    END;
    
    -- Rimuovi vecchia colonna e rinomina
    ALTER TABLE public.pratiche DROP COLUMN risks;
    ALTER TABLE public.pratiche RENAME COLUMN risks_jsonb TO risks;
  END IF;
END $$;

-- 3) Rimuovi constraint esistenti prima di ricrearli (idempotente)
ALTER TABLE public.pratiche DROP CONSTRAINT IF EXISTS pratiche_status_check;
ALTER TABLE public.pratiche DROP CONSTRAINT IF EXISTS pratiche_tone_check;

-- 4) Normalizza dati esistenti a valori validi
UPDATE public.pratiche 
SET status = 'new' 
WHERE status IS NULL OR status NOT IN ('new', 'pending', 'in_progress', 'completed', 'archived');

UPDATE public.pratiche 
SET tone = 'formal' 
WHERE tone IS NOT NULL AND tone NOT IN ('formal', 'friendly', 'assertive', 'concise');

-- 5) Ricrea constraint controllati
ALTER TABLE public.pratiche 
ADD CONSTRAINT pratiche_status_check 
CHECK (status IN ('new', 'pending', 'in_progress', 'completed', 'archived'));

ALTER TABLE public.pratiche 
ADD CONSTRAINT pratiche_tone_check 
CHECK (tone IS NULL OR tone IN ('formal', 'friendly', 'assertive', 'concise'));

-- 6) Assicura trigger updated_at attivo
DROP TRIGGER IF EXISTS update_pratiche_updated_at ON public.pratiche;

CREATE TRIGGER update_pratiche_updated_at
BEFORE UPDATE ON public.pratiche
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
