import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentRef } from 'react';
import {
  AnimatedFlashList,
  FlashListRef,
  type ListRenderItem,
} from '@shopify/flash-list';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { useOnyxStore, useUiStore } from '../store';
import type { DrawerApi } from '../hooks/useDrawerGesture';
import { useTheme } from '../theme';
import type { Message } from '../types';
import ChatHeader from './ChatHeader';
import Composer from './Composer';
import EmptyState from './EmptyState';
import MessageBubble from './MessageBubble';

// FlashList v2 ships its own Reanimated-animated wrapper (typed against
// FlashListProps<any>), which keeps the worklet onScroll handler and the
// row typings working together.

type Row =
  | { kind: 'separator'; key: string; label: string }
  | { kind: 'message'; key: string; message: Message; streaming: boolean; animate: boolean };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Stable empty-thread reference. Store selectors must return referentially
 * equal snapshots between renders — zustand v5 wires them into
 * useSyncExternalStore, and a fresh `[]` literal on every call makes React
 * force-re-render in an infinite loop ("Maximum update depth exceeded" →
 * FATAL on launch, reproduced in the CI emulator smoke test).
 */
const EMPTY_MESSAGES: Message[] = [];

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** The web's date separator: "TODAY · 2:14 PM" (tracked-caps + hairlines). */
function separatorLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day =
    ts >= startToday ? 'Today' : ts >= startToday - 86400000 ? 'Yesterday' : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${day} · ${h}:${mm} ${ampm}`;
}

type ChatScreenProps = {
  drawer: DrawerApi;
  onOpenModelPicker: () => void;
};

/**
 * The chat screen: ChatHeader + the thread (FlashList with day separators,
 * or the empty state) + the composer. Turns stream live from the store;
 * auto-scroll follows the stream only while the user is near the bottom.
 */
export default function ChatScreen({ drawer, onOpenModelPicker }: ChatScreenProps) {
  const { colors } = useTheme();

  const activeConversationId = useOnyxStore((s) => s.activeConversationId);
  const messages = useOnyxStore((s) =>
    s.activeConversationId
      ? s.messagesByConversation[s.activeConversationId] ?? EMPTY_MESSAGES
      : EMPTY_MESSAGES,
  );
  const streaming = useOnyxStore((s) => s.streaming);
  const apiKeyMissing = useOnyxStore((s) => s.settings.apiKey.trim().length === 0);
  const isStreamingHere =
    streaming !== null && streaming.conversationId === activeConversationId;

  const scrollY = useSharedValue(0); // raw contentOffset.y, UI thread
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const streamingNow = useSharedValue(false);
  const listRef = useRef<FlashListRef<Row>>(null);
  // Thread length at mount — everything beyond it was appended live, so it
  // gets the entry animation and triggers the scroll-to-bottom.
  const initialCount = useRef(messages.length);

  useEffect(() => {
    streamingNow.value = isStreamingHere;
  }, [isStreamingHere, streamingNow]);

  const scrollToBottom = useCallback(() => {
    const node = listRef.current;
    if (node !== null && typeof node.scrollToOffset === 'function') {
      node.scrollToOffset({ offset: 1000000, animated: true });
    }
  }, []);
  const scrollToBottomRef = useRef(scrollToBottom);
  scrollToBottomRef.current = scrollToBottom;

  // Scroll events run in a worklet: the empty-state bulge and the streaming
  // follow reaction never touch the JS thread. scrollEventThrottle 16 keeps
  // the overscroll sampling at frame rate.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;
    },
  });

  // While a turn streams in, keep the tail on screen only if the user is
  // already near the bottom (the web's user-intent scroll controller,
  // compressed to its essential rule).
  useAnimatedReaction(
    () => contentHeight.value,
    (current, previous) => {
      'worklet';
      if (current > (previous ?? 0) && streamingNow.value) {
        const nearBottom = scrollY.value >= current - viewportHeight.value - 480;
        if (nearBottom) {
          runOnJS(scrollToBottomRef.current)();
        }
      }
    },
  );

  useEffect(() => {
    if (messages.length > initialCount.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    messages.forEach((message, index) => {
      const key = dayKey(message.createdAt);
      if (key !== lastDay) {
        out.push({ kind: 'separator', key: `sep-${key}`, label: separatorLabel(message.createdAt) });
        lastDay = key;
      }
      out.push({
        kind: 'message',
        key: message.id,
        message,
        streaming: isStreamingHere && streaming?.messageId === message.id,
        animate: index >= initialCount.current,
      });
    });
    return out;
  }, [messages, isStreamingHere, streaming]);

  const renderItem: ListRenderItem<Row> = useCallback(({ item }) => {
    if (!item) return null;
    if (item.kind === 'separator') {
      return (
        <View style={styles.separator}>
          <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
          <View style={styles.separatorLabelWrap}>
            <Text style={[styles.separatorLabel, { color: colors.mutedForeground }]}>
              {item.label}
            </Text>
          </View>
          <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
        </View>
      );
    }
    return (
      <MessageBubble
        message={item.message}
        animate={item.animate}
        streaming={item.streaming}
      />
    );
  }, [colors.border, colors.mutedForeground]);

  const keyExtractor = useCallback((item: Row | null) => item?.key ?? '', []);

  const handleSend = useCallback((text: string) => {
    void useOnyxStore.getState().sendMessage(text);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ChatHeader drawer={drawer} onOpenModelPicker={onOpenModelPicker} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View
          style={styles.chatArea}
          onLayout={(e) => {
            viewportHeight.value = e.nativeEvent.layout.height;
          }}
        >
          {messages.length === 0 ? (
            /* Empty thread — the empty state scrolls (and BULGES on iOS
               overscroll) inside a plain animated ScrollView. */
            <Animated.ScrollView
              style={styles.fill}
              contentContainerStyle={styles.emptyContent}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              bounces
              overScrollMode="always"
              showsVerticalScrollIndicator={false}
            >
              <EmptyState scrollY={scrollY} onPick={handleSend} />
            </Animated.ScrollView>
          ) : (
            <AnimatedFlashList
              ref={listRef as unknown as ComponentRef<typeof AnimatedFlashList>}
              data={rows}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              bounces
              overScrollMode="always"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={(_w, h) => {
                contentHeight.value = h;
              }}
            />
          )}
        </View>

        {/* Connect banner — chat needs a Pollinations key (the provider now
            requires one, like the web app's BYOP providers). */}
        {apiKeyMissing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Connect Pollinations"
            onPress={() => useUiStore.getState().openSettings()}
            style={({ pressed }) => [
              styles.connectBanner,
              { backgroundColor: colors.card, borderColor: colors.accentMuted },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons name="key-outline" size={14} color={colors.primary} />
            <Text style={[styles.connectText, { color: colors.foreground }]}>
              Connect Pollinations to start chatting
            </Text>
            <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
          </Pressable>
        ) : null}

        <Composer onSend={handleSend} busy={isStreamingHere} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1 },
  chatArea: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  listContent: { paddingHorizontal: 14, paddingBottom: 20 },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  separatorLine: { flex: 1, height: 1 },
  separatorLabelWrap: { paddingHorizontal: 2 },
  separatorLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  connectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  connectText: { flex: 1, fontSize: 12.5, fontWeight: '500' },
});
