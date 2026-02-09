/**
 * Anonymous Session Management
 * 
 * Stores temporary case data for non-logged-in users.
 * On signup/login, this data is automatically migrated to the user's account.
 */

export interface AnonymousCase {
  id: string;
  createdAt: string;
  title: string;
  letterText?: string;
  ocrResult?: string;
  explanation?: string;
  risks?: string[];
  draftResponse?: string;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  fileData?: {
    base64: string;
    mimeType: string;
    fileName: string;
  };
}

const STORAGE_KEY = 'lexora_anonymous_session';
const MAX_CASES = 1; // Limit anonymous cases to match free plan

function getStorage(): { cases: AnonymousCase[]; lastUpdated: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStorage(data: { cases: AnonymousCase[]; lastUpdated: string }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[anonymousSession] Failed to save:', e);
  }
}

export function getAnonymousCases(): AnonymousCase[] {
  const storage = getStorage();
  return storage?.cases ?? [];
}

export function getAnonymousCase(id: string): AnonymousCase | null {
  const cases = getAnonymousCases();
  return cases.find(c => c.id === id) ?? null;
}

export function createAnonymousCase(data: Omit<AnonymousCase, 'id' | 'createdAt'>): AnonymousCase {
  const newCase: AnonymousCase = {
    ...data,
    id: `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const storage = getStorage() ?? { cases: [], lastUpdated: '' };
  
  // Keep only latest cases
  const updatedCases = [newCase, ...storage.cases].slice(0, MAX_CASES);
  
  setStorage({
    cases: updatedCases,
    lastUpdated: new Date().toISOString(),
  });

  return newCase;
}

export function updateAnonymousCase(id: string, updates: Partial<AnonymousCase>): AnonymousCase | null {
  const storage = getStorage();
  if (!storage) return null;

  const index = storage.cases.findIndex(c => c.id === id);
  if (index === -1) return null;

  const updated = { ...storage.cases[index], ...updates };
  storage.cases[index] = updated;
  storage.lastUpdated = new Date().toISOString();
  
  setStorage(storage);
  return updated;
}

export function addChatMessage(
  caseId: string, 
  role: 'user' | 'assistant', 
  content: string
): void {
  const caseData = getAnonymousCase(caseId);
  if (!caseData) return;

  const chatHistory = caseData.chatHistory ?? [];
  chatHistory.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  updateAnonymousCase(caseId, { chatHistory });
}

export function clearAnonymousSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function hasAnonymousData(): boolean {
  const cases = getAnonymousCases();
  return cases.length > 0;
}

/**
 * Get the most recent anonymous case (for migration on signup)
 */
export function getLatestAnonymousCase(): AnonymousCase | null {
  const cases = getAnonymousCases();
  return cases[0] ?? null;
}
