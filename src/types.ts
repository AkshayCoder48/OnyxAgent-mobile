/** Shared domain types — mirrors the webapp's conversation/message shapes. */

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  /** Model that produced an assistant message (informational). */
  model?: string;
  /** Set when the turn errored — rendered as an error card. */
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
}

/** Normalized view of a live Pollinations catalogue entry. */
export interface ModelInfo {
  id: string;
  title: string;
  publisher: string;
  description: string;
  community: boolean;
  /** All provider rates zero (or rate-less and not paid_only) — web isFreeModel. */
  free: boolean;
  healthy: boolean;
  unavailable: boolean;
  contextLength?: number;
}

export type ModelsState = 'idle' | 'loading' | 'ready' | 'error';

export interface Settings {
  theme: 'dark' | 'light';
  /** Optional BYOP key — the anonymous tier works without one. */
  apiKey: string;
  /** Canonical model id (e.g. "openai/gpt-5.4-nano"). */
  defaultModel: string;
}

/** Sidebar date grouping — the web's tracked-caps headers. */
export type ConversationSectionId = 'today' | 'yesterday' | 'thisWeek' | 'older';

export const CONVERSATION_SECTION_LABELS: Record<ConversationSectionId, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  older: 'Older',
};
