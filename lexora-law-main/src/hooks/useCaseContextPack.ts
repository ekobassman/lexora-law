import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Document {
  id: string;
  raw_text: string | null;
  file_name: string | null;
  created_at: string;
  direction: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  language?: string;
}

interface Pratica {
  id: string;
  title: string;
  authority: string | null;
  aktenzeichen: string | null;
  deadline: string | null;
  draft_response: string | null;
  chat_history: ChatMessage[] | null;
  letter_text: string | null;
}

interface ContextPackResult {
  context_text: string;
  source_hash: string;
  language: string;
}

// Generate a simple hash from source data
function generateSourceHash(documents: Document[], draft: string | null, chatCount: number): string {
  const docIds = documents.map(d => d.id).join(',');
  const draftSnippet = draft?.slice(0, 50) || '';
  const raw = `${docIds}|${draftSnippet}|${chatCount}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Build a compact context pack from case data
export function buildContextPack(
  pratica: Pratica,
  documents: Document[],
  language: string
): ContextPackResult {
  const parts: string[] = [];
  
  // 1. Case metadata
  parts.push(`[CASE: ${pratica.title}]`);
  if (pratica.authority) parts.push(`Authority: ${pratica.authority}`);
  if (pratica.aktenzeichen) parts.push(`Reference: ${pratica.aktenzeichen}`);
  if (pratica.deadline) parts.push(`Deadline: ${pratica.deadline}`);
  parts.push('');
  
  // 2. Documents timeline (OCR text from all documents, ordered by date)
  const docsWithText = documents
    .filter(d => d.raw_text && d.raw_text.trim().length > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  if (docsWithText.length > 0) {
    parts.push('[DOCUMENTS TIMELINE]');
    docsWithText.forEach((doc, idx) => {
      const date = new Date(doc.created_at).toLocaleDateString();
      const direction = doc.direction === 'incoming' ? '📥' : '📤';
      const name = doc.file_name || `Document ${idx + 1}`;
      // Truncate long OCR text to keep context manageable
      const text = doc.raw_text!.length > 2000 
        ? doc.raw_text!.slice(0, 2000) + '...[truncated]'
        : doc.raw_text;
      parts.push(`${direction} ${date} - ${name}:`);
      parts.push(text!);
      parts.push('---');
    });
    parts.push('');
  }
  
  // 3. Current draft (if exists)
  if (pratica.draft_response) {
    parts.push('[CURRENT DRAFT]');
    const draftText = pratica.draft_response.length > 3000
      ? pratica.draft_response.slice(0, 3000) + '...[truncated]'
      : pratica.draft_response;
    parts.push(draftText);
    parts.push('');
  }
  
  // 4. Recent chat messages (last 10)
  const chatHistory = pratica.chat_history || [];
  const recentChat = chatHistory.slice(-10);
  
  if (recentChat.length > 0) {
    parts.push('[RECENT CONVERSATION]');
    recentChat.forEach(msg => {
      const role = msg.role === 'user' ? '👤' : '🤖';
      // Truncate very long messages
      const content = msg.content.length > 500
        ? msg.content.slice(0, 500) + '...'
        : msg.content;
      parts.push(`${role}: ${content}`);
    });
    parts.push('');
  }
  
  const context_text = parts.join('\n');
  const source_hash = generateSourceHash(documents, pratica.draft_response, chatHistory.length);
  
  console.log(`[CONTEXT_PACK_UPDATED] case_id=${pratica.id} hash=${source_hash} lang=${language}`);
  
  return {
    context_text,
    source_hash,
    language,
  };
}

export function useCaseContextPack() {
  // Save context pack to database
  const saveContextPack = useCallback(async (
    caseId: string,
    userId: string,
    pack: ContextPackResult
  ) => {
    const { error } = await supabase
      .from('case_context_pack')
      .upsert({
        case_id: caseId,
        user_id: userId,
        context_text: pack.context_text,
        source_hash: pack.source_hash,
        language: pack.language,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'case_id',
      });
    
    if (error) {
      console.error('[CONTEXT_PACK] Save error:', error);
      return false;
    }
    
    console.log(`[CONTEXT_PACK_CACHE_HIT] case_id=${caseId}`);
    return true;
  }, []);
  
  // Load context pack from database
  const loadContextPack = useCallback(async (caseId: string): Promise<ContextPackResult | null> => {
    const { data, error } = await supabase
      .from('case_context_pack')
      .select('context_text, source_hash, language')
      .eq('case_id', caseId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      context_text: data.context_text,
      source_hash: data.source_hash,
      language: data.language,
    };
  }, []);
  
  // Build and optionally save context pack
  const buildAndSaveContextPack = useCallback(async (
    pratica: Pratica,
    documents: Document[],
    userId: string,
    language: string
  ): Promise<ContextPackResult> => {
    const pack = buildContextPack(pratica, documents, language);
    await saveContextPack(pratica.id, userId, pack);
    return pack;
  }, [saveContextPack]);
  
  return {
    buildContextPack,
    saveContextPack,
    loadContextPack,
    buildAndSaveContextPack,
  };
}
