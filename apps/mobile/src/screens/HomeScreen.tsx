import { StatusBar } from 'expo-status-bar';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import TopActions from '../components/TopActions';
import { translations } from '../constants/translations';
import { useApp } from '../context/AppContext';
import type { MainTabParamList, RootStackParamList } from '../types/navigation';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList, 'Main'>
>;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { theme, themeName, language } = useApp();
  const t = translations[language];
  const libraryTitle = t.services[0][0];

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background, padding: theme.spacing.lg }]}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <TopActions showLogout={false} />
      <View style={styles.content}>
        <Text style={[styles.greeting, { color: theme.colors.primary }]}>{t.welcome}</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t.campusHubTitle}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>{t.campusSubtitle}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Details', { serviceId: 'library', title: libraryTitle })}
          style={({ pressed }) => [styles.libraryCard, {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.78 : 1
          }]}
        >
          <Text style={[styles.libraryIcon, { color: theme.colors.primary }]}>{'\u25a6'}</Text>
          <View style={styles.libraryCopy}>
            <Text style={[styles.libraryTitle, { color: theme.colors.text }]}>{t.openLibrary}</Text>
            <Text style={[styles.librarySubtitle, { color: theme.colors.mutedText }]}>{libraryTitle}</Text>
          </View>
          <Text style={[styles.chevron, { color: theme.colors.primary }]}>{'\u203a'}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('EventRegistration')}
          style={({ pressed }) => [
            styles.eventCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.78 : 1
            }
          ]}
        >
          <Text style={[styles.libraryIcon, { color: theme.colors.primary }]}>{'\u2705'}</Text>
          <View style={styles.libraryCopy}>
            <Text style={[styles.libraryTitle, { color: theme.colors.text }]}>{t.eventRegistration.title}</Text>
            <Text style={[styles.librarySubtitle, { color: theme.colors.mutedText }]}>{t.eventRegistration.subtitle}</Text>
          </View>
          <Text style={[styles.chevron, { color: theme.colors.primary }]}>{'\u203a'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  content: { flex: 1, justifyContent: 'center', width: '100%', maxWidth: 620, alignSelf: 'center' },
  greeting: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', marginBottom: 10 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: 28 },
  libraryCard: { minHeight: 96, flexDirection: 'row', alignItems: 'center', padding: 18, borderWidth: 1, borderRadius: 14 },
  eventCard: { minHeight: 96, flexDirection: 'row', alignItems: 'center', padding: 18, borderWidth: 1, borderRadius: 14, marginTop: 16 },
  libraryIcon: { fontSize: 30, marginRight: 16 },
  libraryCopy: { flex: 1 },
  libraryTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  librarySubtitle: { fontSize: 14 },
  chevron: { fontSize: 30, fontWeight: '300', marginLeft: 12 }
});
