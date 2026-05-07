import authorizedAxios from '@/utils/authorizedAxios';

export interface AskResponse {
  question: string;
  answer: string;
}

export interface SearchResult {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface SummaryResponse {
  conversationId: string;
  summary: string;
  fromDate: string | null;
  toDate: string | null;
  messageCount: number;
}

export interface TranslateResponse {
  original: string;
  translated: string;
  targetLanguage: string;
}

export interface RewriteVariant {
  style: string;
  label: string;
  text: string;
}

export interface RewriteResponse {
  original: string;
  rewrites: RewriteVariant[];
}

export interface IndexDocumentResponse {
  message: string;
  chunksIndexed: number;
}

export interface MessageItem {
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: string;
}

export const aiServices = {
  /** RAG Bot — hỏi đáp dựa trên tài liệu đã index */
  ask: (question: string, collectionId?: string) =>
    authorizedAxios
      .post<AskResponse>('/api/ai/ask', { question, collectionId })
      .then((r) => r.data),

  /** Index tài liệu vào Qdrant để RAG Bot sử dụng */
  indexDocument: (
    text: string,
    meta?: { collectionId?: string; source?: string; title?: string },
  ) =>
    authorizedAxios
      .post<IndexDocumentResponse>('/api/ai/documents/index', { text, ...meta })
      .then((r) => r.data),

  /** Tìm kiếm ngữ nghĩa trong tin nhắn */
  search: (query: string, conversationId?: string, limit = 10, minScore?: number) =>
    authorizedAxios
      .post<SearchResponse>('/api/ai/search', { query, conversationId, limit, minScore })
      .then((r) => r.data),

  /** Tóm tắt cuộc trò chuyện */
  summarize: (conversationId: string, messages: MessageItem[], fromDate?: string, toDate?: string) =>
    authorizedAxios
      .post<SummaryResponse>(`/api/ai/conversations/${conversationId}/summary`, { messages, fromDate, toDate })
      .then((r) => r.data),

  /** Dịch văn bản */
  translate: (text: string, targetLanguage: string, sourceLanguage?: string) =>
    authorizedAxios
      .post<TranslateResponse>('/api/ai/translate', { text, targetLanguage, sourceLanguage })
      .then((r) => r.data),

  /** Viết lại tin nhắn theo nhiều phong cách */
  rewrite: (text: string) =>
    authorizedAxios
      .post<RewriteResponse>('/api/ai/rewrite', { text })
      .then((r) => r.data),

  /** Backfill: index existing messages vào Qdrant cho semantic search */
  reindexMessages: (
    messages: Array<{
      messageId: string;
      conversationId: string;
      senderId: string;
      content: string;
      timestamp: string;
      revokedAt?: string | null;
    }>,
  ) =>
    authorizedAxios
      .post<{ indexed: number; failed: number; total: number }>('/api/ai/messages/reindex', {
        messages,
      })
      .then((r) => r.data),
};
