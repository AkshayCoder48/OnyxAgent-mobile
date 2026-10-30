import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { shortModelName } from '../lib/pollinations';
import { useOnyxStore, useUiStore } from '../store';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';

/**
 * The settings sheet — appearance (dark/light, the web's opt-in light
 * palette), the optional Pollinations API key, the default model shortcut,
 * data reset and about.
 */
export function SettingsSheet() {
  const { colors, fonts } = useTheme();
  const open = useUiStore((s) => s.settingsOpen);
  const close = useUiStore((s) => s.closeSettings);
  const openModelPicker = useUiStore((s) => s.openModelPicker);

  const settings = useOnyxStore((s) => s.settings);
  const updateSettings = useOnyxStore((s) => s.updateSettings);
  const clearAllData = useOnyxStore((s) => s.clearAllData);

  const confirmClear = () => {
    Alert.alert('Clear all data?', 'Every conversation and message on this device will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearAllData();
          close();
        },
      },
    ]);
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Settings"
      subtitle="Appearance, provider and data — stored on this device."
      maxHeightFraction={0.72}
    >
      {/* Appearance */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPEARANCE</Text>
      <View
        style={[
          styles.segment,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        {(['dark', 'light'] as const).map((scheme) => {
          const selected = settings.theme === scheme;
          return (
            <Pressable
              key={scheme}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => updateSettings({ theme: scheme })}
              style={({ pressed }) => [
                styles.segmentItem,
                selected && { backgroundColor: colors.secondary },
                !selected && pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={scheme === 'dark' ? 'moon-outline' : 'sunny-outline'}
                size={13}
                color={selected ? colors.foreground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.segmentText,
                  { color: selected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {scheme === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Pollinations */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>POLLINATIONS</Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>API key</Text>
        <TextInput
          style={[
            styles.keyInput,
            { borderColor: colors.border, color: colors.foreground },
          ]}
          value={settings.apiKey}
          onChangeText={(v) => updateSettings({ apiKey: v })}
          placeholder="Required for chat — paste your key"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
          Chat calls require a key — get one at enter.pollinations.ai/keys. It
          stays on this device and is sent only to gen.pollinations.ai.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          close();
          // Let the settings sheet exit before the picker slides in.
          setTimeout(openModelPicker, 220);
        }}
        style={({ pressed }) => [
          styles.card,
          styles.row,
          { backgroundColor: colors.background, borderColor: colors.border },
          pressed && { opacity: 0.75 },
        ]}
      >
        <View style={styles.rowMain}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Default model</Text>
          <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>
            Used for every new turn
          </Text>
        </View>
        <Text
          style={[styles.modelValue, { color: colors.primary, fontFamily: fonts.mono }]}
          numberOfLines={1}
        >
          {shortModelName(settings.defaultModel)}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.mutedForeground} />
      </Pressable>

      {/* Data */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATA</Text>
      <Pressable
        accessibilityRole="button"
        onPress={confirmClear}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.background, borderColor: colors.destructive },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Ionicons name="trash-outline" size={15} color={colors.destructive} />
        <Text style={[styles.clearText, { color: colors.destructive }]}>Clear all data</Text>
      </Pressable>

      {/* About */}
      <Text style={[styles.about, { color: colors.mutedForeground }]}>
        OnyxAgent v1.0.0 · Powered by Onyx AI Framework · Chat runs on Pollinations
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 7,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    marginBottom: 6,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 7,
  },
  segmentText: { fontSize: 12.5, fontWeight: '600' },
  card: {
    marginHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMain: { flex: 1 },
  cardTitle: { fontSize: 13.5, fontWeight: '600' },
  cardNote: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  keyInput: {
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12.5,
    marginTop: 9,
    marginBottom: 7,
  },
  modelValue: { fontSize: 11, maxWidth: 110 },
  clearText: { fontSize: 13.5, fontWeight: '600' },
  about: {
    fontSize: 10.5,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
    lineHeight: 15,
  },
});
