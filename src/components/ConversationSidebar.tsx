import { useMemo, useState } from 'react';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';

import { conversationSnippet, sectionOfConversation, useOnyxStore } from '../store';
import { useTheme } from '../theme';
import { CONVERSATION_SECTION_LABELS, type ConversationSectionId } from '../types';

type SidebarItem =
  | { kind: 'section'; key: string; label: string }
  | { kind: 'conversation'; key: string; id: string; title: string; snippet: string };

type ConversationSidebarProps = {
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
};

const SECTION_ORDER: ConversationSectionId[] = ['today', 'yesterday', 'thisWeek', 'older'];

/**
 * Drawer sidebar — a total port of the webapp's conversation-sidebar:
 * "Conversations" header, New Chat button, search, Active/Archived tabs,
 * date-grouped list with long-press actions (rename / archive / delete) and
 * the Guest account footer.
 */
export default function ConversationSidebar({
  onSelect,
  onNewChat,
  onOpenSettings,
}: ConversationSidebarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const conversations = useOnyxStore((s) => s.conversations);
  const messagesByConversation = useOnyxStore((s) => s.messagesByConversation);
  const activeId = useOnyxStore((s) => s.activeConversationId);
  const renameConversation = useOnyxStore((s) => s.renameConversation);
  const setConversationArchived = useOnyxStore((s) => s.setConversationArchived);
  const deleteConversation = useOnyxStore((s) => s.deleteConversation);

  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [query, setQuery] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const activeCount = useMemo(
    () => conversations.filter((c) => !c.archived).length,
    [conversations],
  );
  const archivedCount = useMemo(
    () => conversations.filter((c) => c.archived).length,
    [conversations],
  );

  const items = useMemo<SidebarItem[]>(() => {
    const needle = query.trim().toLowerCase();
    const visible = conversations
      .filter((c) => c.archived === (tab === 'archived'))
      .filter(
        (c) =>
          needle.length === 0 ||
          c.title.toLowerCase().includes(needle) ||
          conversationSnippet(messagesByConversation[c.id]).toLowerCase().includes(needle),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const out: SidebarItem[] = [];
    for (const section of SECTION_ORDER) {
      const inSection = visible.filter((c) => sectionOfConversation(c) === section);
      if (inSection.length === 0) continue;
      out.push({
        kind: 'section',
        key: `section-${section}`,
        label: CONVERSATION_SECTION_LABELS[section].toUpperCase(),
      });
      for (const c of inSection) {
        out.push({
          kind: 'conversation',
          key: c.id,
          id: c.id,
          title: c.title,
          snippet: conversationSnippet(messagesByConversation[c.id]),
        });
      }
    }
    return out;
  }, [conversations, messagesByConversation, tab, query]);

  const actionTarget = useMemo(
    () => conversations.find((c) => c.id === actionId) ?? null,
    [conversations, actionId],
  );

  const openActions = (id: string) => {
    setActionId(id);
    setRenaming(false);
    setRenameValue('');
  };

  const closeActions = () => {
    setActionId(null);
    setRenaming(false);
  };

  const confirmDelete = (id: string) => {
    closeActions();
    Alert.alert('Delete conversation?', 'This permanently removes the thread and its messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteConversation(id),
      },
    ]);
  };

  const renderItem: ListRenderItem<SidebarItem> = ({ item }) => {
    if (!item) return null;
    if (item.kind === 'section') {
      return <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{item.label}</Text>;
    }
    const isActive = item.id === activeId;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        onPress={() => onSelect(item.id)}
        onLongPress={() => openActions(item.id)}
        delayLongPress={320}
        style={({ pressed }) => [
          styles.row,
          { borderColor: isActive ? colors.accentMuted : 'transparent' },
          isActive && { backgroundColor: colors.accent },
          !isActive && pressed && { backgroundColor: colors.card },
        ]}
      >
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={15}
          color={isActive ? colors.primary : colors.mutedForeground}
          style={{ marginTop: 2 }}
        />
        <View style={styles.rowText}>
          <Text
            numberOfLines={1}
            style={[
              styles.rowTitle,
              { color: isActive ? colors.primary : colors.foreground },
            ]}
          >
            {item.title}
          </Text>
          <Text numberOfLines={1} style={[styles.rowSnippet, { color: colors.mutedForeground }]}>
            {item.snippet}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.secondary,
          paddingTop: insets.top + 10,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {/* Header — the web's h2 "Conversations". */}
      <Text style={[styles.header, { color: colors.foreground }]}>Conversations</Text>

      {/* New Chat — full-width primary button (web: SquarePen + "New Chat"). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a new chat"
        onPress={onNewChat}
        style={({ pressed }) => [
          styles.newChat,
          { backgroundColor: colors.primary },
          pressed && { backgroundColor: colors.primaryHover },
        ]}
      >
        <Ionicons name="create-outline" size={16} color={colors.primaryForeground} />
        <Text style={[styles.newChatLabel, { color: colors.primaryForeground }]}>New Chat</Text>
      </Pressable>

      {/* Search chats. */}
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={14} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close" size={14} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {/* Active / Archived segmented tabs with counts. */}
      <View
        style={[styles.tabBar, { backgroundColor: colors.background, borderColor: colors.border }]}
      >
        {(
          [
            { id: 'active', label: 'Active', count: activeCount },
            { id: 'archived', label: 'Archived', count: archivedCount },
          ] as const
        ).map((t) => {
          const selected = tab === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(t.id)}
              style={({ pressed }) => [
                styles.tab,
                selected && { backgroundColor: colors.secondary },
                !selected && pressed && { opacity: 0.7 },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: selected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {t.label}
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: selected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {t.count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Conversation list, date-grouped. */}
      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
            <Ionicons
              name={tab === 'archived' ? 'archive-outline' : 'chatbubbles-outline'}
              size={20}
              color={colors.mutedForeground}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {query.length > 0
              ? 'No matches'
              : tab === 'archived'
                ? 'No archived conversations'
                : 'No conversations yet'}
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            {query.length > 0
              ? 'Try a different search.'
              : tab === 'archived'
                ? 'Conversations you archive will appear here.'
                : 'Start a new chat to begin'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item?.key ?? ''}
          bounces
          overScrollMode="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10 }}
        />
      )}

      {/* Account footer — web: avatar + name + plan + KB/Settings buttons. */}
      <View style={[styles.footer, { borderColor: colors.border }]}>
        <View style={[styles.footerAvatar, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.footerAvatarText, { color: colors.background }]}>G</Text>
        </View>
        <View style={styles.footerName}>
          <Text numberOfLines={1} style={[styles.footerNameText, { color: colors.foreground }]}>
            Guest
          </Text>
          <Text style={[styles.footerPlan, { color: colors.mutedForeground }]}>Free plan</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Knowledge Base"
          hitSlop={8}
          onPress={() =>
            Alert.alert(
              'Knowledge Base',
              'Knowledge Base management lives in the OnyxAgent web app. This mobile app is focused on chat.',
            )
          }
          style={({ pressed }) => [styles.footerButton, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="book-outline" size={17} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={8}
          onPress={onOpenSettings}
          style={({ pressed }) => [styles.footerButton, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="settings-outline" size={17} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Row-action overlay (rename / archive / delete) — drawer-scoped. */}
      {actionTarget ? (
        <View style={[StyleSheet.absoluteFill, styles.actionOverlay, { zIndex: 40 }]}>
          <Pressable
            accessibilityLabel="Dismiss actions"
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: 0.6 }]}
            onPress={closeActions}
          />
          <MotiView
            from={{ opacity: 0, scale: 0.94, translateY: 8 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 380 }}
            style={[styles.actionPanel, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text numberOfLines={1} style={[styles.actionTitle, { color: colors.foreground }]}>
              {actionTarget.title}
            </Text>
            {renaming ? (
              <View>
                <TextInput
                  style={[
                    styles.renameInput,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
                  ]}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  placeholder="Conversation name"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                  maxLength={80}
                  onSubmitEditing={() => {
                    renameConversation(actionTarget.id, renameValue);
                    closeActions();
                  }}
                />
                <View style={styles.actionButtons}>
                  <Pressable style={[styles.actionButton, { borderColor: colors.border }]} onPress={closeActions}>
                    <Text style={[styles.actionButtonText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      renameConversation(actionTarget.id, renameValue);
                      closeActions();
                    }}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actionButtons}>
                <Pressable
                  style={styles.actionRow}
                  onPress={() => {
                    setRenameValue(actionTarget.title === 'New conversation' ? '' : actionTarget.title);
                    setRenaming(true);
                  }}
                >
                  <Ionicons name="pencil-outline" size={15} color={colors.foreground} />
                  <Text style={[styles.actionRowText, { color: colors.foreground }]}>Rename</Text>
                </Pressable>
                <Pressable
                  style={styles.actionRow}
                  onPress={() => {
                    setConversationArchived(actionTarget.id, !actionTarget.archived);
                    closeActions();
                  }}
                >
                  <Ionicons name="archive-outline" size={15} color={colors.foreground} />
                  <Text style={[styles.actionRowText, { color: colors.foreground }]}>
                    {actionTarget.archived ? 'Restore' : 'Archive'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.actionRow}
                  onPress={() => confirmDelete(actionTarget.id)}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.destructive} />
                  <Text style={[styles.actionRowText, { color: colors.destructive }]}>Delete</Text>
                </Pressable>
              </View>
            )}
          </MotiView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  newChat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 12,
    marginBottom: 10,
    height: 40,
    borderRadius: 12,
  },
  newChatLabel: { fontSize: 13.5, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 12,
    marginBottom: 8,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, fontSize: 13.5, paddingVertical: 0 },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 6,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  tabCount: { fontSize: 10, fontWeight: '500' },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  rowText: { flex: 1, paddingRight: 4 },
  rowTitle: { fontSize: 13.5, fontWeight: '600' },
  rowSnippet: { fontSize: 11.5, marginTop: 2 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 13.5, fontWeight: '600' },
  emptySub: { fontSize: 11.5, textAlign: 'center', lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
  },
  footerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerAvatarText: { fontSize: 11, fontWeight: '700' },
  footerName: { flex: 1 },
  footerNameText: { fontSize: 13, fontWeight: '600' },
  footerPlan: { fontSize: 10, marginTop: 1 },
  footerButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOverlay: { alignItems: 'center', justifyContent: 'center' },
  actionPanel: {
    width: '82%',
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  actionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  actionButtons: { gap: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  actionRowText: { fontSize: 13.5, fontWeight: '500' },
  renameInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13.5,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionButtonText: { fontSize: 13, fontWeight: '600' },
});
