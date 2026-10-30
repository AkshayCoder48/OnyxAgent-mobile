import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shortModelName } from '../lib/pollinations';
import { useOnyxStore, useUiStore } from '../store';
import { useTheme } from '../theme';

type ComposerProps = {
  onSend: (text: string) => void;
  /** True while a turn is streaming — the send button becomes Stop. */
  busy: boolean;
};

/**
 * The composer card — the web's glass-card: rounded-2xl bordered card with a
 * multiline input, and a footer bar carrying the LIVE/OFFLINE pill, the model
 * pill (opens the model picker) and the send/stop button. The disclaimer sits
 * under the card.
 */
export default function Composer({ onSend, busy }: ComposerProps) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const online = useOnyxStore((s) => s.online);
  const model = useOnyxStore((s) => s.settings.defaultModel);
  const openModelPicker = useUiStore((s) => s.openModelPicker);

  const canSend = value.trim().length > 0 && !busy;

  const send = () => {
    const text = value.trim();
    if (text.length === 0 || busy) return;
    onSend(text);
    setValue('');
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: focused ? colors.accentMuted : colors.border,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.foreground }]}
          value={value}
          onChangeText={setValue}
          placeholder="Reply to OnyxAgent…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <View style={[styles.footer, { borderColor: colors.border }]}>
          {/* LIVE / OFFLINE pill (the web's composer footer status). */}
          <View style={styles.live}>
            <View
              style={[styles.liveDot, { backgroundColor: online ? colors.primary : colors.destructive }]}
            />
            <Text
              style={[
                styles.liveText,
                { color: colors.mutedForeground, fontFamily: fonts.mono },
              ]}
            >
              {online ? 'LIVE' : 'OFFLINE'}
            </Text>
          </View>

          <View style={styles.footerRight}>
            {/* Model pill — opens the picker. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change model"
              onPress={openModelPicker}
              hitSlop={6}
              style={({ pressed }) => [
                styles.modelPill,
                { backgroundColor: colors.background, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="options-outline" size={11} color={colors.mutedForeground} />
              <Text
                style={[styles.modelPillText, { color: colors.foreground, fontFamily: fonts.mono }]}
                numberOfLines={1}
              >
                {shortModelName(model)}
              </Text>
              <Ionicons name="chevron-down" size={11} color={colors.mutedForeground} />
            </Pressable>

            {/* Send / Stop. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? 'Stop generating' : 'Send message'}
              disabled={!busy && !canSend}
              hitSlop={8}
              onPress={busy ? () => useOnyxStore.getState().stopStreaming() : send}
              style={({ pressed }) => [
                styles.send,
                busy
                  ? { backgroundColor: colors.secondary, borderColor: colors.border }
                  : canSend
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
            >
              <Ionicons
                name={busy ? 'stop' : 'arrow-up'}
                size={17}
                color={busy ? colors.destructive : canSend ? colors.primaryForeground : colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Disclaimer (the web's composer caption). */}
      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
        OnyxAgent can make mistakes. Double-check important information.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 6 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 44,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 10,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 999 },
  liveText: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '600',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: 150,
  },
  modelPillText: {
    fontSize: 10.5,
    letterSpacing: 0.4,
    maxWidth: 96,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 7,
    opacity: 0.8,
  },
});
