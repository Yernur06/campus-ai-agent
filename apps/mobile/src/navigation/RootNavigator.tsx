import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import DetailsScreen from '../screens/DetailsScreen';
import EventRegistrationScreen from '../screens/EventRegistrationScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { translations } from '../constants/translations';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../types/navigation';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isReady, isAuthenticated, theme, language } = useApp();
  const t = translations[language];

  if (!isReady) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer onUnhandledAction={() => Alert.alert(t.errorTitle, t.routeNotFound)}>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'Main' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EventRegistration" component={EventRegistrationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="Details"
          component={DetailsScreen}
          options={({ route }) => ({
            headerShown: true,
            title: route.params?.title ?? t.routeNotFound,
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTintColor: theme.colors.text,
            headerTitleStyle: { color: theme.colors.text }
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
