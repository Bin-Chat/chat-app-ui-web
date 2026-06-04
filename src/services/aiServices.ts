import authorizedAxios from '@/utils/authorizedAxios';

export interface AskResponse {
  question: string;
  answer: string;
  citations: RagCitation[];
  intent: string;
  scoped: boolean;
  cached: boolean;
}

export interface AskHistoryMessage {
  role: 'user' | 'bot';
  text: string;
}

export interface RagCitation {
  id: string;
  documentId: string | null;
  title: string;
  source: string;
  collectionId: string | null;
  chunkIndex: number;
  score: number;
  vectorScore: number;
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
  collectionId?: string;
  documentId: string;
  documentVersion: string;
  mode: RagIndexMode;
  previousChunks: number;
  totalChunks: number;
}

export type RagIndexMode = 'replace' | 'append';

export interface IndexedDocumentChunk {
  id: string;
  chunkIndex: number;
  chunkStart: number | null;
  chunkEnd: number | null;
  preview: string;
  content: string;
}

export interface IndexedRagDocument {
  documentId: string;
  documentVersion: string | null;
  title: string;
  source: string;
  collectionId: string | null;
  indexedAt: string | null;
  legacy: boolean;
  chunkCount: number;
  chunks: IndexedDocumentChunk[];
}

export interface IndexedRagDocumentList {
  documents: IndexedRagDocument[];
  totalDocuments: number;
  totalChunks: number;
}

export interface MessageItem {
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: string;
}

export const aiServices = {
  /** RAG Bot — hỏi đáp dựa trên tài liệu đã index */
  ask: (question: string, collectionId?: string, history?: AskHistoryMessage[]) =>
    authorizedAxios
      .post<AskResponse>('/api/ai/ask', { question, collectionId, history })
      .then((r) => r.data),

  /** Index tài liệu vào Qdrant để RAG Bot sử dụng */
  indexDocument: (
    text: string,
    meta?: { collectionId?: string; source?: string; title?: string; documentId?: string; mode?: RagIndexMode },
  ) =>
    authorizedAxios
      .post<IndexDocumentResponse>('/api/ai/documents/index', { text, ...meta })
      .then((r) => r.data),

  listDocumentsGrouped: (collectionId?: string) =>
    authorizedAxios
      .get<IndexedRagDocumentList>('/api/ai/documents/grouped', { params: { collectionId } })
      .then((r) => r.data),

  deleteDocumentChunk: (id: string) =>
    authorizedAxios.delete<{ success: boolean }>(`/api/ai/documents/${id}`).then((r) => r.data),

  deleteDocument: (documentId: string) =>
    authorizedAxios
      .delete<{ success: boolean; documentId: string }>(`/api/ai/documents/document/${encodeURIComponent(documentId)}`)
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
