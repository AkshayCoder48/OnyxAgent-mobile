/**
 * App state — zustand + AsyncStorage persistence (the native counterpart of
 * the web app's Dexie local-first store): conversations, messages, settings
 * and the live model catalogue. Chat turns stream in through
 * lib/pollinations.streamChat and land as message deltas.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  fetchPollinationsModels,
  pickDefaultModel,
  shortModelName,
  streamChat,
  SYSTEM_PROMPT,
  type StreamHandle,
  type WireMessage,
} from './lib/pollinations';
import type {
  Conversation,
  Message,
  ModelInfo,
  ModelsState,
  Settings,
} from './types';

/** How many trailing messages ride along per turn (context window budget). */
const MAX_HISTORY = 20;

/** The fallback title until the first user message names the thread. */
const UNTITLED = 'New conversation';

interface OnyxState {
  hydrated: boolean;
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  activeConversationId: string | null;
  settings: Settings;
  models: ModelInfo[];
  modelsState: ModelsState;
  /** Non-null while a turn is streaming: which assistant message is live. */
  streaming: { conversationId: string; messageId: string } | null;
  /** False after a network failure — flips the composer LIVE pill. */
  online: boolean;

  setHydrated: () => void;
  fetchModels: () => Promise<void>;
  createConversation: () => string;
  selectConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  setConversationArchived: (id: string, archived: boolean) => void;
  deleteConversation: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  sendMessage: (text: string) => Promise<void>;
  stopStreaming: () => void;
  clearAllData: () => void;
}

let activeStream: StreamHandle | null = null;

const makeId = (prefix: string): string =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const useOnyxStore = create<OnyxState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      conversations: [],
      messagesByConversation: {},
      activeConversationId: null,
      settings: { theme: 'dark', apiKey: '', defaultModel: 'openai' },
      models: [],
      modelsState: 'idle',
      streaming: null,
      online: true,

      setHydrated: () => set({ hydrated: true }),

      fetchModels: async () => {
        if (get().modelsState === 'loading') return;
        set({ modelsState: 'loading' });
        try {
          const models = await fetchPollinationsModels();
          const settings = get().settings;
          // Keep the selection valid: if the stored default vanished from the
          // catalogue (ids rotate), fall back to the web ladder.
          const stillThere = models.some((m) => m.id === settings.defaultModel);
          const defaultModel = stillThere ? settings.defaultModel : pickDefaultModel(models);
          set({
            models,
            modelsState: 'ready',
            online: true,
            settings: stillThere ? settings : { ...settings, defaultModel },
          });
        } catch {
          set({ modelsState: 'error' });
        }
      },

      createConversation: () => {
        const now = Date.now();
        const conversation: Conversation = {
          id: makeId('c'),
          title: UNTITLED,
          createdAt: now,
          updatedAt: now,
          archived: false,
        };
        set((s) => ({
          conversations: [conversation, ...s.conversations],
          messagesByConversation: { ...s.messagesByConversation, [conversation.id]: [] },
          activeConversationId: conversation.id,
        }));
        return conversation.id;
      },

      selectConversation: (id) => set({ activeConversationId: id }),

      renameConversation: (id, title) => {
        const clean = title.trim();
        if (clean.length === 0) return;
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: clean.slice(0, 80) } : c,
          ),
        }));
      },

      setConversationArchived: (id, archived) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id
              ? { ...c, archived, updatedAt: Date.now() }
              : c,
          ),
          activeConversationId:
            s.activeConversationId === id && archived ? null : s.activeConversationId,
        }));
      },

      deleteConversation: (id) => {
        set((s) => {
          const messages = { ...s.messagesByConversation };
          delete messages[id];
          return {
            conversations: s.conversations.filter((c) => c.id !== id),
            messagesByConversation: messages,
            activeConversationId:
              s.activeConversationId === id ? null : s.activeConversationId,
          };
        });
      },

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },

      sendMessage: async (text) => {
        const trimmed = text.trim();
        if (trimmed.length === 0 || get().streaming) return;

        // Ensure an active, non-archived conversation exists.
        let conversationId = get().activeConversationId;
        let conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation || conversation.archived) {
          conversationId = get().createConversation();
          conversation = get().conversations.find((c) => c.id === conversationId);
        }
        if (!conversation) return;
        const convId = conversation.id;

        const now = Date.now();
        const userMessage: Message = {
          id: makeId('u'),
          role: 'user',
          content: trimmed,
          createdAt: now,
        };
        const assistantMessage: Message = {
          id: makeId('a'),
          role: 'assistant',
          content: '',
          createdAt: now + 1,
          model: get().settings.defaultModel,
        };

        const priorMessages = get().messagesByConversation[convId] ?? [];
        set((s) => ({
          messagesByConversation: {
            ...s.messagesByConversation,
            [convId]: [...priorMessages, userMessage, assistantMessage],
          },
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  // First message names the thread (local derivation — the
                  // web generates shimmer titles; here the first user line
                  // is the title source).
                  title:
                    c.title === UNTITLED
                      ? trimmed.slice(0, 48) + (trimmed.length > 48 ? '…' : '')
                      : c.title,
                  updatedAt: now,
                }
              : c,
          ),
          streaming: { conversationId: convId, messageId: assistantMessage.id },
        }));

        // Wire history: system prompt + trailing turns (no empty/error turns).
        const wire: WireMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...[...priorMessages, userMessage]
            .filter((m) => m.content.trim().length > 0 && !m.error)
            .slice(-MAX_HISTORY)
            .map((m) => ({
              role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
              content: m.content,
            })),
        ];

        const handle = streamChat({
          model: get().settings.defaultModel,
          messages: wire,
          apiKey: get().settings.apiKey,
          onDelta: (delta) => {
            set((s) => {
              const list = s.messagesByConversation[convId];
              if (!list) return s;
              return {
                messagesByConversation: {
                  ...s.messagesByConversation,
                  [convId]: list.map((m) =>
                    m.id === assistantMessage.id ? { ...m, content: m.content + delta } : m,
                  ),
                },
              };
            });
          },
        });
        activeStream = handle;

        const result = await handle.done;
        activeStream = null;

        // Auth failures get an actionable message (the provider now requires a
        // key for chat — the web app carries BYOP keys the same way).
        const authFailure =
          !result.ok &&
          !result.aborted &&
          /api key|unauthorized|auth/i.test(result.error ?? '');

        set((s) => {
          const list = s.messagesByConversation[convId] ?? [];
          return {
            streaming: null,
            online: result.ok ? true : result.aborted ? s.online : false,
            messagesByConversation: {
              ...s.messagesByConversation,
              [convId]: list.map((m) => {
                if (m.id !== assistantMessage.id) return m;
                if (result.ok) return m;
                if (result.aborted) {
                  // Stopped mid-flight — keep whatever streamed in.
                  return m.content.length > 0 ? m : { ...m, content: '_Stopped._' };
                }
                return {
                  ...m,
                  error: true,
                  content: authFailure
                    ? 'A Pollinations API key is required to chat. Add yours in Settings → API key (get one at enter.pollinations.ai/keys).'
                    : (result.error ?? 'Something went wrong. Please try again.'),
                };
              }),
            },
          };
        });
      },

      stopStreaming: () => {
        activeStream?.abort();
        activeStream = null;
      },

      clearAllData: () => {
        activeStream?.abort();
        activeStream = null;
        set((s) => ({
          conversations: [],
          messagesByConversation: {},
          activeConversationId: null,
          streaming: null,
          // Settings + models survive a data clear (they are app config).
          settings: s.settings,
          models: s.models,
          modelsState: s.modelsState,
        }));
      },
    }),
    {
      name: 'onyxagent-mobile-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        conversations: s.conversations,
        messagesByConversation: s.messagesByConversation,
        activeConversationId: s.activeConversationId,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// UI store — transient sheet state (model picker / settings).
// ---------------------------------------------------------------------------

interface UiState {
  modelPickerOpen: boolean;
  settingsOpen: boolean;
  openModelPicker: () => void;
  closeModelPicker: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  modelPickerOpen: false,
  settingsOpen: false,
  openModelPicker: () => set({ modelPickerOpen: true }),
  closeModelPicker: () => set({ modelPickerOpen: false }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));

// ---------------------------------------------------------------------------
// Selectors / helpers
// ---------------------------------------------------------------------------

export function sectionOfConversation(
  conversation: Conversation,
  now = new Date(),
): 'today' | 'yesterday' | 'thisWeek' | 'older' {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const updated = conversation.updatedAt;
  if (updated >= startOfToday) return 'today';
  if (updated >= startOfToday - 86400000) return 'yesterday';
  if (updated >= startOfToday - 7 * 86400000) return 'thisWeek';
  return 'older';
}

export function conversationSnippet(
  messages: Message[] | undefined,
): string {
  if (!messages || messages.length === 0) return 'No messages yet';
  const last = messages[messages.length - 1];
  const flat = last.content.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return last.role === 'user' ? '…' : 'Thinking…';
  return flat.length > 72 ? `${flat.slice(0, 72)}…` : flat;
}

/** Model label for chips — short, human, never a raw miss. */
export function modelLabel(id: string, models: ModelInfo[]): string {
  const found = models.find((m) => m.id === id);
  return shortModelName(found ? found.id : id);
}
