import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import TopActions from '../components/TopActions';
import { translations } from '../constants/translations';
import { useApp } from '../context/AppContext';
import { savePost } from '../database/favorites';
import { getPosts } from '../services/newsApi';
import type { MainTabParamList, RootStackParamList } from '../types/navigation';
import type { NewsScreenState, Post } from '../types/news';

type NewsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'News'>,
  NativeStackScreenProps<RootStackParamList, 'Main'>
>;

const initialState: NewsScreenState = {
  status: 'loading',
  data: [],
  errorMessage: null
};

export default function NewsScreen(_props: NewsScreenProps) {
  const { theme, themeName, language } = useApp();
  const t = translations[language];
  const [newsState, setNewsState] = useState<NewsScreenState>(initialState);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const loadPosts = useCallback(async (isRefresh: boolean) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setNewsState({ status: 'loading', data: [], errorMessage: null });
    }

    try {
      const posts = await getPosts(controller.signal);
      if (mountedRef.current && !controller.signal.aborted) {
        setNewsState({ status: 'success', data: posts, errorMessage: null });
      }
    } catch (error) {
      if (mountedRef.current && !controller.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Unknown error.';
        setNewsState((current) => ({
          status: isRefresh && current.status === 'success' ? 'success' : 'error',
          data: current.data,
          errorMessage: message
        }));
      }
    } finally {
      if (mountedRef.current && !controller.signal.aborted) {
        setIsRefreshing(false);
        controllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadPosts(false);

    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [loadPosts]);

  const renderPost: ListRenderItem<Post> = ({ item }) => (
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
      <View style={styles.cardRow}>
        <View style={styles.cardContent}>
          <Text style={[styles.postTitle, { color: theme.colors.text }]}>{item.title}</Text>
          <Text style={[styles.postBody, { color: theme.colors.mutedText }]} numberOfLines={3}>
            {item.body}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void (async () => {
              try {
                const saved = await savePost({ id: item.id, title: item.title, body: item.body });
                Alert.alert(t.news.savedTitle, saved === 1 ? t.news.alertSaved : t.news.alertAlreadySaved);
              } catch {
                Alert.alert(t.news.savedTitle, t.news.alertCouldNotSave);
              }
            })();
          }}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.8 : 1
            }
          ]}
        >
          <Text style={[styles.saveButtonText, { color: theme.colors.background }]}>{t.news.saveOffline}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderSeparator = () => <View style={{ height: theme.spacing.md }} />;

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: theme.colors.mutedText }]}>{t.newsEmpty}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
      <TopActions showLogout={false} />
      <Text style={[styles.title, { color: theme.colors.text }]}>{t.tabNews}</Text>
      {newsState.errorMessage && newsState.status === 'success' ? (
        <Text accessibilityRole="alert" style={[styles.refreshError, { color: theme.colors.error }]}>
          {t.newsError} {newsState.errorMessage}
        </Text>
      ) : null}
    </View>
  );

  if (newsState.status === 'loading') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: theme.colors.mutedText }]}>{t.newsLoading}</Text>
      </View>
    );
  }

  if (newsState.status === 'error') {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: theme.colors.background, padding: theme.spacing.lg }
        ]}
      >
        <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
        <TopActions showLogout={false} />
        <View style={styles.errorContent}>
          <Text accessibilityRole="alert" style={[styles.errorText, { color: theme.colors.error }]}>
            {t.newsError}
          </Text>
          {newsState.errorMessage ? (
            <Text style={[styles.errorDetails, { color: theme.colors.mutedText }]}>
              {newsState.errorMessage}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadPosts(false)}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.75 : 1,
                marginTop: theme.spacing.md
              }
            ]}
          >
            <Text style={[styles.retryText, { color: theme.colors.background }]}>{t.newsRetry}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <FlatList
        data={newsState.data}
        renderItem={renderPost}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={renderSeparator}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        accessibilityLabel={t.newsRefresh}
        contentContainerStyle={[styles.listContent, { paddingBottom: theme.spacing.lg }]}
        refreshing={isRefreshing}
        onRefresh={() => void loadPosts(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { flexGrow: 1, paddingTop: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 4 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardContent: { flex: 1, marginRight: 12 },
  postTitle: { fontSize: 17, fontWeight: '700', lineHeight: 23, marginBottom: 8 },
  postBody: { fontSize: 14, lineHeight: 21 },
  saveButton: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'center' },
  saveButtonText: { fontSize: 12, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 15, marginTop: 12 },
  errorContainer: { flex: 1 },
  errorContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  errorDetails: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  refreshError: { fontSize: 14, lineHeight: 20, marginTop: 12 },
  retryButton: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { fontSize: 15, fontWeight: '700' }
});
