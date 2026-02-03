/**
 * AuthMigrationFix – pulisce sessioni bloccate dopo migrazione dominio (Lovable → Vercel).
 * Rileva token/auth datati o errori "invalid claim" / "session_not_found" e mostra modale
 * per effettuare nuovamente il login (signOut pulito + redirect a /auth).
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

const STORAGE_KEY = 'lexora_auth_migration_reset';

/** Indica se il messaggio di errore auth richiede il reset (invalid claim, session not found, ecc.) */
function isMigrationAuthError(message: string | undefined): boolean {
  if (!message || typeof message !== 'string') return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid') && lower.includes('claim') ||
    lower.includes('session_not_found') ||
    lower.includes('session not found') ||
    (lower.includes('jwt') && (lower.includes('expired') || lower.includes('invalid')))
  );
}

/**
 * Chiama questo da qualsiasi punto quando ricevi 401 con body che indica invalid claim / session_not_found.
 * Es: dopo fetch che ritorna 401 e error.message con "invalid claim".
 */
export function setAuthMigrationResetNeeded(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
    window.dispatchEvent(new Event('storage'));
  } catch {
    // ignore
  }
}

export function AuthMigrationFix() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState(false);

  const doCleanLogin = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.toLowerCase().includes('supabase') || k.startsWith('sb-'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    setShowModal(false);
    navigate('/auth', { replace: true });
    window.location.href = '/auth';
  }, [signOut, navigate]);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      // 1) Flag da sessionStorage (es. impostato dopo 401 con invalid claim da un altro punto dell'app)
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') {
          if (isMounted) {
            setShowModal(true);
            setChecked(true);
          }
          return;
        }
      } catch {
        // ignore
      }

      // 2) Verifica sessione esistente: getUser() valida il token lato server
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) {
        setChecked(true);
        return;
      }

      const { error } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (error && isMigrationAuthError(error.message)) {
        setShowModal(true);
      }
      setChecked(true);
    };

    check();

    const onStorage = () => {
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') setShowModal(true);
      } catch {
        // ignore
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (!checked) return null;

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent hideCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiornamento infrastruttura</DialogTitle>
          <DialogDescription>
            Abbiamo aggiornato la nostra infrastruttura. Per continuare in sicurezza, effettua nuovamente il login.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button onClick={doCleanLogin} className="w-full sm:w-auto">
            Login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
