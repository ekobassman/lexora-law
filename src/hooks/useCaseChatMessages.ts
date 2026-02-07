import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export interface CaseChatMessage {
  id: string;
  case_id: string;
  user_id: string;
  scope: 'dashboard' | 'case' | 'edit';
  role: 'user' | 'assistant' | 'system';
  content: string;
  language: string;
  created_at: string;
}

interface UseCaseChatMessagesOptions {
  caseId: string | null;
  scope: 'dashboard' | 'case' | 'edit';
  limit?: number;
}

export function useCaseChatMessages({ caseId, scope, limit = 50 }: UseCaseChatMessagesOptions) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [messages, setMessages] = useState<CaseChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load messages when caseId changes
  useEffect(() => {
    if (!caseId || !user) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const loadMessages = async () => {
      setIsLoading(true);
      console.log('[CASE_CHAT] Loading messages for case_id=' + caseId);
      
      const { data, error } = await supabase
        .from('case_chat_messages')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[CASE_CHAT] Load error:', error);
        setMessages([]);
      } else {
        console.log('[CASE_CHAT] Loaded ' + (data?.length || 0) + ' messages for case_id=' + caseId);
        setMessages((data as CaseChatMessage[]) || []);
      }
      setIsLoading(false);
    };

    loadMessages();
  }, [caseId, user, limit]);

  // Add a message
  const addMessage = useCallback(async (
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<CaseChatMessage | null> => {
    if (!caseId || !user) {
      console.warn('[CASE_CHAT] Cannot add message: no caseId or user');
      return null;
    }

    const newMessage = {
      case_id: caseId,
      user_id: user.id,
      scope,
      role,
      content,
      language: language.toUpperCase(),
    };

    const { data, error } = await supabase
      .from('case_chat_messages')
      .insert(newMessage)
      .select()
      .single();

    if (error) {
      console.error('[CASE_CHAT] Insert error:', error);
      return null;
    }

    const savedMessage = data as CaseChatMessage;
    console.log('[CASE_CHAT_SAVE_OK] case_id=' + caseId + ' role=' + role + ' lang=' + language);
    
    // Optimistic update
    setMessages(prev => [...prev, savedMessage]);
    
    return savedMessage;
  }, [caseId, user, scope, language]);

  // Clear all messages for this case
  const clearMessages = useCallback(async (): Promise<boolean> => {
    if (!caseId || !user) return false;

    const { error } = await supabase
      .from('case_chat_messages')
      .delete()
      .eq('case_id', caseId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[CASE_CHAT] Clear error:', error);
      return false;
    }

    console.log('[CASE_CHAT] Cleared messages for case_id=' + caseId);
    setMessages([]);
    return true;
  }, [caseId, user]);

  // Convert to legacy format for backward compatibility
  const toLegacyFormat = useCallback(() => {
    return messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      created_at: m.created_at,
    }));
  }, [messages]);

  return {
    messages,
    isLoading,
    addMessage,
    clearMessages,
    toLegacyFormat,
    hasMessages: messages.length > 0,
  };
}
