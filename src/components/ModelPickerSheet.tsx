import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useOnyxStore, useUiStore } from '../store';
import { useTheme } from '../theme';
import { Sheet } from './Sheet';
import type { ModelInfo } from '../types';

/**
 * The model picker sheet — the native counterpart of the web's ChatControls
 * "Model" tab: live Pollinations catalogue, search, free models first, the
 * active model checked. Selection persists as the app default.
 */
export function ModelPickerSheet() {
  const { colors } = useTheme();
  const open = useUiStore((s) => s.modelPickerOpen);
  const close = useUiStore((s) => s.closeModelPicker);

  const models = useOnyxStore((s) => s.models);
  const modelsState = useOnyxStore((s) => s.modelsState);
  const selected = useOnyxStore((s) => s.settings.defaultModel);
  const updateSettings = useOnyxStore((s) => s.updateSettings);
  const fetchModels = useOnyxStore((s) => s.fetchModels);

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return models;
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(needle) ||
        m.title.toLowerCase().includes(needle) ||
        m.publisher.toLowerCase().includes(needle),
    );
  }, [models, query]);

  const pick = (id: string) => {
    updateSettings({ defaultModel: id });
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Model"
      subtitle="Pick the model that handles this conversation. Models sync live from Pollinations."
    >
      {/* Search models. */}
      <View
        style={[
          styles.search,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={13} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search models..."
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {modelsState === 'loading' && models.length === 0 ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Loading models…</Text>
        </View>
      ) : modelsState === 'error' && models.length === 0 ? (
        <View style={styles.stateWrap}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.mutedForeground} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            Couldn't load the model catalogue.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void fetchModels()}
            style={[styles.retry, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item?.id ?? ''}
          renderItem={({ item }) => {
            if (!item) return null;
            return <ModelRow model={item} active={item.id === selected} onPick={pick} />;
          }}
          initialNumToRender={16}
          bounces
          overScrollMode="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.stateText, { color: colors.mutedForeground, textAlign: 'center', padding: 16 }]}>
              No matching models.
            </Text>
          }
          ListFooterComponent={
            <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
              {models.length} models · free first · health-synced from gen.pollinations.ai
            </Text>
          }
          style={styles.list}
        />
      )}
    </Sheet>
  );
}

function ModelRow({
  model,
  active,
  onPick,
}: {
  model: ModelInfo;
  active: boolean;
  onPick: (id: string) => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onPick(model.id)}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: active ? colors.accentMuted : colors.border,
          backgroundColor: active ? colors.accent : colors.background,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowTitleLine}>
          <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground }]}>
            {model.title}
          </Text>
          {model.free ? (
            <View style={[styles.freeBadge, { borderColor: colors.accentMuted }]}>
              <Text style={[styles.freeBadgeText, { color: colors.primary }]}>FREE</Text>
            </View>
          ) : null}
          <View
            style={[
              styles.healthDot,
              {
                backgroundColor: model.unavailable
                  ? colors.destructive
                  : model.healthy
                    ? '#34D399'
                    : '#FBBF24',
              },
            ]}
          />
        </View>
        <Text numberOfLines={1} style={[styles.rowId, { color: colors.mutedForeground }]}>
          {model.id}
          {model.publisher !== 'unknown' ? ` · ${model.publisher}` : ''}
          {model.contextLength ? ` · ${Math.round(model.contextLength / 1000)}K ctx` : ''}
        </Text>
        {model.description.length > 0 ? (
          <Text numberOfLines={1} style={[styles.rowDesc, { color: colors.mutedForeground }]}>
            {model.description}
          </Text>
        ) : null}
      </View>
      {active ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 18,
    marginBottom: 10,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },
  stateWrap: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  stateText: { fontSize: 12.5, textAlign: 'center' },
  retry: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 2,
  },
  retryText: { fontSize: 12.5, fontWeight: '600' },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: 18, paddingBottom: 8 },
  footerNote: {
    fontSize: 10.5,
    textAlign: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 7,
  },
  rowMain: { flex: 1 },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: { flexShrink: 1, fontSize: 13.5, fontWeight: '600' },
  freeBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  freeBadgeText: { fontSize: 8.5, fontWeight: '700', letterSpacing: 0.8 },
  healthDot: { width: 6, height: 6, borderRadius: 999 },
  rowId: { fontSize: 10.5, marginTop: 2 },
  rowDesc: { fontSize: 11, marginTop: 2 },
});
