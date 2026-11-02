import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem
} from 'react-native';
import { translations } from '../constants/translations';
import { useApp } from '../context/AppContext';
import { getSavedPosts, removeSaved, toggleRead, type SavedPost } from '../database/favorites';
import type { MainTabParamList, RootStackParamList } from '../types/navigation';

type FavoritesScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Favorites'>,
  NativeStackScreenProps<RootStackParamList, 'Main'>
>;

type FilterMode = 'all' | 'unread';

export default function FavoritesScreen(_props: FavoritesScreenProps) {
  const { theme, language } = useApp();
  const t = translations[language];
  const [items, setItems] = useState<SavedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const lockedRef = useRef(false);
  const activeRef = useRef(true);

  const reloadAfterChange = useCallback(async () => {
    try {
      const nextItems = await getSavedPosts();
      if (activeRef.current) {
        setItems(nextItems);
        setError(null);
      }
    } catch {
      if (activeRef.current) {
        setError(t.favorites.error);
      }
      Alert.alert(t.errorTitle, t.favorites.reloadIssue);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      let isActive = true;

      const loadItems = async () => {
        setLoading(true);
        setError(null);

        try {
          const savedPosts = await getSavedPosts();
          if (isActive && activeRef.current) {
            setItems(savedPosts);
          }
        } catch {
          if (isActive && activeRef.current) {
            setError(t.favorites.error);
          }
        } finally {
          if (isActive && activeRef.current) {
            setLoading(false);
          }
        }
      };

      void loadItems();

      return () => {
        isActive = false;
        activeRef.current = false;
      };
    }, [t])
  );

  const change = useCallback(
    async (action: () => Promise<void>) => {
      if (lockedRef.current || busy) {
        return;
      }

      lockedRef.current = true;
      setBusy(true);

      try {
        await action();
      } catch (err) {
        const message = err instanceof Error ? err.message : t.favorites.error;
        setError(message);
        Alert.alert(t.errorTitle, message);
      } finally {
        try {
          await reloadAfterChange();
        } catch {
          // Intentionally ignored because reloadAfterChange handles its own failure notifications.
        }
        lockedRef.current = false;
        setBusy(false);
      }
    },
    [busy, reloadAfterChange, t]
  );

  const confirmRemove = useCallback(
    (id: number) => {
      Alert.alert(t.favorites.deleteTitle, t.favorites.deleteMessage, [
        { text: t.back, style: 'cancel' },
        {
          text: t.favorites.delete,
          style: 'destructive',
          onPress: () => {
            void change(async () => {
              await removeSaved(id);
            });
          }
        }
      ]);
    },
    [change, t]
  );

  const unreadCount = items.filter((item) => item.isRead === 0).length;
  const visibleItems = filter === 'unread' ? items.filter((item) => item.isRead === 0) : items;

  const renderItem: ListRenderItem<SavedPost> = ({ item }) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          marginHorizontal: theme.spacing.lg
        }
      ]}
    >
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: item.isRead === 1 ? theme.colors.selected : theme.colors.primary
            }
          ]}
        >
          <Text style={[styles.statusPillText, { color: item.isRead === 1 ? theme.colors.text : theme.colors.background }]}>
            {item.isRead === 1 ? t.favorites.read : t.favorites.unreadStatus}
          </Text>
        </View>
      </View>
      <Text style={[styles.cardBody, { color: theme.colors.mutedText }]}>{item.body}</Text>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={busy || loading || Boolean(error)}
          onPress={() => {
            void change(async () => {
              await toggleRead(item.id);
            });
          }}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed || busy || loading || Boolean(error) ? 0.75 : 1
            }
          ]}
        >
          <Text style={[styles.actionButtonText, { color: theme.colors.background }]}>{t.favorites.toggleRead}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy || loading || Boolean(error)}
          onPress={() => confirmRemove(item.id)}
          style={({ pressed }) => [
            styles.deleteButton,
            {
              borderColor: theme.colors.error,
              opacity: pressed || busy || loading || Boolean(error) ? 0.75 : 1
            }
          ]}
        >
          <Text style={[styles.deleteText, { color: theme.colors.error }]}>{t.favorites.delete}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{t.favorites.title}</Text>
      {loading ? <Text style={[styles.headerText, { color: theme.colors.mutedText }]}>{t.favorites.loading}</Text> : null}
      {error ? <Text style={[styles.headerError, { color: theme.colors.error }]}>{error}</Text> : null}

      <View style={styles.filterRow}>
        {(['all', 'unread'] as const).map((option) => {
          const isActive = filter === option;
          return (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.border
                }
              ]}
            >
              <Text style={[styles.filterText, { color: isActive ? theme.colors.background : theme.colors.text }]}>
                {option === 'all' ? t.favorites.all : t.favorites.unread}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.countText, { color: theme.colors.mutedText }]}>
        {t.favorites.unreadCount.replace('{count}', String(unreadCount))}
      </Text>
    </View>
  );

  const renderEmpty = () => {
    if (loading || error) {
      return null;
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: theme.colors.mutedText }]}>{t.favorites.empty}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={visibleItems}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { flexGrow: 1, paddingTop: 16, paddingBottom: 24 },
  header: { marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  headerText: { fontSize: 14, marginBottom: 8 },
  headerError: { fontSize: 14, marginBottom: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10
  },
  filterText: { fontSize: 13, fontWeight: '700' },
  countText: { fontSize: 13, marginTop: 4 },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 10 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  cardBody: { fontSize: 14, lineHeight: 22 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  actionButton: { borderRadius: 10, flex: 1, paddingVertical: 10, alignItems: 'center', marginRight: 8 },
  actionButtonText: { fontSize: 14, fontWeight: '700' },
  deleteButton: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  deleteText: { fontSize: 14, fontWeight: '700' },
  emptyContainer: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center' }
});
