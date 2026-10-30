import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { Markdown } from '../lib/markdown';
import { useTheme } from '../theme';
import type { Message } from '../types';

type MessageBubbleProps = {
  message: Message;
  /** Fresh messages (sent this session) get the entry animation. */
  animate: boolean;
  /** True while this message is the live streaming target. */
  streaming?: boolean;
};

/** Pulsing three-dot "Thinking" indicator (the web's ThinkingIndicator). */
function Thinking({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.thinking}>
      <View style={styles.thinkingDots}>
        {[0, 1, 2].map((i) => (
          <MotiView
            key={i}
            from={{ opacity: 0.25, scale: 0.75 }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.75, 1, 0.75] }}
            transition={{
              type: 'timing',
              duration: 900,
              loop: true,
              delay: i * 160,
            }}
            style={[styles.thinkingDot, { backgroundColor: colors.primary }]}
          />
        ))}
      </View>
      <Text style={[styles.thinkingLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

/** The blinking caret that rides the tail of a streaming reply. */
function Caret() {
  const { colors } = useTheme();
  return (
    <MotiView
      from={{ opacity: 1 }}
      animate={{ opacity: [1, 0.15, 1] }}
      transition={{ type: 'timing', duration: 700, loop: true }}
      style={[styles.caret, { backgroundColor: colors.primary }]}
    />
  );
}

/**
 * One chat message — the web rendering rules:
 *   · user turns: right-aligned bubble (--chat-user-* tokens), rounded with a
 *     tight top-right corner, plain pre-wrap text
 *   · assistant turns: FRAMELESS markdown on the canvas, full width
 *   · errors: destructive-tinted card
 */
export default function MessageBubble({ message, animate, streaming = false }: MessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const [entered, setEntered] = useState(!animate);

  // Fresh messages animate in once, then render statically so FlashList
  // recycling never re-triggers the entrance.
  useEffect(() => {
    if (!entered) {
      const timer = setTimeout(() => setEntered(true), 400);
      return () => clearTimeout(timer);
    }
  }, [entered]);

  const body = (
    <View style={[styles.column, isUser ? styles.columnUser : styles.columnAgent]}>
      {isUser ? (
        <View
          style={[
            styles.bubbleUser,
            {
              backgroundColor: colors.chatUserBg,
              borderColor: colors.chatUserBorder,
            },
          ]}
        >
          <Text selectable style={[styles.textUser, { color: colors.chatUserFg }]}>
            {message.content}
          </Text>
        </View>
      ) : message.error ? (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: colors.card, borderColor: colors.destructive },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
          <Text selectable style={[styles.errorText, { color: colors.destructive }]}>
            {message.content}
          </Text>
        </View>
      ) : message.content.length === 0 && streaming ? (
        <Thinking label="Thinking" />
      ) : (
        <View style={styles.agentBody}>
          <Markdown text={message.content} />
          {streaming ? (
            <View style={styles.caretRow}>
              <Caret />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  if (!animate || entered) {
    return body;
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10, scale: 0.98 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: 240 }}
    >
      {body}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  column: { marginVertical: 5 },
  columnUser: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '85%' },
  columnAgent: { alignSelf: 'stretch' },
  bubbleUser: {
    borderRadius: 18,
    borderTopRightRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  textUser: { fontSize: 15, lineHeight: 22 },
  agentBody: { paddingTop: 1 },
  caretRow: { marginTop: 4, height: 18, justifyContent: 'center' },
  caret: { width: 8, height: 15, borderRadius: 2 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
    maxWidth: '92%',
  },
  errorText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    paddingHorizontal: 3,
  },
  thinkingDots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  thinkingDot: { width: 6, height: 6, borderRadius: 999 },
  thinkingLabel: { fontSize: 12.5 },
});
